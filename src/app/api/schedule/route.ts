import { NextResponse } from "next/server";
import { getScheduler } from "@/lib/scheduler";
import {
  addScheduled,
  listScheduled,
  reapStalePending,
  type ScheduledRow,
} from "@/lib/scheduledStore";
import type { EmailData } from "@/email/schema";

export const runtime = "nodejs";

type ScheduleBody = {
  to: string;
  subject: string;
  data: EmailData;
  scheduledFor: string;
};

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function parseBody(raw: unknown): ScheduleBody | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.to !== "string") return null;
  if (typeof r.subject !== "string") return null;
  if (typeof r.scheduledFor !== "string") return null;
  if (!r.data || typeof r.data !== "object") return null;
  const d = r.data as Record<string, unknown>;
  if (!Array.isArray(d.content)) return null;
  return r as ScheduleBody;
}

export async function GET() {
  try {
    // Sweep stale pending rows before listing. Cheap (few-row file scan).
    await reapStalePending();
    const rows = await listScheduled();
    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Couldn't read schedule.",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body must be JSON." },
      { status: 400 },
    );
  }

  const body = parseBody(json);
  if (!body) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing or malformed `to`, `subject`, `data`, or `scheduledFor`.",
      },
      { status: 400 },
    );
  }

  if (!isValidEmail(body.to)) {
    return NextResponse.json(
      { ok: false, error: `"${body.to}" doesn't look like an email address.` },
      { status: 400 },
    );
  }

  const when = new Date(body.scheduledFor);
  if (Number.isNaN(when.getTime())) {
    return NextResponse.json(
      { ok: false, error: "scheduledFor isn't a valid date string." },
      { status: 400 },
    );
  }
  if (when.getTime() <= Date.now()) {
    return NextResponse.json(
      { ok: false, error: "scheduledFor must be in the future." },
      { status: 400 },
    );
  }

  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const scheduler = getScheduler();

  // Persist the row first so the UI can show it even if the scheduler
  // call fails.
  const row: ScheduledRow = {
    id,
    workflowId: "", // filled in below from scheduler.start
    to: body.to,
    subject: body.subject,
    scheduledFor: when.toISOString(),
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  await addScheduled(row);

  try {
    const { externalId } = await scheduler.start({
      rowId: id,
      to: body.to,
      subject: body.subject,
      data: body.data,
      scheduledFor: when,
    });
    // Re-write the row with the external id (Temporal workflowId or
    // Resend email id) so cancel can find it.
    const { updateScheduled } = await import("@/lib/scheduledStore");
    await updateScheduled(id, { workflowId: externalId });
    return NextResponse.json({
      ok: true,
      id,
      externalId,
      scheduler: scheduler.name,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Couldn't reach the scheduler.";
    const hint =
      scheduler.name === "temporal"
        ? "Is `temporal server start-dev` running?"
        : "Check RESEND_API_KEY and that the recipient is a verified address (Resend sandbox limits free accounts).";
    return NextResponse.json(
      {
        ok: false,
        error: `Scheduled record saved, but the scheduler rejected it: ${message}. ${hint}`,
      },
      { status: 502 },
    );
  }
}
