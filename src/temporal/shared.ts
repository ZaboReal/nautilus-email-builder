/**
 * Shared types between workflow, activity, worker, and client.
 * Workflow code can't import server-only modules — keep types here.
 */

import type { EmailData } from "@/email/schema";

export const TASK_QUEUE =
  process.env.TEMPORAL_TASK_QUEUE ?? "emails";

export type ScheduledSendInput = {
  rowId: string;
  to: string;
  subject: string;
  data: EmailData;
};
