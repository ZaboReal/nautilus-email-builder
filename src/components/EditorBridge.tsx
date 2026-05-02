"use client";

import { Puck, createUsePuck, useGetPuck } from "@puckeditor/core";
import "@puckeditor/core/dist/index.css";
import { useEffect } from "react";
import type { Config } from "@puckeditor/core";
import type { EmailData, RootProps } from "@/email/schema";
import { defaultRootProps } from "@/email/schema";

const usePuck = createUsePuck();

type Device = "desktop" | "mobile";

type Props = {
  config: Config;
  data: EmailData;
  device: Device;
  onChange: (data: EmailData) => void;
  /**
   * Reset the canvas to a blank document. Wired through the parent's
   * template-load mechanism so the editor remounts cleanly.
   */
  onReset: () => void;
};

/**
 * Hotkeys + click-outside-deselect: runs inside <Puck>'s context so
 * usePuck/useGetPuck work.
 *
 * Click-outside listens on `click`, NOT `pointerdown`: dnd-kit
 * captures pointerdown to start drags, so a pointerdown handler in
 * the bubble path was disrupting drag-init. `click` fires only on a
 * release with no drag in between → no interference.
 */
function Hotkeys() {
  const back = usePuck((p) => p.history.back);
  const forward = usePuck((p) => p.history.forward);
  const getPuck = useGetPuck();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        back();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        forward();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, forward]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest) return;
      if (
        // Puck's own selection surfaces — let Puck handle clicks here.
        target.closest('[class*="_DraggableComponent_"]') ||
        target.closest('[class*="_ActionBar_"]') ||
        target.closest('[class*="_PuckFields_"]') ||
        target.closest('[class*="_SidebarSection_"]') ||
        target.closest('[class*="_DrawerItem_"]') ||
        target.closest('[class*="_Drawer_"]') ||
        // Interactive controls anywhere in the app.
        target.closest(
          "button, a, input, textarea, select, label, [draggable='true'], [role='dialog']",
        )
      ) {
        return;
      }
      const store = getPuck();
      if (!store.selectedItem) return;
      store.dispatch({ type: "setUi", ui: { itemSelector: null } });
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [getPuck]);

  return null;
}

/**
 * Header strip at the top of the left palette: undo / redo / reset.
 * Lives inside <Puck>'s context so it can read history live.
 */
function LeftPanelHeader({ onReset }: { onReset: () => void }) {
  const back = usePuck((p) => p.history.back);
  const forward = usePuck((p) => p.history.forward);
  const hasPast = usePuck((p) => p.history.hasPast);
  const hasFuture = usePuck((p) => p.history.hasFuture);

  return (
    <div
      className="flex items-center gap-1.5 mb-2 px-1"
      style={{
        paddingBottom: 8,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <button
        type="button"
        onClick={back}
        disabled={!hasPast}
        title="Undo · ⌘Z"
        aria-label="Undo"
        className="glass-button"
        style={{
          width: 32,
          height: 32,
          padding: 0,
          fontSize: 14,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ↶
      </button>
      <button
        type="button"
        onClick={forward}
        disabled={!hasFuture}
        title="Redo · ⌘⇧Z"
        aria-label="Redo"
        className="glass-button"
        style={{
          width: 32,
          height: 32,
          padding: 0,
          fontSize: 14,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ↷
      </button>
      <button
        type="button"
        onClick={onReset}
        title="Clear the canvas"
        className="font-mono text-[10px] uppercase tracking-[0.14em] ml-auto transition-colors hover:opacity-80"
        style={{
          padding: "6px 10px",
          color: "var(--danger)",
          background: "transparent",
          border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        reset
      </button>
    </div>
  );
}

/**
 * The "email page" — the canvas you drag onto IS the rendered email.
 *
 * Desktop mode: the email fills the entire center column (no page-bg
 * frame, no max-width clamp). Best for editing ergonomics — you see
 * the rendered email at workspace scale.
 *
 * Mobile mode: clamped to 380px and centered on the page-bg color, so
 * you can sanity-check how the layout collapses on a phone.
 *
 * The actual sent HTML is rendered separately through @react-email/render
 * with `root.contentMaxWidth` honored, so canvas width doesn't affect
 * delivered emails.
 */
function EmailPageCanvas({ device, root }: { device: Device; root: RootProps }) {
  const cardWidth = device === "desktop" ? "100%" : 380;
  return (
    <div
      className="h-full overflow-auto glass-scroll"
      style={{ background: root.pageBackground }}
    >
      <div
        style={{
          padding: device === "desktop" ? 12 : 24,
          minHeight: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          className="rounded-xl overflow-hidden shadow-[0_20px_60px_-30px_rgba(0,153,255,0.25)] transition-[width] duration-300 ease-out"
          style={{
            background: root.contentBackground,
            width: cardWidth,
            fontFamily: root.fontFamily,
            color: "#1a1428",
            border: "1px solid var(--border)",
          }}
        >
          <Puck.Preview />
        </div>
      </div>
    </div>
  );
}

export function EditorBridge({
  config,
  data,
  device,
  onChange,
  onReset,
}: Props) {
  const root = data.root?.props ?? defaultRootProps;
  return (
    <Puck
      config={config}
      data={data as unknown as Parameters<typeof Puck>[0]["data"]}
      onChange={(d) => onChange(d as unknown as EmailData)}
      iframe={{ enabled: false }}
      height="100%"
      metadata={{
        // Carries the current canvas background to component
        // resolveData hooks so newly inserted Heading/Text default to
        // a readable color (light-on-dark or dark-on-light).
        contentBackground: root.contentBackground,
      }}
    >
      <div
        className="puck-glass"
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "grid",
          gridTemplateColumns: "200px minmax(0, 1fr) 260px",
          gridTemplateRows: "minmax(0, 1fr)",
          gap: 6,
          padding: 6,
        }}
      >
        <div
          className="glass-surface glass-scroll flex flex-col"
          style={{ minHeight: 0, overflowY: "auto", padding: 8 }}
        >
          <LeftPanelHeader onReset={onReset} />
          <Puck.Components />
        </div>
        <div
          className="glass-surface"
          style={{ minHeight: 0, overflow: "hidden" }}
        >
          <EmailPageCanvas device={device} root={root} />
        </div>
        <div
          className="glass-surface glass-scroll"
          style={{ minHeight: 0, overflowY: "auto", padding: 8 }}
        >
          <Puck.Fields />
        </div>
      </div>
      <Hotkeys />
    </Puck>
  );
}
