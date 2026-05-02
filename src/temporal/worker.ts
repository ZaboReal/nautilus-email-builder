/**
 * Standalone Temporal worker.
 *
 * Started alongside Next.js by `npm run dev` (via concurrently).
 * Connects to Temporal at TEMPORAL_ADDRESS, polls the `emails` task
 * queue, and executes scheduled-send workflows.
 *
 * Resilient to a missing Temporal server: if the connection is refused
 * (e.g. you haven't run `temporal server start-dev` yet), it retries
 * with exponential backoff instead of crashing — so once the server
 * comes up, the worker attaches automatically and `npm run dev` keeps
 * Next.js running uninterrupted in the meantime.
 */

import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities";
import { TASK_QUEUE } from "./shared";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function connectWithRetry() {
  const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
  const namespace = process.env.TEMPORAL_NAMESPACE ?? "default";
  let delay = 2_000;
  let firstFailure = true;
  for (;;) {
    try {
      const connection = await NativeConnection.connect({ address });
      const worker = await Worker.create({
        connection,
        namespace,
        taskQueue: TASK_QUEUE,
        workflowsPath: require.resolve("./workflows"),
        activities,
      });
      console.log(
        `[worker] connected ${address} ns=${namespace} queue=${TASK_QUEUE}`,
      );
      await worker.run();
      // worker.run resolves only on shutdown — exit clean if we get here
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (firstFailure) {
        console.warn(
          `[worker] no Temporal at ${address} — start it with \`temporal server start-dev\` and the worker will attach automatically.`,
        );
        firstFailure = false;
      } else {
        console.warn(`[worker] retry in ${delay / 1000}s (${msg.slice(0, 80)})`);
      }
      await sleep(delay);
      delay = Math.min(delay * 1.5, 30_000);
    }
  }
}

connectWithRetry().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
