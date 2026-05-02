/**
 * Scheduler abstraction.
 *
 * Two implementations swap behind a common interface:
 *
 *   1. **Temporal** — durable workflow engine. Best for local dev and
 *      always-on hosts (Render / Fly / Railway). Survives crashes,
 *      gives you full execution history, and supports rich retry
 *      semantics. Needs a worker process AND a Temporal server.
 *
 *   2. **Resend native scheduling** (`scheduledAt`) — Resend itself
 *      delivers the email at the requested future time, up to 30 days
 *      out. Zero extra infra: no worker, no server. Cancel via
 *      `resend.emails.cancel(id)`. Perfect fit for Vercel / serverless.
 *
 * Selection rules (in priority order):
 *   - `SCHEDULER` env var === "resend" → Resend
 *   - `SCHEDULER` env var === "temporal" → Temporal
 *   - On Vercel (`VERCEL=1`) → Resend (auto, since Temporal can't run there)
 *   - Otherwise → Temporal (preserves the dev story)
 */

import { Resend } from "resend";
import { renderEmailHtml } from "@/email/renderEmailHtml";
import { getTemporalClient } from "@/temporal/client";
import { TASK_QUEUE } from "@/temporal/shared";
import { scheduledSendWorkflow } from "@/temporal/workflows";
import type { EmailData } from "@/email/schema";
import type { ScheduledRow } from "./scheduledStore";

export type SchedulerName = "temporal" | "resend";

export type ScheduleStartInput = {
  rowId: string;
  to: string;
  subject: string;
  data: EmailData;
  scheduledFor: Date;
};

export type Scheduler = {
  name: SchedulerName;
  /**
   * Schedule a one-shot send. Returns a provider-specific external id
   * to store on the row so cancel() can find it later.
   */
  start(input: ScheduleStartInput): Promise<{ externalId: string }>;
  /**
   * Cancel a previously scheduled send by externalId. May throw if the
   * provider says it's already sent.
   */
  cancel(row: ScheduledRow): Promise<void>;
};

export function pickScheduler(): SchedulerName {
  const explicit = process.env.SCHEDULER?.toLowerCase();
  if (explicit === "resend" || explicit === "temporal") return explicit;
  if (process.env.VERCEL === "1") return "resend";
  return "temporal";
}

let cachedResend: Resend | null = null;
function resendClient(): Resend {
  if (cachedResend) return cachedResend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set.");
  cachedResend = new Resend(apiKey);
  return cachedResend;
}

const resendScheduler: Scheduler = {
  name: "resend",
  async start(input) {
    const html = await renderEmailHtml(input.data);
    const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
    const result = await resendClient().emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html,
      scheduledAt: input.scheduledFor.toISOString(),
    });
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.id) throw new Error("Resend didn't return an id.");
    return { externalId: result.data.id };
  },
  async cancel(row) {
    const id = row.workflowId; // we reuse the column for both providers
    if (!id) return; // never made it to Resend — nothing to cancel
    const result = await resendClient().emails.cancel(id);
    if (result.error) throw new Error(result.error.message);
  },
};

const temporalScheduler: Scheduler = {
  name: "temporal",
  async start(input) {
    const workflowId = `email-send-${input.rowId}`;
    const delayMs = input.scheduledFor.getTime() - Date.now();
    const client = await getTemporalClient();
    await client.workflow.start(scheduledSendWorkflow, {
      workflowId,
      taskQueue: TASK_QUEUE,
      startDelay: `${Math.max(1, Math.floor(delayMs / 1000))}s`,
      args: [
        {
          rowId: input.rowId,
          to: input.to,
          subject: input.subject,
          data: input.data,
        },
      ],
    });
    return { externalId: workflowId };
  },
  async cancel(row) {
    if (!row.workflowId) return; // scheduler never accepted this row
    const client = await getTemporalClient();
    await client.workflow.getHandle(row.workflowId).cancel();
  },
};

export function getScheduler(): Scheduler {
  return pickScheduler() === "resend" ? resendScheduler : temporalScheduler;
}
