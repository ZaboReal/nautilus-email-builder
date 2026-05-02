/**
 * File-backed JSON store for scheduled-send rows.
 *
 * Why not a real DB? Take-home scope. Why not in-memory? The Next.js
 * dev server hot-reloads modules and would clear it. A flat file is
 * the smallest thing that survives reload AND lets the UI list
 * scheduled sends even when Temporal is down (important for the
 * deployed demo, since the PDF allows omitting Temporal there).
 *
 * Source of truth: this file. Temporal: the executor.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

export type ScheduledStatus =
  | "pending"
  | "sent"
  | "failed"
  | "cancelled";

export type ScheduledRow = {
  id: string;
  workflowId: string;
  to: string;
  subject: string;
  scheduledFor: string; // ISO date string
  createdAt: string;
  status: ScheduledStatus;
  error?: string;
  resendId?: string;
};

/**
 * On Vercel the project filesystem is read-only — only `/tmp` is
 * writable, and even then it's per-instance and ephemeral. We pick the
 * file location accordingly so writes don't crash. In-memory `cache`
 * is still the source of truth within a single process; the file is a
 * convenience for surviving local dev hot-reloads.
 */
const isVercel = process.env.VERCEL === "1";
const FILE = isVercel
  ? path.join("/tmp", "scheduled.json")
  : path.join(process.cwd(), "data", "scheduled.json");

let cache: ScheduledRow[] | null = null;
let writeChain: Promise<void> = Promise.resolve();
let writesDisabled = false;

async function ensureFile(): Promise<void> {
  if (writesDisabled) return;
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    try {
      await fs.access(FILE);
    } catch {
      await fs.writeFile(FILE, "[]", "utf8");
    }
  } catch {
    // Read-only FS or some other write block — fall back to memory only.
    writesDisabled = true;
  }
}

async function load(): Promise<ScheduledRow[]> {
  if (cache) return cache;
  await ensureFile();
  if (writesDisabled) {
    cache = [];
    return cache;
  }
  try {
    const raw = await fs.readFile(FILE, "utf8");
    cache = JSON.parse(raw) as ScheduledRow[];
  } catch {
    cache = [];
  }
  return cache;
}

async function save(rows: ScheduledRow[]): Promise<void> {
  cache = rows;
  if (writesDisabled) return;
  writeChain = writeChain.then(async () => {
    try {
      await fs.writeFile(FILE, JSON.stringify(rows, null, 2), "utf8");
    } catch {
      writesDisabled = true;
    }
  });
  await writeChain;
}

export async function listScheduled(): Promise<ScheduledRow[]> {
  const rows = await load();
  return [...rows].sort(
    (a, b) =>
      new Date(a.scheduledFor).getTime() -
      new Date(b.scheduledFor).getTime(),
  );
}

export async function addScheduled(row: ScheduledRow): Promise<void> {
  const rows = await load();
  await save([...rows, row]);
}

export async function updateScheduled(
  id: string,
  patch: Partial<ScheduledRow>,
): Promise<ScheduledRow | null> {
  const rows = await load();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const next: ScheduledRow = { ...rows[idx], ...patch };
  const newRows = [...rows];
  newRows[idx] = next;
  await save(newRows);
  return next;
}

export async function getScheduled(id: string): Promise<ScheduledRow | null> {
  const rows = await load();
  return rows.find((r) => r.id === id) ?? null;
}

export async function removeScheduled(id: string): Promise<boolean> {
  const rows = await load();
  const next = rows.filter((r) => r.id !== id);
  if (next.length === rows.length) return false;
  await save(next);
  return true;
}

/**
 * Marks any pending row whose scheduled time has passed as "sent". Used
 * on GET to keep the UI honest in scheduler backends that don't push
 * status back to us (Resend native — we ship the email to Resend at
 * scheduling time and never hear about delivery).
 *
 * For the Temporal backend, the activity itself flips status to
 * "sent"/"failed" as part of execution, so this is mostly a no-op
 * unless the worker was offline at fire time.
 */
export async function reapStalePending(): Promise<void> {
  const rows = await load();
  const now = Date.now();
  let changed = false;
  const next = rows.map((r) => {
    if (
      r.status === "pending" &&
      new Date(r.scheduledFor).getTime() + 5_000 < now
    ) {
      changed = true;
      return { ...r, status: "sent" as const };
    }
    return r;
  });
  if (changed) await save(next);
}
