/**
 * Three starter templates, stored as Puck `Data` snapshots. Loadable
 * from the Templates modal. The id strings are deliberately stable
 * across reloads so Puck treats reloading the same template as a
 * single history step.
 */

import type { EmailData, EmailNode } from "@/email/schema";
import { defaultRootProps } from "@/email/schema";

const id = (n: string) => `${n}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Recolor a template for dark mode. Swaps page/content backgrounds and
 * walks every node to flip known "ink" text/background colors to their
 * light-on-dark equivalents. Buttons keep their accent fills (a vivid
 * button still pops on a dark canvas) — only the surrounding ink shifts.
 *
 * Called from `onPickTemplate` so the template MATCHES the current
 * theme at the moment of load. Once loaded, the user can override any
 * color from the sidebar.
 */
export function adaptTemplateToTheme(
  data: EmailData,
  isDark: boolean,
): EmailData {
  if (!isDark) return data;

  const inkSwap: Record<string, string> = {
    "#1a1428": "#f5f1ff", // deep ink heading → off-white
    "#3f3a4f": "#c2c2c2", // body grey → light grey
    "#7a7290": "#888888", // muted → muted-light
    "#f6f4fb": "#0a0a0a", // pale lavender section bg → near-black
    "#ffffff": "#0a0a0a", // white section bg → near-black
  };

  const recolor = (node: EmailNode): EmailNode => {
    const props: Record<string, unknown> = { ...node.props };
    for (const key of ["color", "backgroundColor"]) {
      const v = props[key];
      if (typeof v === "string" && inkSwap[v.toLowerCase()]) {
        props[key] = inkSwap[v.toLowerCase()];
      }
    }
    if (Array.isArray(props.children)) {
      props.children = (props.children as EmailNode[]).map(recolor);
    }
    return { ...node, props };
  };

  return {
    ...data,
    root: {
      props: {
        ...data.root.props,
        pageBackground: "#000000",
        contentBackground: "#0a0a0a",
      },
    },
    content: data.content.map(recolor),
  };
}

export type TemplateId = "blank" | "welcome" | "newsletter" | "promo";

export const templates: Record<
  TemplateId,
  { label: string; description: string; data: EmailData }
> = {
  blank: {
    label: "Blank canvas",
    description: "Start from a clean slate.",
    data: {
      root: { props: defaultRootProps },
      content: [],
    },
  },
  welcome: {
    label: "Welcome email",
    description: "Onboarding greeting with a primary CTA.",
    data: {
      root: { props: defaultRootProps },
      content: [
        {
          type: "Section",
          props: {
            id: id("Section"),
            backgroundColor: "transparent",
            paddingX: "32px",
            paddingY: "24px",
            align: "left",
            children: [
              {
                type: "Heading",
                props: {
                  id: id("Heading"),
                  text: "Welcome aboard 👋",
                  level: 1,
                  color: "#1a1428",
                  fontSize: "32px",
                  fontWeight: "700",
                  align: "left",
                  marginTop: "0px",
                  marginBottom: "12px",
                },
              },
              {
                type: "Text",
                props: {
                  id: id("Text"),
                  text: "We're glad you're here. You're all set up. Take a look around and let us know if anything feels off.",
                  color: "#3f3a4f",
                  fontSize: "16px",
                  lineHeight: "1.6",
                  align: "left",
                  marginTop: "0px",
                  marginBottom: "20px",
                },
              },
              {
                type: "Button",
                props: {
                  id: id("Button"),
                  label: "Open the app",
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
              },
            ],
          },
        },
      ],
    },
  },
  newsletter: {
    label: "Newsletter",
    description: "Two-section monthly update with image.",
    data: {
      root: { props: defaultRootProps },
      content: [
        {
          type: "Section",
          props: {
            id: id("Section"),
            backgroundColor: "transparent",
            paddingX: "32px",
            paddingY: "32px",
            align: "left",
            children: [
              {
                type: "Heading",
                props: {
                  id: id("Heading"),
                  text: "What we shipped this month",
                  level: 1,
                  color: "#1a1428",
                  fontSize: "28px",
                  fontWeight: "700",
                  align: "left",
                  marginTop: "0px",
                  marginBottom: "8px",
                },
              },
              {
                type: "Text",
                props: {
                  id: id("Text"),
                  text: "May 2026 · the highlights from the past four weeks.",
                  color: "#7a7290",
                  fontSize: "14px",
                  lineHeight: "1.6",
                  align: "left",
                  marginTop: "0px",
                  marginBottom: "20px",
                },
              },
              {
                type: "Image",
                props: {
                  id: id("Image"),
                  src: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200",
                  alt: "Workspace photo",
                  width: "100%",
                  align: "center",
                  borderRadius: "8px",
                },
              },
            ],
          },
        },
        {
          type: "Section",
          props: {
            id: id("Section"),
            backgroundColor: "#f6f4fb",
            paddingX: "32px",
            paddingY: "24px",
            align: "left",
            children: [
              {
                type: "Heading",
                props: {
                  id: id("Heading"),
                  text: "Read the full notes",
                  level: 2,
                  color: "#1a1428",
                  fontSize: "20px",
                  fontWeight: "600",
                  align: "left",
                  marginTop: "0px",
                  marginBottom: "12px",
                },
              },
              {
                type: "Text",
                props: {
                  id: id("Text"),
                  text: "Three new features, two bug fixes, and a new keyboard shortcut you'll actually use.",
                  color: "#3f3a4f",
                  fontSize: "15px",
                  lineHeight: "1.6",
                  align: "left",
                  marginTop: "0px",
                  marginBottom: "16px",
                },
              },
              {
                type: "Button",
                props: {
                  id: id("Button"),
                  label: "Read the changelog",
                  href: "https://example.com/changelog",
                  bgColor: "#1a1428",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: "600",
                  paddingX: "16px",
                  paddingY: "10px",
                  borderRadius: "8px",
                  align: "left",
                },
              },
            ],
          },
        },
      ],
    },
  },
  promo: {
    label: "Promo / launch",
    description: "Bold hero with discount call-out.",
    data: {
      root: {
        props: { ...defaultRootProps, pageBackground: "#1a1428" },
      },
      content: [
        {
          type: "Section",
          props: {
            id: id("Section"),
            backgroundColor: "#1a1428",
            paddingX: "32px",
            paddingY: "48px",
            align: "center",
            children: [
              {
                type: "Heading",
                props: {
                  id: id("Heading"),
                  text: "30% off, this weekend only",
                  level: 1,
                  color: "#ffffff",
                  fontSize: "36px",
                  fontWeight: "800",
                  align: "center",
                  marginTop: "0px",
                  marginBottom: "12px",
                },
              },
              {
                type: "Text",
                props: {
                  id: id("Text"),
                  text: "Use code SPRING30 at checkout. Ends Sunday at midnight.",
                  color: "#cbc2e0",
                  fontSize: "16px",
                  lineHeight: "1.6",
                  align: "center",
                  marginTop: "0px",
                  marginBottom: "24px",
                },
              },
              {
                type: "Button",
                props: {
                  id: id("Button"),
                  label: "Shop the sale",
                  href: "https://example.com/sale",
                  bgColor: "#ffffff",
                  color: "#1a1428",
                  fontSize: "15px",
                  fontWeight: "700",
                  paddingX: "24px",
                  paddingY: "14px",
                  borderRadius: "12px",
                  align: "center",
                },
              },
            ],
          },
        },
      ],
    },
  },
};

export const defaultTemplate: EmailData = templates.welcome.data;
