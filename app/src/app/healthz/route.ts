import { access } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { env } from "@/modules/config/env";

export const dynamic = "force-dynamic";

/** The worker runs a job at least every minute; 15 minutes without any run means it has stopped. */
const WORKER_SILENT_MS = 15 * 60 * 1000;

/**
 * Liveness/readiness: database reachable and media volume present (ARCHITECTURE.md §7). With `?worker=1`
 * (for the external uptime monitor, P04-04) it also fails when the worker has stopped running jobs.
 */
export async function GET(req: Request) {
  const checks: Record<string, "ok" | "fail"> = {};
  try {
    await db.execute(sql`SELECT 1`);
    checks.db = "ok";
  } catch {
    checks.db = "fail";
  }
  try {
    await access(path.resolve(env().MEDIA_DIR));
    checks.media = "ok";
  } catch {
    checks.media = "fail";
  }
  if (new URL(req.url).searchParams.get("worker") === "1") {
    try {
      const r = await db.execute<{ last: string | null }>(sql`SELECT max(last_run_at) AS last FROM worker_heartbeats`);
      const last = r.rows[0]?.last;
      checks.worker = last && Date.now() - new Date(last).getTime() < WORKER_SILENT_MS ? "ok" : "fail";
    } catch {
      checks.worker = "fail";
    }
  }
  const ok = Object.values(checks).every((v) => v === "ok");
  return Response.json(checks, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
