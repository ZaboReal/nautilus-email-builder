"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type ToastTone = "info" | "success" | "error";
type Toast = { id: number; tone: ToastTone; title: string; body?: string };

type ToastApi = {
  push: (t: Omit<Toast, "id">) => void;
};

const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("ToastProvider missing");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    setToasts((prev) => [...prev, { ...t, id: Date.now() + Math.random() }]);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            dismiss={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(dismiss, 5000);
    return () => clearTimeout(t);
  }, [dismiss]);
  const tint =
    toast.tone === "success"
      ? "border-l-4 border-l-[var(--success)]"
      : toast.tone === "error"
        ? "border-l-4 border-l-[var(--danger)]"
        : "border-l-4 border-l-[var(--accent)]";
  return (
    <div
      className={`glass-surface-strong px-4 py-3 min-w-[260px] max-w-sm pointer-events-auto ${tint}`}
      role="status"
    >
      <div className="text-sm font-semibold text-[var(--fg)]">{toast.title}</div>
      {toast.body ? (
        <div className="text-xs mt-1 text-[var(--fg-muted)]">{toast.body}</div>
      ) : null}
    </div>
  );
}
