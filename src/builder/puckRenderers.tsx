/**
 * Plain-HTML renderers for the Puck canvas. These are an *approximation*
 * of how the email will look — the iframe-driven preview is the
 * truthful render. We deliberately don't mount React Email primitives
 * here because their <table>/MSO output doesn't survive a normal
 * browser DOM mount (especially Html/Head/Body and the Container/Section
 * table wrappers).
 */

import { createUsePuck, useGetPuck } from "@puckeditor/core";
import { useCallback, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type {
  ButtonProps,
  ContainerProps,
  HeadingProps,
  ImageProps,
  SectionProps,
  TextProps,
} from "@/email/schema";

const usePuck = createUsePuck();

function useIsSelected(id: string | undefined): boolean {
  const selectedId = usePuck((p) => p.selectedItem?.props?.id);
  return !!id && selectedId === id;
}

type SlotComponent = (props?: { style?: CSSProperties }) => ReactNode;

export function HeadingCanvas(props: HeadingProps) {
  const Tag = (`h${props.level}` as "h1" | "h2" | "h3");
  return (
    <Tag
      style={{
        color: props.color,
        fontSize: props.fontSize,
        fontWeight: Number(props.fontWeight),
        textAlign: props.align,
        margin: `${props.marginTop} 0 ${props.marginBottom} 0`,
        lineHeight: 1.2,
      }}
    >
      {props.text}
    </Tag>
  );
}

export function TextCanvas(props: TextProps) {
  return (
    <p
      style={{
        color: props.color,
        fontSize: props.fontSize,
        lineHeight: props.lineHeight,
        textAlign: props.align,
        margin: `${props.marginTop} 0 ${props.marginBottom} 0`,
      }}
    >
      {props.text}
    </p>
  );
}

export function ButtonCanvas(props: ButtonProps) {
  return (
    <div style={{ textAlign: props.align, margin: "8px 0" }}>
      <a
        href={props.href || "#"}
        onClick={(e) => e.preventDefault()}
        style={{
          backgroundColor: props.bgColor,
          color: props.color,
          fontSize: props.fontSize,
          fontWeight: Number(props.fontWeight),
          padding: `${props.paddingY} ${props.paddingX}`,
          borderRadius: props.borderRadius,
          textDecoration: "none",
          display: "inline-block",
        }}
      >
        {props.label}
      </a>
    </div>
  );
}

type Corner = "nw" | "ne" | "sw" | "se";

const CORNER_CURSOR: Record<Corner, string> = {
  nw: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  se: "nwse-resize",
};

const CORNER_POS: Record<Corner, CSSProperties> = {
  nw: { top: -7, left: -7 },
  ne: { top: -7, right: -7 },
  sw: { bottom: -7, left: -7 },
  se: { bottom: -7, right: -7 },
};

export function ImageCanvas(props: ImageProps & { id?: string }) {
  const id = props.id;
  const isSelected = useIsSelected(id);
  const getPuck = useGetPuck();
  const [dragWidth, setDragWidth] = useState<string | null>(null);

  const effectiveWidth = dragWidth ?? props.width;

  // Block-level wrapper with explicit width + margin-auto handles
  // alignment robustly across image sizes. The earlier inline-block
  // approach was unreliable because intrinsic image dimensions could
  // make the wrapper full-width, leaving text-align nothing to center
  // against.
  const margin =
    props.align === "center"
      ? "0 auto"
      : props.align === "right"
        ? "0 0 0 auto"
        : "0";

  // Corner-aware drag math: dragging a left corner moves left, dragging
  // a right corner moves right. Both grow the image when dragged
  // outward, shrink when dragged inward.
  const onResizeStart = useCallback(
    (corner: Corner) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // The handle is a child of the image-cell wrapper now (the
      // outer relative div). The container is therefore wrapper.parent.
      const wrapper = (e.currentTarget as HTMLElement).parentElement;
      const imgEl = wrapper?.querySelector("img") as HTMLImageElement | null;
      if (!imgEl || !wrapper) return;

      const startX = e.clientX;
      const startWidth = imgEl.getBoundingClientRect().width;
      const containerWidth =
        wrapper.parentElement?.getBoundingClientRect().width ?? 800;
      const dirX = corner === "ne" || corner === "se" ? 1 : -1;

      let lastWidth = `${Math.round(startWidth)}px`;

      function onMove(ev: PointerEvent) {
        const dx = (ev.clientX - startX) * dirX;
        const next = Math.max(
          40,
          Math.min(containerWidth, startWidth + dx),
        );
        lastWidth = `${Math.round(next)}px`;
        setDragWidth(lastWidth);
      }
      function onUp() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (id) {
          const store = getPuck();
          const sel = store.getSelectorForId(id);
          const item = store.getItemById(id);
          if (sel && item) {
            store.dispatch({
              type: "replace",
              destinationIndex: sel.index,
              destinationZone: sel.zone,
              data: {
                ...item,
                props: { ...item.props, width: lastWidth },
              },
            });
          }
        }
        setDragWidth(null);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [getPuck, id],
  );

  const corners: Corner[] = ["nw", "ne", "sw", "se"];

  return (
    <div
      style={{
        position: "relative",
        display: "block",
        width: effectiveWidth,
        maxWidth: "100%",
        margin,
        outline: isSelected ? "2px solid var(--accent)" : undefined,
        outlineOffset: isSelected ? 2 : undefined,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={props.src}
        alt={props.alt}
        draggable={false}
        style={{
          display: "block",
          width: "100%",
          borderRadius: props.borderRadius,
          userSelect: "none",
          pointerEvents: "none",
        }}
      />
      {isSelected
        ? corners.map((corner) => (
            <span
              key={corner}
              onPointerDown={onResizeStart(corner)}
              aria-label={`Resize image (${corner})`}
              style={{
                position: "absolute",
                ...CORNER_POS[corner],
                width: 12,
                height: 12,
                background: "#fff",
                border: "2px solid var(--accent)",
                borderRadius: 3,
                cursor: CORNER_CURSOR[corner],
                zIndex: 1000,
                touchAction: "none",
                boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
              }}
            />
          ))
        : null}
      {isSelected && dragWidth ? (
        <span
          style={{
            position: "absolute",
            top: -28,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "2px 8px",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 11,
            fontFamily: "ui-monospace, monospace",
            borderRadius: 4,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 1001,
          }}
        >
          {dragWidth}
        </span>
      ) : null}
    </div>
  );
}

export function ContainerCanvas(
  props: ContainerProps & { children: SlotComponent },
) {
  const Slot = props.children;
  return (
    <div
      style={{
        backgroundColor: props.backgroundColor,
        padding: `${props.paddingY} ${props.paddingX}`,
        maxWidth: props.maxWidth,
        borderRadius: props.borderRadius,
        margin: "0 auto",
      }}
    >
      <Slot style={{ minHeight: 40 }} />
    </div>
  );
}

export function SectionCanvas(
  props: SectionProps & { children: SlotComponent },
) {
  const Slot = props.children;
  return (
    <div
      style={{
        backgroundColor: props.backgroundColor,
        padding: `${props.paddingY} ${props.paddingX}`,
        textAlign: props.align,
      }}
    >
      <Slot style={{ minHeight: 40 }} />
    </div>
  );
}
