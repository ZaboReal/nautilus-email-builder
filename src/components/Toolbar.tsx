"use client";

import { useEffect, useRef, useState } from "react";
import {
  GlassButton,
  GlassIconButton,
  GlassInput,
  GlassSurface,
} from "./glass/Glass";
import { useToast } from "./glass/Toast";
import type { EmailData } from "@/email/schema";

type Device = "desktop" | "mobile";

type Props = {
  data: EmailData;
  device: Device;
  onDeviceChange: (d: Device) => void;
  onOpenTemplates: () => void;
  onOpenScheduled: () => void;
  onOpenAsk: () => void;
  isDark: boolean;
  onToggleDark: () => void;
};

/**
 * Visual hierarchy in the toolbar:
 *
 *   primary     — `ask` (AI compose) and `send` are the two big actions
 *   secondary   — schedule (popover-triggered), templates, scheduled list
 *   tertiary    — undo/redo, theme, device → small icon cluster, no labels
 *
 * The To / Subject inputs sit immediately after the wordmark because
 * they're "the email's metadata" and read like a single phrase.
 */
export function Toolbar({
  data,
  device,
  onDeviceChange,
  onOpenTemplates,
  onOpenScheduled,
  onOpenAsk,
  isDark,
  onToggleDark,
}: Props) {
  const toast = useToast();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [sending, setSending] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [schedulePopoverOpen, setSchedulePopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close popover on outside click / esc
  useEffect(() => {
    if (!schedulePopoverOpen) return;
    function onPointer(e: PointerEvent) {
      if (!popoverRef.current?.contains(e.target as Node)) {
        setSchedulePopoverOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSchedulePopoverOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [schedulePopoverOpen]);

  // Cmd+Enter triggers send.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, subject, data]);

  async function send() {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, subject, to }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        id?: string;
        error?: string;
      };
      if (json.ok) {
        toast.push({
          tone: "success",
          title: "Sent",
          body: json.id ? `Resend id: ${json.id}` : `Delivered to ${to}.`,
        });
      } else {
        toast.push({ tone: "error", title: "Send failed", body: json.error });
      }
    } catch (e) {
      toast.push({
        tone: "error",
        title: "Network error",
        body: e instanceof Error ? e.message : "Unknown",
      });
    } finally {
      setSending(false);
    }
  }

  async function schedule() {
    if (scheduling) return;
    if (!scheduleAt) {
      toast.push({ tone: "error", title: "Pick a date and time first." });
      return;
    }
    const when = new Date(scheduleAt);
    if (Number.isNaN(when.getTime())) {
      toast.push({ tone: "error", title: "That date didn't parse." });
      return;
    }
    if (when.getTime() <= Date.now() + 5_000) {
      toast.push({
        tone: "error",
        title: "Pick a future time",
        body: "Schedule must be at least a few seconds out.",
      });
      return;
    }
    setScheduling(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          data,
          scheduledFor: when.toISOString(),
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        id?: string;
        error?: string;
      };
      if (json.ok) {
        toast.push({
          tone: "success",
          title: "Scheduled",
          body: `Delivers ${when.toLocaleString()}.`,
        });
        setScheduleAt("");
        setSchedulePopoverOpen(false);
      } else {
        toast.push({
          tone: "error",
          title: "Schedule failed",
          body: json.error,
        });
      }
    } catch (e) {
      toast.push({
        tone: "error",
        title: "Network error",
        body: e instanceof Error ? e.message : "Unknown",
      });
    } finally {
      setScheduling(false);
    }
  }

  return (
    <GlassSurface
      strong
      className="mx-3 mt-3 px-4 py-2.5 flex items-center gap-2.5 flex-nowrap"
    >
      {/* Brand */}
      <div className="flex items-baseline gap-1.5 mr-1 select-none shrink-0">
        <div className="font-display text-xl leading-none text-[var(--fg)]">
          nautilus
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">
          / email
        </div>
      </div>

      <Divider />

      {/* Recipient + Subject — flex-grow to fill middle */}
      <GlassInput
        type="email"
        placeholder="to"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="w-40"
        style={{ paddingTop: 6, paddingBottom: 6 }}
      />
      <GlassInput
        type="text"
        placeholder="subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="flex-1 min-w-[140px]"
        style={{ paddingTop: 6, paddingBottom: 6 }}
      />

      <Divider />

      {/* Tertiary: icon cluster */}
      <div className="flex items-center gap-1 shrink-0">
        <ToolIcon
          title={isDark ? "Light mode" : "Dark mode"}
          onClick={onToggleDark}
          label="Toggle theme"
        >
          {isDark ? "☀" : "☾"}
        </ToolIcon>

        {/* Desktop / mobile slider pill */}
        <div
          className="flex items-center ml-1"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: 2,
            gap: 2,
          }}
        >
          <DeviceTab
            active={device === "desktop"}
            onClick={() => onDeviceChange("desktop")}
            label="Desktop"
          />
          <DeviceTab
            active={device === "mobile"}
            onClick={() => onDeviceChange("mobile")}
            label="Mobile"
          />
        </div>
      </div>

      <Divider />

      {/* Secondary: text buttons */}
      <button
        type="button"
        onClick={onOpenTemplates}
        title="Templates · ⌘K"
        className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors shrink-0"
      >
        templates
      </button>
      <button
        type="button"
        onClick={onOpenScheduled}
        title="Scheduled emails"
        className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors shrink-0"
      >
        scheduled
      </button>

      {/* Schedule trigger + popover */}
      <div className="relative shrink-0" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setSchedulePopoverOpen((v) => !v)}
          title="Schedule send"
          className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
        >
          schedule
        </button>
        {schedulePopoverOpen ? (
          <div
            className="glass-surface-strong absolute right-0 top-[calc(100%+10px)] z-50 p-3 flex items-center gap-2"
            style={{ minWidth: 280 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="glass-input px-2 py-1.5 text-xs flex-1"
              aria-label="Schedule date and time"
              autoFocus
            />
            <GlassButton
              onClick={schedule}
              disabled={scheduling || !scheduleAt}
              style={{ padding: "6px 10px" }}
            >
              {scheduling ? "…" : "queue"}
            </GlassButton>
          </div>
        ) : null}
      </div>

      <Divider />

      {/* Primary: ask + send */}
      <button
        type="button"
        onClick={onOpenAsk}
        title="Ask agent · ⌘J"
        className="glass-button-accent flex items-center gap-1.5 shrink-0"
        style={{ padding: "6px 12px" }}
      >
        <span className="font-display italic text-base leading-none">ask</span>
        <span className="text-[10px] uppercase tracking-[0.18em] opacity-60">
          ⌘J
        </span>
      </button>
      <GlassButton
        variant="accent"
        onClick={send}
        disabled={sending}
        title="Send · ⌘↵"
        className="shrink-0"
        style={{ padding: "6px 14px" }}
      >
        {sending ? "sending…" : "send"}
      </GlassButton>
    </GlassSurface>
  );
}

function Divider() {
  return (
    <div
      aria-hidden
      className="self-stretch shrink-0"
      style={{
        width: 1,
        background: "var(--border)",
        marginTop: 6,
        marginBottom: 6,
      }}
    />
  );
}

function ToolIcon({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <GlassIconButton
      {...rest}
      aria-label={rest.label}
      style={{
        height: 34,
        width: 34,
        fontSize: 16,
        ...(rest.style ?? {}),
      }}
    >
      {children}
    </GlassIconButton>
  );
}

function DeviceTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-mono text-[10px] uppercase tracking-[0.08em] transition-colors ${
        active
          ? "text-[var(--bg)]"
          : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
      }`}
      style={{
        padding: "5px 12px",
        borderRadius: 999,
        background: active ? "var(--fg)" : "transparent",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
