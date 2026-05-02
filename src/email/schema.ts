/**
 * The single source of truth for component props.
 *
 * Three things are derived from these schemas:
 *   1. Puck `fields` definitions (sidebar editors).
 *   2. React Email primitive prop types (canonical email render path).
 *   3. Plain-HTML renderer prop types for the editor canvas.
 *
 * NOTE: we share the prop *schema*, not the *render path*. React Email
 * primitives compile to <table>-based MSO-conditional HTML and don't
 * survive a direct browser DOM mount. The editor canvas uses
 * approximate plain-HTML mirrors; the iframe preview (driven by
 * @react-email/render) is the truthful preview.
 */

import { z } from "zod";

const align = z.enum(["left", "center", "right"]);
const cssLength = z.string(); // accept any valid CSS length string

export const headingSchema = z.object({
  text: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  color: z.string(),
  fontSize: cssLength,
  fontWeight: z.enum(["400", "500", "600", "700", "800"]),
  align,
  marginTop: cssLength,
  marginBottom: cssLength,
});
export type HeadingProps = z.infer<typeof headingSchema>;

export const textSchema = z.object({
  text: z.string(),
  color: z.string(),
  fontSize: cssLength,
  lineHeight: z.string(),
  align,
  marginTop: cssLength,
  marginBottom: cssLength,
});
export type TextProps = z.infer<typeof textSchema>;

export const buttonSchema = z.object({
  label: z.string(),
  href: z.string(),
  bgColor: z.string(),
  color: z.string(),
  fontSize: cssLength,
  fontWeight: z.enum(["400", "500", "600", "700"]),
  paddingX: cssLength,
  paddingY: cssLength,
  borderRadius: cssLength,
  align,
});
export type ButtonProps = z.infer<typeof buttonSchema>;

export const imageSchema = z.object({
  src: z.string(),
  alt: z.string(),
  width: cssLength,
  align,
  borderRadius: cssLength,
});
export type ImageProps = z.infer<typeof imageSchema>;

/**
 * Container and Section both accept a `children` slot. The slot value is
 * an array of ComponentDataOptionalId at runtime in Puck; we treat it as
 * an opaque array here to avoid circular Zod refs.
 */
export const containerSchema = z.object({
  backgroundColor: z.string(),
  paddingX: cssLength,
  paddingY: cssLength,
  maxWidth: cssLength,
  borderRadius: cssLength,
  // children is a Puck slot — left untyped at the schema layer
});
export type ContainerProps = z.infer<typeof containerSchema>;

export const sectionSchema = z.object({
  backgroundColor: z.string(),
  paddingX: cssLength,
  paddingY: cssLength,
  align,
});
export type SectionProps = z.infer<typeof sectionSchema>;

export const rootSchema = z.object({
  pageBackground: z.string(),
  contentBackground: z.string(),
  contentMaxWidth: cssLength,
  fontFamily: z.string(),
  preheader: z.string(),
});
export type RootProps = z.infer<typeof rootSchema>;

export const componentNames = [
  "Heading",
  "Text",
  "Button",
  "Image",
  "Container",
  "Section",
] as const;
export type ComponentName = (typeof componentNames)[number];

/** Shape of a node as stored in Puck `data.content` (and in slot arrays). */
export type EmailNode = {
  type: ComponentName;
  props: Record<string, unknown> & { id?: string };
};

/** Top-level Puck data we persist. */
export type EmailData = {
  content: EmailNode[];
  root: { props: RootProps };
  zones?: Record<string, EmailNode[]>;
};

export const defaultRootProps: RootProps = {
  pageBackground: "#f6f4fb",
  contentBackground: "#ffffff",
  contentMaxWidth: "600px",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  preheader: "",
};
