import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { EmailData } from "@/email/schema";

export const runtime = "nodejs";

type AskBody = {
  prompt: string;
  currentData?: EmailData;
  isDark?: boolean;
};

function parseBody(raw: unknown): AskBody | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.prompt !== "string" || !r.prompt.trim()) return null;
  return {
    prompt: r.prompt,
    currentData:
      r.currentData && typeof r.currentData === "object"
        ? (r.currentData as EmailData)
        : undefined,
    isDark: typeof r.isDark === "boolean" ? r.isDark : undefined,
  };
}

const SYSTEM_PROMPT = (isDark: boolean) =>
  `You design HTML emails for a drag-and-drop builder. The user describes
what they want; you return a JSON document the builder loads.

# Available components

Each item in \`content\` is one of these. Every item must have a unique
"id" string in its props (e.g. "h-1", "sec-2").

Heading.props = { id, text, level (1|2|3), color (hex), fontSize ("32px"),
  fontWeight ("400"|"500"|"600"|"700"|"800"), align ("left"|"center"|"right"),
  marginTop ("0px"), marginBottom ("16px") }

Text.props = { id, text, color, fontSize ("16px"), lineHeight ("1.6"),
  align, marginTop, marginBottom }

Button.props = { id, label, href ("https://..."), bgColor, color, fontSize,
  fontWeight, paddingX, paddingY, borderRadius ("10px"), align }

Image.props = { id, src ("https://..."), alt, width ("100%"), align,
  borderRadius }

Section.props = { id, backgroundColor, paddingX ("32px"), paddingY ("24px"),
  align, children: [<nested items>] }

Container.props = { id, backgroundColor, paddingX, paddingY, maxWidth,
  borderRadius, children: [<nested items>] }

# Layout rules — follow strictly

1. Wrap content in a Section. NEVER place Heading/Text/Button/Image at
   the top level of \`content\`. Always one or more Sections, each
   containing the actual blocks.
2. Group related blocks into the same Section (header section, body
   section, CTA section, footer section).
3. Order within a Section: image (if hero) → heading → text → button.
4. Use whitespace via Section paddingY (24-48px) instead of huge margins
   on individual elements.
5. One Heading per Section is the norm; don't stack multiple H1s.
6. Buttons get their own line — \`align: left\` for action emails,
   \`align: center\` for promo / hero CTAs.

# Theme

The current canvas is ${isDark ? "DARK MODE" : "LIGHT MODE"}.
${
  isDark
    ? `- root.pageBackground: "#000000"
- root.contentBackground: "#0a0a0a"
- Heading color: "#f5f1ff"  (off-white)
- Text color: "#c2c2c2"  (light grey)
- Section backgrounds: "transparent" or "#111111" for accent stripes
- Buttons: vivid (e.g. bgColor "#0099ff" with color "#ffffff")`
    : `- root.pageBackground: "#f6f4fb"
- root.contentBackground: "#ffffff"
- Heading color: "#1a1428"  (deep ink)
- Text color: "#3f3a4f"  (warm grey)
- Section backgrounds: "transparent" or "#f6f4fb" for soft stripes
- Buttons: vivid (e.g. bgColor "#0099ff" with color "#ffffff")`
}

# Output format

Return a single JSON object, no prose, matching:
{
  "root": { "props": { "pageBackground": "...", "contentBackground": "...",
    "contentMaxWidth": "600px", "fontFamily": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    "preheader": "<short inbox preview, max 90 chars>" } },
  "content": [ <Section items only at this level> ]
}

## Edit vs. compose

Look at the user's request. If they're asking for a NEW email (e.g.
"compose a welcome email", "write a promo for our launch"), generate
from scratch.

If they're asking to MODIFY the email already in JSON (e.g. "change the
bg color to red", "make the heading bigger", "add a footer", "rewrite
the body to be more casual"), you MUST:

  - Preserve every existing item's id verbatim. Do not reassign ids.
  - Keep every existing item that the request didn't ask to remove.
  - Touch only the props (or items) the user asked about. If they say
    "change the heading color", change ONLY heading.color — not its
    text, not other components' colors.
  - When adding new items, append them in the natural place (footer at
    the end, hero at the top), inside an existing Section if possible.

When in doubt, lean toward minimal change. The user can always ask
again if you didn't change enough.`;

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "OPENAI_API_KEY not set. Add one to .env.local from platform.openai.com/api-keys.",
      },
      { status: 500 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body must be JSON." },
      { status: 400 },
    );
  }

  const body = parseBody(json);
  if (!body) {
    return NextResponse.json(
      { ok: false, error: "Missing or empty `prompt`." },
      { status: 400 },
    );
  }

  const userMessage = body.currentData
    ? `Current email JSON:\n${JSON.stringify(body.currentData, null, 2)}\n\nUser request:\n${body.prompt}`
    : `User request:\n${body.prompt}`;

  const client = new OpenAI({ apiKey });
  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT(body.isDark ?? false) },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      // Note: gpt-5 doesn't accept `temperature`. We rely on JSON-mode
      // structure + a tight system prompt for consistency.
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "OpenAI request failed.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 },
    );
  }

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    return NextResponse.json(
      { ok: false, error: "OpenAI returned an empty response." },
      { status: 502 },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { ok: false, error: "OpenAI returned invalid JSON." },
      { status: 502 },
    );
  }

  // Loose validation — must have content array and root object.
  const validated = validateAndStampIds(parsed);
  if (!validated) {
    return NextResponse.json(
      { ok: false, error: "Generated email shape was invalid." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, data: validated });
}

/**
 * Walk the LLM output, ensure required structure, and ensure every
 * node has a unique id. Preserves ids the model returned (important
 * for incremental edits — Puck's history uses ids to track items
 * across edits, so re-stamping every time would break undo/redo). New
 * items without an id get a fresh one. Duplicates also get reassigned.
 */
function validateAndStampIds(raw: unknown): EmailData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!r.root || typeof r.root !== "object") return null;
  if (!Array.isArray(r.content)) return null;

  const usedIds = new Set<string>();
  const freshId = (type: string) => {
    let id = `${type.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`;
    while (usedIds.has(id)) {
      id = `${type.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    usedIds.add(id);
    return id;
  };

  type Node = { type: string; props: Record<string, unknown> };

  const stamp = (node: unknown): Node | null => {
    if (!node || typeof node !== "object") return null;
    const n = node as Record<string, unknown>;
    if (typeof n.type !== "string") return null;
    const props =
      n.props && typeof n.props === "object"
        ? { ...(n.props as Record<string, unknown>) }
        : {};
    const incomingId = typeof props.id === "string" ? props.id : undefined;
    if (incomingId && !usedIds.has(incomingId)) {
      usedIds.add(incomingId);
      props.id = incomingId;
    } else {
      props.id = freshId(n.type);
    }
    if (Array.isArray(props.children)) {
      props.children = (props.children as unknown[])
        .map(stamp)
        .filter((c): c is Node => c !== null);
    }
    return { type: n.type, props };
  };

  const content = (r.content as unknown[])
    .map(stamp)
    .filter((c): c is Node => c !== null);

  const rootProps =
    (r.root as { props?: Record<string, unknown> }).props ?? {};

  return {
    root: { props: rootProps as EmailData["root"]["props"] },
    content: content as unknown as EmailData["content"],
  };
}
