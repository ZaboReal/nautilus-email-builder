"use client";

import { useEffect, useState } from "react";
import type { ScheduledRow } from "@/lib/scheduledStore";
import { GlassSurface } from "./glass/Glass";
import { useToast } from "./glass/Toast";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ScheduledDrawer({ open, onClose }: Props) {
  const [rows, setRows] = useState<ScheduledRow[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule", { cache: "no-store" });
      const json = (await res.json()) as { ok: boolean; rows?: ScheduledRow[]; error?: string };
      if (json.ok && json.rows) setRows(json.rows);
      else if (json.error) toast.push({ tone: "error", title: "Couldn't load", body: json.error });
    } catch (e) {
      toast.push({
        tone: "error",
        title: "Couldn't load schedule",
        body: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function clear(row: ScheduledRow) {
    try {
      const res = await fetch(`/api/schedule/${row.id}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (json.ok) {
        toast.push({
          tone: "success",
          title: row.status === "pending" ? "Cancelled" : "Cleared",
        });
        refresh();
      } else {
        toast.push({
          tone: "error",
          title: "Couldn't clear",
          body: json.error,
        });
      }
    } catch (e) {
      toast.push({
        tone: "error",
        title: "Network error",
        body: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function clearAll(scope: "all" | "completed") {
    const targets = rows.filter((r) =>
      scope === "all" ? true : r.status !== "pending",
    );
    if (targets.length === 0) return;
    await Promise.all(
      targets.map((r) =>
        fetch(`/api/schedule/${r.id}`, { method: "DELETE" }).catch(() => null),
      ),
    );
    toast.push({
      tone: "success",
      title: scope === "all" ? "Cleared queue" : "Cleared completed",
    });
    refresh();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex justify-end"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <GlassSurface
        strong
        className="relative h-full w-[420px] max-w-[90vw] m-3 flex flex-col overflow-hidden"
        style={{ padding: 24, gap: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl leading-none text-[var(--fg)]">
              scheduled
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              / queue
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
        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
            {loading
              ? "refreshing"
              : `${String(rows.length).padStart(2, "0")} · auto-refresh`}
          </div>
          {rows.length > 0 ? (
            <div className="flex items-center gap-2">
              {rows.some((r) => r.status !== "pending") ? (
                <button
                  type="button"
                  onClick={() => clearAll("completed")}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
                >
                  clear completed
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => clearAll("all")}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--danger)] hover:opacity-80 transition-opacity"
              >
                clear all
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex-1 overflow-auto glass-scroll flex flex-col gap-2 pr-1 -mr-1">
          {rows.length === 0 ? (
            <div className="text-sm text-[var(--fg-muted)] mt-4 leading-relaxed">
              Nothing scheduled. Pick a date in the toolbar and hit{" "}
              <span className="font-mono text-[var(--fg)]">schedule</span>.
            </div>
          ) : (
            rows.map((r) => (
              <Row key={r.id} row={r} onClear={() => clear(r)} />
            ))
          )}
        </div>
      </GlassSurface>
    </div>
  );
}

function statusTint(status: ScheduledRow["status"]): string {
  switch (status) {
    case "sent":
      return "var(--success)";
    case "failed":
      return "var(--danger)";
    case "cancelled":
      return "rgba(255,255,255,0.25)";
    default:
      return "var(--accent)";
  }
}

function Row({ row, onClear }: { row: ScheduledRow; onClear: () => void }) {
  const when = new Date(row.scheduledFor);
  const isPending = row.status === "pending";
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderLeft: `2px solid ${statusTint(row.status)}`,
        borderRadius: 8,
        padding: "12px 14px",
        background: "var(--surface-2)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)] mb-1">
            {row.status}
          </div>
          <div className="text-sm font-medium text-[var(--fg)] truncate mb-0.5">
            {row.subject || "(no subject)"}
          </div>
          <div className="text-xs text-[var(--fg-muted)] truncate">
            → {row.to}
          </div>
          <div className="font-mono text-[10px] text-[var(--fg-muted)] mt-1.5">
            {when.toLocaleString()}
          </div>
          {row.error ? (
            <div className="text-xs text-[var(--danger)] mt-1 break-words">
              {row.error}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onClear}
            aria-label={isPending ? "Cancel and remove" : "Clear from list"}
            title={isPending ? "Cancel and remove" : "Clear from list"}
            className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors leading-none"
            style={{ fontSize: 16, padding: 2 }}
          >
            ×
          </button>
          {isPending ? (
            <button
              type="button"
              onClick={onClear}
              className="glass-button"
              style={{ padding: "4px 10px", fontSize: 10 }}
            >
              cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
