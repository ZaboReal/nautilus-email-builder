/**
 * Walks Puck's saved JSON and emits a React tree of email primitives.
 *
 * Used in two places:
 *   - Server-side `/api/send` and `/api/schedule` activity → render() → Resend
 *   - Client-side preview pipeline (the iframe path) → render() → srcDoc
 *
 * Children stored under a slot field (Container.children, Section.children)
 * arrive as arrays of EmailNode and are walked recursively.
 */

import {
  Body,
  Head,
  Html,
  Preview,
  Tailwind,
} from "@react-email/components";
import type { ReactNode } from "react";
import { emailPrimitives } from "./primitives";
import type { EmailData, EmailNode } from "./schema";

function renderNode(node: EmailNode, idx: number): ReactNode {
  const Component = emailPrimitives[node.type];
  if (!Component) return null;

  // Slot children arrive as EmailNode[] in props; replace with React tree.
  const incoming = (node.props ?? {}) as Record<string, unknown>;
  const props: Record<string, unknown> = {};
  let renderedChildren: ReactNode = null;

  for (const [key, value] of Object.entries(incoming)) {
    if (key === "id") continue;
    if (key === "children" && Array.isArray(value)) {
      renderedChildren = (value as EmailNode[]).map((child, i) =>
        renderNode(child, i),
      );
      continue;
    }
    if (key === "puck" || key === "editMode") continue;
    props[key] = value;
  }

  // Use array index as key — Puck-assigned ids are present but not stable
  // across slot moves; idx is fine for an unkeyed top-down render.
  return (
    // @ts-expect-error — props are validated by the Puck config field shapes;
    // a per-component generic narrowing here would add a lot of code for
    // little safety beyond what fields/defaultProps already enforce.
    <Component key={(incoming.id as string) ?? idx} {...props}>
      {renderedChildren}
    </Component>
  );
}

type Props = {
  data: EmailData;
};

export function EmailDocument({ data }: Props) {
  const root = data.root?.props ?? {
    pageBackground: "#f6f4fb",
    contentBackground: "#ffffff",
    contentMaxWidth: "600px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    preheader: "",
  };

  return (
    <Html lang="en">
      <Head />
      {root.preheader ? <Preview>{root.preheader}</Preview> : null}
      <Tailwind>
        <Body
          style={{
            backgroundColor: root.pageBackground,
            fontFamily: root.fontFamily,
            margin: 0,
            padding: "32px 16px",
          }}
        >
          <div
            style={{
              backgroundColor: root.contentBackground,
              maxWidth: root.contentMaxWidth,
              margin: "0 auto",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {data.content.map((node, i) => renderNode(node, i))}
          </div>
        </Body>
      </Tailwind>
    </Html>
  );
}
