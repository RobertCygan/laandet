import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { recordAudit } from "@/modules/audit/audit";
import { createUser, resetDb } from "./helpers";

/** PostgreSQL error code of a failed query (Drizzle wraps the driver error in `cause`). */
async function pgCode(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return ((e as { cause?: { code?: string } }).cause ?? (e as { code?: string })).code;
  }
}
const DENIED = "42501"; // insufficient_privilege

/** The runtime role (laandet_app) is least-privilege (DATA_MODEL §6, SEC-20). */
describe("database privileges of the runtime role", () => {
  beforeEach(resetDb);

  it("can append to the audit log but never change or delete it", async () => {
    const u = await createUser();
    await recordAudit(db, {
      actorId: u.id,
      action: "test.event",
      meta: { requestId: null, ip: "203.0.113.1", userAgent: null },
    });
    const [row] = (
      await db.execute<{ ip_hash: string | null }>(sql`SELECT ip_hash FROM audit_events WHERE action = 'test.event'`)
    ).rows;
    expect(row?.ip_hash).toMatch(/^[0-9a-f]{64}$/); // raw IPs are never stored
    expect(await pgCode(db.execute(sql`UPDATE audit_events SET action = 'x'`))).toBe(DENIED);
    expect(await pgCode(db.execute(sql`DELETE FROM audit_events`))).toBe(DENIED);
  });

  it("cannot write legal document versions or rewrite acceptances", async () => {
    const insert =
      db.execute(sql`INSERT INTO legal_document_versions (doc_key, locale, version, is_authoritative, content_md, content_sha256)
      VALUES ('terms', 'nb', 'x', true, 'x', ${"0".repeat(64)})`);
    expect(await pgCode(insert)).toBe(DENIED);
    expect(await pgCode(db.execute(sql`DELETE FROM legal_acceptances`))).toBe(DENIED);
    expect(await pgCode(db.execute(sql`UPDATE legal_acceptances SET accepted_at = now()`))).toBe(DENIED);
  });
});
