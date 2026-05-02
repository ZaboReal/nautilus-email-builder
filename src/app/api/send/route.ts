import { NextResponse } from "next/server";
import { Resend } from "resend";
import { extractInlineImages } from "@/email/inlineImages";
import { renderEmailHtml } from "@/email/renderEmailHtml";
import type { EmailData } from "@/email/schema";

export const runtime = "nodejs";

type SendBody = {
  data: EmailData;
  subject: string;
  to: string;
};

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function parseBody(raw: unknown): SendBody | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.subject !== "string") return null;
  if (typeof r.to !== "string") return null;
  if (!r.data || typeof r.data !== "object") return null;
  const d = r.data as Record<string, unknown>;
  if (!Array.isArray(d.content)) return null;
  return r as SendBody;
}

export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "RESEND_API_KEY not set. Add one to .env.local from resend.com/api-keys.",
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
      { ok: false, error: "Missing or malformed `data`, `subject`, or `to`." },
      { status: 400 },
    );
  }

  if (!body.subject.trim()) {
    return NextResponse.json(
      { ok: false, error: "Subject is required." },
      { status: 400 },
    );
  }

  if (!isValidEmail(body.to)) {
    return NextResponse.json(
      { ok: false, error: `"${body.to}" doesn't look like an email address.` },
      { status: 400 },
    );
  }

  let html: string;
  try {
    html = await renderEmailHtml(body.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown render error.";
    return NextResponse.json(
      { ok: false, error: `Render failed: ${message}` },
      { status: 500 },
    );
  }

  // Pull out base64 inline images; ship them as CID attachments so
  // they render in the recipient's inbox without "display images" gates.
  const { html: processedHtml, attachments } = extractInlineImages(html);

  const resend = new Resend(apiKey);
  try {
    const result = await resend.emails.send({
      from,
      to: body.to,
      subject: body.subject,
      html: processedHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    if (result.error) {
      return NextResponse.json(
        { ok: false, error: result.error.message ?? "Resend rejected the send." },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, id: result.data?.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown send error.";
    return NextResponse.json(
      { ok: false, error: `Send failed: ${message}` },
      { status: 502 },
    );
  }
}
