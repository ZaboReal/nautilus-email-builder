/**
 * Temporal activities run in normal Node-land — they CAN import the
 * Resend SDK and our render path. The workflow file (workflows.ts) is
 * the deterministic side and must not.
 */

import { Resend } from "resend";
import { extractInlineImages } from "@/email/inlineImages";
import { renderEmailHtml } from "@/email/renderEmailHtml";
import { updateScheduled } from "@/lib/scheduledStore";
import type { ScheduledSendInput } from "./shared";

export async function sendScheduledEmail(
  input: ScheduledSendInput,
): Promise<{ ok: boolean; resendId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  if (!apiKey) {
    const error = "RESEND_API_KEY not set on the worker process.";
    await updateScheduled(input.rowId, { status: "failed", error });
    return { ok: false, error };
  }

  try {
    const html = await renderEmailHtml(input.data);
    const { html: processedHtml, attachments } = extractInlineImages(html);
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: processedHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    if (result.error) {
      const error = result.error.message ?? "Resend rejected the send.";
      await updateScheduled(input.rowId, { status: "failed", error });
      return { ok: false, error };
    }
    await updateScheduled(input.rowId, {
      status: "sent",
      resendId: result.data?.id,
    });
    return { ok: true, resendId: result.data?.id };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unknown send error.";
    await updateScheduled(input.rowId, { status: "failed", error });
    // Re-throw so Temporal records it on the workflow timeline too.
    throw e;
  }
}
