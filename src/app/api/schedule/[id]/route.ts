import { NextResponse } from "next/server";
import { getScheduler } from "@/lib/scheduler";
import { getScheduled, removeScheduled } from "@/lib/scheduledStore";

export const runtime = "nodejs";

/**
 * DELETE = "remove from list".
 *   - If the row is still pending, we ALSO ask the scheduler to
 *     cancel before removing (so the email doesn't fire after the
 *     user thought they cleared it).
 *   - For non-pending rows, we just drop the row. No external call.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const row = await getScheduled(id);
  if (!row) {
    return NextResponse.json(
      { ok: false, error: "No scheduled email with that id." },
      { status: 404 },
    );
  }

  if (row.status === "pending") {
    try {
      await getScheduler().cancel(row);
    } catch (e) {
      // Soft-fail: we'll still drop the row, but warn so a logged-in
      // operator knows something needs cleanup on the provider side.
      console.warn("scheduler cancel failed", e);
    }
  }

  await removeScheduled(id);
  return NextResponse.json({ ok: true });
}
