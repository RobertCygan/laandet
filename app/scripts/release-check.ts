/**
 * Release check (P04-02, docs/RELEASE_GATES.md):
 *   npm run release:check
 * Reports what code can tell about the go/no-go gates and exits 1 while any blocker remains.
 * Reads the legal texts from ../legal (or LEGAL_DIR) and the database from DATABASE_MIGRATION_URL or
 * DATABASE_URL. Prints gate names, file positions and counts only — never a setting's value or a URL.
 */
import path from "node:path";
import { Pool } from "pg";
import { evaluate, report, scanLegalDir, type LegalRow } from "../src/modules/release/check";

async function fromDatabase(url: string | undefined, production: boolean) {
  if (!url) return { legal: null, demoListings: null };
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5_000 });
  try {
    const legal = await pool.query<{ doc_key: string; locale: string; version: string; is_draft: boolean }>(
      `SELECT DISTINCT ON (doc_key, locale) doc_key, locale, version, is_draft
         FROM legal_document_versions ORDER BY doc_key, locale, created_at DESC`,
    );
    const demo = production
      ? await pool.query<{ n: string }>("SELECT count(*) AS n FROM listings WHERE is_demo AND deleted_at IS NULL")
      : null;
    return {
      legal: legal.rows.map<LegalRow>((r) => ({
        docKey: r.doc_key,
        locale: r.locale,
        version: r.version,
        isDraft: r.is_draft,
      })),
      demoListings: demo ? Number(demo.rows[0]?.n ?? 0) : null,
    };
  } catch {
    // The reason may contain the host or user; say only that the database was not reached.
    return { legal: null, demoListings: null };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function main() {
  const appEnv = process.env.APP_ENV ?? "development";
  const legalDir = path.resolve(process.env.LEGAL_DIR ?? "../legal");
  const db = await fromDatabase(
    process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL,
    appEnv === "production",
  );
  const findings = evaluate({
    appEnv,
    markers: await scanLegalDir(legalDir),
    legal: db.legal,
    demoListings: db.demoListings,
    mailFrom: process.env.MAIL_FROM,
  });
  const { text, blockers } = report(findings);
  console.log(`Laandet release check (APP_ENV=${appEnv})\n\n${text}`);
  console.log("\nGates that need people (restore test, usability session, lawyer, sign-off): docs/RELEASE_GATES.md");
  process.exitCode = blockers ? 1 : 0;
}

main().catch((err: unknown) => {
  console.error("release check failed:", err instanceof Error ? err.message : "unknown error");
  process.exitCode = 1;
});
