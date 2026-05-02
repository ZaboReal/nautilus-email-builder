/**
 * Puck Config — the editor side of the bridge.
 *
 * Each component declares its `fields` (sidebar inputs) and the canvas
 * `render` function (browser-DOM mirror). Default props come from the
 * same place the email primitives consume.
 */

import type { Config } from "@puckeditor/core";
import { ImageSourceField } from "./ImageSourceField";
import {
  ButtonCanvas,
  ContainerCanvas,
  HeadingCanvas,
  ImageCanvas,
  SectionCanvas,
  TextCanvas,
} from "./puckRenderers";
import type {
  ButtonProps,
  ContainerProps,
  HeadingProps,
  ImageProps,
  RootProps,
  SectionProps,
  TextProps,
} from "@/email/schema";
import { defaultRootProps } from "@/email/schema";

/**
 * Pick a readable foreground color (light vs dark) for a given hex
 * background. Used as the auto-color hook so a heading dragged onto a
 * dark canvas comes in white, and onto a light canvas comes in ink.
 */
export function pickReadableColor(
  bg: string | undefined,
  light = "#f5f1ff",
  dark = "#1a1428",
): string {
  if (!bg || typeof bg !== "string") return dark;
  const hex = bg.trim().replace("#", "");
  const expanded =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return dark;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? dark : light;
}

/**
 * Helper: resolve the static default `color` prop to one that contrasts
 * with whatever the canvas's current contentBackground is. Read from
 * Puck's `metadata` (set by EditorBridge from `data.root.props`).
 *
 * Only fires on the `insert` trigger so user edits aren't overwritten.
 */
type ResolveColorParams = {
  trigger: "insert" | "replace" | "load" | "force" | "move";
  metadata: { contentBackground?: string } & Record<string, unknown>;
};

function resolveAutoColor<P extends { color?: string }>(
  data: { props: P & { id?: string } },
  params: ResolveColorParams,
): { props: P & { id?: string } } {
  if (params.trigger !== "insert") return data;
  const fg = pickReadableColor(params.metadata?.contentBackground);
  return { ...data, props: { ...data.props, color: fg } };
}

function resolveAutoMutedColor<P extends { color?: string }>(
  data: { props: P & { id?: string } },
  params: ResolveColorParams,
): { props: P & { id?: string } } {
  if (params.trigger !== "insert") return data;
  const fg = pickReadableColor(
    params.metadata?.contentBackground,
    "#c2c2c2",
    "#3f3a4f",
  );
  return { ...data, props: { ...data.props, color: fg } };
}

const align = {
  type: "radio",
  options: [
    { label: "Left", value: "left" },
    { label: "Center", value: "center" },
    { label: "Right", value: "right" },
  ],
} as const;

const fontWeight5 = {
  type: "select",
  options: [
    { label: "Regular 400", value: "400" },
    { label: "Medium 500", value: "500" },
    { label: "Semibold 600", value: "600" },
    { label: "Bold 700", value: "700" },
    { label: "Extrabold 800", value: "800" },
  ],
} as const;

const fontWeight4 = {
  type: "select",
  options: [
    { label: "Regular 400", value: "400" },
    { label: "Medium 500", value: "500" },
    { label: "Semibold 600", value: "600" },
    { label: "Bold 700", value: "700" },
  ],
} as const;

type SectionWithSlot = SectionProps & {
  children: import("@puckeditor/core").Slot;
};
type ContainerWithSlot = ContainerProps & {
  children: import("@puckeditor/core").Slot;
};

type ComponentMap = {
  Heading: HeadingProps;
  Text: TextProps;
  Button: ButtonProps;
  Image: ImageProps;
  Section: SectionWithSlot;
  Container: ContainerWithSlot;
};

