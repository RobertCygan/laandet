import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { AppError } from "@/modules/errors";

export type RateRule = { max: number; windowSeconds: number };

/**
 * Atomic fixed-window counter in PostgreSQL (works across restarts and processes).
 * Returns true if the request is allowed.
 */
export async function consumeRateLimit(db: DbOrTx, bucket: string, rule: RateRule): Promise<boolean> {
  const rows = await db.execute<{ count: number }>(sql`
    INSERT INTO app_rate_limits (bucket, count, window_end)
    VALUES (${bucket}, 1, now() + make_interval(secs => ${rule.windowSeconds}))
    ON CONFLICT (bucket) DO UPDATE SET
      count = CASE WHEN app_rate_limits.window_end <= now() THEN 1 ELSE app_rate_limits.count + 1 END,
      window_end = CASE WHEN app_rate_limits.window_end <= now()
        THEN now() + make_interval(secs => ${rule.windowSeconds}) ELSE app_rate_limits.window_end END
    RETURNING count
  `);
  const count = Number(rows.rows[0]?.count ?? 0);
  return count <= rule.max;
}

/** Throws AppError("rate_limited") when any of the buckets is exhausted. */
export async function enforceRateLimits(
  db: DbOrTx,
  checks: Array<{ bucket: string; rule: RateRule }>,
): Promise<void> {
  for (const c of checks) {
    if (!(await consumeRateLimit(db, c.bucket, c.rule))) {
      throw new AppError("rate_limited", undefined, { bucket: c.bucket.split(":")[0] });
    }
  }
}

/** App-level limits from docs/SECURITY.md §2 (new account = younger than 7 days). */
export const LIMITS = {
  signInPerEmail: { max: 5, windowSeconds: 15 * 60 },
  signInPerIp: { max: 20, windowSeconds: 15 * 60 },
  signUpPerIp: { max: 5, windowSeconds: 60 * 60 },
  emailPerAddress: { max: 3, windowSeconds: 60 * 60 },
  publishNew: { max: 3, windowSeconds: 24 * 60 * 60 },
  publishEstablished: { max: 10, windowSeconds: 24 * 60 * 60 },
  uploadsNew: { max: 30, windowSeconds: 60 * 60 },
  uploadsEstablished: { max: 60, windowSeconds: 60 * 60 },
  reports: { max: 10, windowSeconds: 24 * 60 * 60 },
  categorySuggestions: { max: 3, windowSeconds: 24 * 60 * 60 },
} satisfies Record<string, RateRule>;
