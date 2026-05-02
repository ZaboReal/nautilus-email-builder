/**
 * Workflow code. This file is loaded into Temporal's deterministic
 * sandbox, so it MUST NOT import Node APIs, the Resend SDK, or any
 * non-pure helpers. All side-effecting work goes through `proxyActivities`.
 */

import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "./activities";
import type { ScheduledSendInput } from "./shared";

const { sendScheduledEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: "2 minutes",
  retry: {
    maximumAttempts: 3,
    initialInterval: "10s",
  },
});

/**
 * Body is intentionally trivial. We use `startDelay` on the workflow
 * client (NOT `sleep` here) so the workflow doesn't even get scheduled
 * onto a worker until the delay elapses — cheaper than a long
 * `workflow.sleep`, and cancellation cleans up before any worker picks
 * the task up.
 */
export async function scheduledSendWorkflow(
  input: ScheduledSendInput,
): Promise<void> {
  await sendScheduledEmail(input);
}
