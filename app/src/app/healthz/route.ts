import { access } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { env } from "@/modules/config/env";

export const dynamic = "force-dynamic";

/** Liveness/readiness: database reachable and media volume present (ARCHITECTURE.md §7). */
export async function GET() {
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
  const ok = Object.values(checks).every((v) => v === "ok");
  return Response.json(checks, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
