"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { puckConfig } from "@/builder/puckConfig";
import { adaptTemplateToTheme, defaultTemplate, templates } from "@/builder/templates";
import { AskAgent } from "@/components/AskAgent";
import { EditorBridge } from "@/components/EditorBridge";
import { ScheduledDrawer } from "@/components/ScheduledDrawer";
import { TemplatesModal } from "@/components/TemplatesModal";
import { Toolbar } from "@/components/Toolbar";
import { ToastProvider } from "@/components/glass/Toast";
import { usePersistedData } from "@/lib/usePersistedData";
import type { EmailData } from "@/email/schema";

type Device = "desktop" | "mobile";

function App() {
  const { data, setData, ready } = usePersistedData(defaultTemplate);
  const [device, setDevice] = useState<Device>("desktop");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showScheduled, setShowScheduled] = useState(false);
  const [showAsk, setShowAsk] = useState(false);
  const [isDark, setIsDark] = useState(true);
  // Bumped when data is replaced externally (template pick). Used as
  // the editor's React key so Puck remounts cleanly with the new data.
  // We tried dispatching `setData` into Puck's store instead — that
  // swapped the document but left dnd-kit unable to drop new items.
  // Remount is the heavier but reliable approach.
  const [editorGen, setEditorGen] = useState(0);

  // Persist the theme choice. The class is applied via a React-controlled
  // wrapper around the app (see `className` on the root <div> below) so
  // there's no conflict with layout.tsx's <html> markup.
  useEffect(() => {
    try {
      localStorage.setItem("nautilus.theme", isDark ? "dark" : "light");
    } catch {
      // ignore
    }
  }, [isDark]);

  useEffect(() => {
    // One-shot hydrate of the theme from localStorage / system preference.
    // External-system sync; SSR can't read localStorage so a lazy
    // initializer would mismatch. See note in usePersistedData.
    try {
      const saved = localStorage.getItem("nautilus.theme");
      if (saved === "light") {
        setIsDark(false);
      }
    } catch {
      // ignore
    }
  }, []);

  // ⌘K → templates · ⌘J → ask agent
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const k = e.key.toLowerCase();
      if (k === "k") {
        e.preventDefault();
        setShowTemplates((v) => !v);
      } else if (k === "j") {
        e.preventDefault();
        setShowAsk((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onChange = useCallback(
    (next: EmailData) => {
      setData(next);
    },
    [setData],
  );

  const onPickTemplate = useCallback(
    (next: EmailData) => {
      // Recolor the template to match the active theme at load time.
      // The user can still override any color from the sidebar.
      const themed = adaptTemplateToTheme(next, isDark);
      setData(themed);
      setEditorGen((g) => g + 1);
    },
    [setData, isDark],
  );

  const onAgentApply = useCallback(
    (next: EmailData) => {
      // Agent output is already theme-aware (we pass `isDark` to the
      // model in the prompt), so no `adaptTemplateToTheme` here.
      setData(next);
      setEditorGen((g) => g + 1);
    },
    [setData],
  );

  const onReset = useCallback(() => {
    // Same path as picking the Blank template — clears the canvas and
    // remounts Puck cleanly with fresh dnd-kit state.
    const themed = adaptTemplateToTheme(templates.blank.data, isDark);
    setData(themed);
    setEditorGen((g) => g + 1);
  }, [setData, isDark]);

  // Don't mount Puck until persisted data has loaded — avoids a
  // load-then-overwrite flicker. The `key` bumps on template loads so
  // Puck remounts with the new initial data.
  const editor = useMemo(() => {
    if (!ready) return null;
    return (
      <EditorBridge
        key={editorGen}
        config={puckConfig}
        data={data}
        device={device}
        onChange={onChange}
        onReset={onReset}
      />
    );
    // `data` intentionally NOT in deps — we don't want to recreate the
    // EditorBridge on every keystroke (Puck would lose internal state).
    // Puck owns its live state once mounted; we read `data` only at
    // mount, and `editorGen` is the explicit channel for forced reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, editorGen, device, onChange, onReset]);

  return (
    <div className={`app-shell h-screen flex flex-col ${isDark ? "dark" : ""}`}>
      {/* ToastProvider lives INSIDE .app-shell so its toasts and modals
          inherit the .dark cascade. With it outside, var(--fg) etc.
          would always resolve to the light-mode tokens regardless of
          the toggle state. */}
      <ToastProvider>
        <Toolbar
          data={data}
          device={device}
          onDeviceChange={setDevice}
          onOpenTemplates={() => setShowTemplates(true)}
          onOpenScheduled={() => setShowScheduled(true)}
          onOpenAsk={() => setShowAsk(true)}
          isDark={isDark}
          onToggleDark={() => setIsDark((v) => !v)}
        />
        <div className="flex-1 p-3 min-h-0">
          <div className="glass-surface relative h-full min-h-0 overflow-hidden">
            {editor}
          </div>
        </div>

        <TemplatesModal
          open={showTemplates}
          onClose={() => setShowTemplates(false)}
          onPick={onPickTemplate}
        />
        <ScheduledDrawer
          open={showScheduled}
          onClose={() => setShowScheduled(false)}
        />
        <AskAgent
          open={showAsk}
          onClose={() => setShowAsk(false)}
          currentData={data}
          isDark={isDark}
          onApply={onAgentApply}
        />
      </ToastProvider>
    </div>
  );
}

export default function Page() {
  return <App />;
}
