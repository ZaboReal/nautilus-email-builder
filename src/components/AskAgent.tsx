"use client";

import { useEffect, useRef, useState } from "react";
import type { EmailData } from "@/email/schema";
import { GlassButton, GlassSurface } from "./glass/Glass";
import { useToast } from "./glass/Toast";

type Props = {
  open: boolean;
  onClose: () => void;
  currentData: EmailData;
  isDark: boolean;
  onApply: (data: EmailData) => void;
};

const SUGGESTIONS = [
  "welcome email for a new user named Jordan",
  "monthly newsletter with three product updates",
  "limited-time 30% off promo, ends Sunday",
  "thank you for upgrading + link to docs",
];

export function AskAgent({
  open,
  onClose,
  currentData,
  isDark,
  onApply,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function submit() {
    if (loading) return;
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast.push({ tone: "error", title: "Type a request first." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          currentData,
          isDark,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: EmailData;
        error?: string;
      };
      if (!json.ok || !json.data) {
        toast.push({
          tone: "error",
          title: "Couldn't compose",
          body: json.error,
        });
        return;
      }
      onApply(json.data);
      toast.push({ tone: "success", title: "Composed" });
      setPrompt("");
      onClose();
    } catch (e) {
      toast.push({
        tone: "error",
        title: "Network error",
        body: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center p-6 pt-24"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <GlassSurface
        strong
        className="w-full max-w-2xl"
        style={{ padding: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-5">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl leading-none text-[var(--fg)]">
              ask
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              / compose with ai
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            esc
          </button>
        </div>

        <textarea
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Format an email to a coworker named Sam, thanking them for shipping the migration this week. Keep it warm, short, end with a CTA to read the postmortem."
          rows={4}
          className="glass-input w-full resize-none p-3"
          style={{ fontFamily: "var(--font-geist-sans)", fontSize: 14 }}
          disabled={loading}
        />

        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPrompt(s)}
              className="glass-button"
              style={{ padding: "4px 10px", fontSize: 10 }}
              disabled={loading}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
            ⌘↵ to compose · esc to close
          </div>
          <GlassButton
            variant="accent"
            onClick={submit}
            disabled={loading}
            style={{ padding: "8px 16px" }}
          >
            {loading ? "composing…" : "compose"}
          </GlassButton>
        </div>
      </GlassSurface>
    </div>
  );
}
