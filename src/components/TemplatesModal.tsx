"use client";

import { useEffect } from "react";
import { templates, type TemplateId } from "@/builder/templates";
import type { EmailData } from "@/email/schema";

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (data: EmailData) => void;
};

const ORDER: TemplateId[] = ["blank", "welcome", "newsletter", "promo"];

// A small accent strip per template — matches the editorial aesthetic
// without needing real thumbnails.
const TINT: Record<TemplateId, string> = {
  blank: "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.18))",
  welcome: "linear-gradient(90deg, #0099ff, #6e3ff5)",
  newsletter: "linear-gradient(90deg, #1ea672, #0099ff)",
  promo: "linear-gradient(90deg, #ff5577, #ff9966)",
};

export function TemplatesModal({ open, onClose, onPick }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="glass-surface-strong w-full max-w-2xl"
        style={{ padding: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-6">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl leading-none text-[var(--fg)]">
              templates
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              / pick one
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

        <div className="grid grid-cols-2 gap-2">
          {ORDER.map((id, i) => {
            const t = templates[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onPick(t.data);
                  onClose();
                }}
                className="text-left overflow-hidden transition-colors"
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--fg)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-strong)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <div style={{ height: 4, background: TINT[id] }} />
                <div style={{ padding: "16px 18px 18px" }}>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)] mb-2">
                    {String(i + 1).padStart(2, "0")} · {id}
                  </div>
                  <div className="text-base font-medium text-[var(--fg)] mb-1">
                    {t.label}
                  </div>
                  <div className="text-xs leading-relaxed text-[var(--fg-muted)]">
                    {t.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