export const puckConfig: Config<ComponentMap, RootProps> = {
  root: {
    fields: {
      pageBackground: { type: "text", label: "Page background" },
      contentBackground: { type: "text", label: "Content background" },
      contentMaxWidth: { type: "text", label: "Content max width" },
      fontFamily: { type: "textarea", label: "Font family" },
      preheader: {
        type: "text",
        label: "Preheader (inbox preview text)",
      },
    },
    defaultProps: defaultRootProps,
  },
  components: {
    Heading: {
      label: "Heading",
      fields: {
        text: { type: "text", label: "Text" },
        level: {
          type: "radio",
          options: [
            { label: "H1", value: 1 },
            { label: "H2", value: 2 },
            { label: "H3", value: 3 },
          ],
        },
        color: { type: "text", label: "Color" },
        fontSize: { type: "text", label: "Font size" },
        fontWeight: { ...fontWeight5, label: "Weight" },
        align: { ...align, label: "Align" },
        marginTop: { type: "text", label: "Margin top" },
        marginBottom: { type: "text", label: "Margin bottom" },
      },
      defaultProps: {
        text: "A heading that lands",
        level: 1,
        color: "#1a1428",
        fontSize: "32px",
        fontWeight: "700",
        align: "left",
        marginTop: "0px",
        marginBottom: "16px",
      },
      // On drop, override the default ink color with one that contrasts
      // the canvas's current background. metadata.contentBackground is
      // set by EditorBridge from data.root.props.contentBackground.
      resolveData: (data, params) =>
        resolveAutoColor<HeadingProps>(
          data as { props: HeadingProps & { id?: string } },
          params as ResolveColorParams,
        ),
      render: HeadingCanvas,
    },
    Text: {
      label: "Text",
      fields: {
        text: { type: "textarea", label: "Text" },
        color: { type: "text", label: "Color" },
        fontSize: { type: "text", label: "Font size" },
        lineHeight: { type: "text", label: "Line height" },
        align: { ...align, label: "Align" },
        marginTop: { type: "text", label: "Margin top" },
        marginBottom: { type: "text", label: "Margin bottom" },
      },
      defaultProps: {
        text: "Write the body of your email here. Keep it short. Keep it scannable.",
        color: "#3f3a4f",
        fontSize: "16px",
        lineHeight: "1.6",
        align: "left",
        marginTop: "0px",
        marginBottom: "16px",
      },
      resolveData: (data, params) =>
        resolveAutoMutedColor<TextProps>(
          data as { props: TextProps & { id?: string } },
          params as ResolveColorParams,
        ),
      render: TextCanvas,
    },
    Button: {
      label: "Button",
      fields: {
        label: { type: "text", label: "Label" },
        href: { type: "text", label: "Link URL" },
        bgColor: { type: "text", label: "Background" },
        color: { type: "text", label: "Text color" },
        fontSize: { type: "text", label: "Font size" },
        fontWeight: { ...fontWeight4, label: "Weight" },
        paddingX: { type: "text", label: "Padding X" },
        paddingY: { type: "text", label: "Padding Y" },
        borderRadius: { type: "text", label: "Radius" },
        align: { ...align, label: "Align" },
      },
      defaultProps: {
        label: "Take action",
        href: "https://example.com",
        bgColor: "#6e3ff5",
        color: "#ffffff",
        fontSize: "15px",
        fontWeight: "600",
        paddingX: "20px",
        paddingY: "12px",
        borderRadius: "10px",
        align: "left",
      },
      render: ButtonCanvas,
    },
    Image: {
      label: "Image",
      fields: {
        src: {
          type: "custom",
          render: ({ value, onChange }) => (
            <ImageSourceField
              value={typeof value === "string" ? value : ""}
              onChange={onChange}
            />
          ),
        },
        alt: { type: "text", label: "Alt text" },
        width: { type: "text", label: "Width (e.g. 600px or 100%)" },
        align: { ...align, label: "Align" },
        borderRadius: { type: "text", label: "Radius" },
      },
      defaultProps: {
        src: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200",
        alt: "Image",
        width: "100%",
        align: "center",
        borderRadius: "8px",
      },
      render: ImageCanvas,
    },
    Section: {
      label: "Section",
      fields: {
        backgroundColor: { type: "text", label: "Background" },
        paddingX: { type: "text", label: "Padding X" },
        paddingY: { type: "text", label: "Padding Y" },
        align: { ...align, label: "Align" },
        children: { type: "slot" },
      },
      defaultProps: {
        backgroundColor: "transparent",
        paddingX: "24px",
        paddingY: "16px",
        align: "left",
        children: [],
      },
      render: ({ backgroundColor, paddingX, paddingY, align, children }) =>
        SectionCanvas({
          backgroundColor,
          paddingX,
          paddingY,
          align,
          children,
        }),
    },
    Container: {
      label: "Container",
      fields: {
        backgroundColor: { type: "text", label: "Background" },
        paddingX: { type: "text", label: "Padding X" },
        paddingY: { type: "text", label: "Padding Y" },
        maxWidth: { type: "text", label: "Max width" },
        borderRadius: { type: "text", label: "Radius" },
        children: { type: "slot" },
      },
      defaultProps: {
        backgroundColor: "#ffffff",
        paddingX: "24px",
        paddingY: "24px",
        maxWidth: "560px",
        borderRadius: "12px",
        children: [],
      },
      render: ({
        backgroundColor,
        paddingX,
        paddingY,
        maxWidth,
        borderRadius,
        children,
      }) =>
        ContainerCanvas({
          backgroundColor,
          paddingX,
          paddingY,
          maxWidth,
          borderRadius,
          children,
        }),
    },
  },
  categories: {
    typography: {
      title: "Typography",
      components: ["Heading", "Text"],
    },
    media: {
      title: "Media",
      components: ["Image"],
    },
    actions: {
      title: "Actions",
      components: ["Button"],
    },
    layout: {
      title: "Layout",
      components: ["Section", "Container"],
    },
  },
};
