/**
 * Load legal texts from laandet/legal/{nb,en}/*.md into legal_document_versions (D-023).
 *   npm run legal:load                   refuses unfinished texts in staging and production
 *   npm run legal:load -- --allow-draft  staging only: load drafts (always labelled as drafts)
 * Production never loads a text that still contains placeholders, whatever the flags.
 * Idempotent: a version is inserted only when its content hash is new.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { LEGAL_DOC_KEYS, legalDocumentVersions, type LegalDocKey } from "../src/db/schema";

const UNFINISHED =
  /MÅ FYLLES UT FØR LANSERING|KONTROLLERES FØR LANSERING|MUST BE COMPLETED BEFORE LAUNCH|TO BE VERIFIED BEFORE LAUNCH/;

export function parseFrontMatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: raw.slice(m[0].length) };
}

async function main() {
  const url = process.env.DATABASE_MIGRATION_URL;
  if (!url) throw new Error("DATABASE_MIGRATION_URL is not set");
  const legalDir = path.resolve(process.env.LEGAL_DIR ?? "../legal");
  const allowDraft = process.argv.includes("--allow-draft");
  const appEnv = process.env.APP_ENV ?? "development";
  const strict = appEnv === "production" || (appEnv === "staging" && !allowDraft);
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle({ client: pool, casing: "snake_case" });
  let inserted = 0;
  try {
    for (const locale of ["nb", "en"] as const) {
      const dir = path.join(legalDir, locale);
      for (const file of (await readdir(dir)).filter((f) => f.endsWith(".md")).sort()) {
        const raw = await readFile(path.join(dir, file), "utf8");
        const { meta, body } = parseFrontMatter(raw);
        const docKey = meta.doc_key as LegalDocKey | undefined;
        if (!docKey || !(LEGAL_DOC_KEYS as readonly string[]).includes(docKey)) {
          console.warn(`skip ${locale}/${file}: unknown doc_key`);
          continue;
        }
        if (strict && UNFINISHED.test(body)) {
          throw new Error(`${locale}/${file} still contains placeholders; refusing to load in ${appEnv}`);
        }
        const sha = createHash("sha256").update(body).digest("hex");
        const version = meta.version ?? "0.0.0";
        const isDraft = /UTKAST|DRAFT/i.test(meta.status ?? "") || UNFINISHED.test(body);
        const exists = await db
          .select({ id: legalDocumentVersions.id })
          .from(legalDocumentVersions)
          .where(
            and(
              eq(legalDocumentVersions.docKey, docKey),
              eq(legalDocumentVersions.locale, locale),
              eq(legalDocumentVersions.version, version),
              eq(legalDocumentVersions.contentSha256, sha),
            ),
          );
        if (exists.length) continue;
        await db.insert(legalDocumentVersions).values({
          docKey,
          locale,
          version,
          isAuthoritative: locale === "nb",
          isDraft,
          materialChange: meta.material_change === "true",
          contentMd: body,
          contentSha256: sha,
          publishedAt: new Date(),
          effectiveAt: new Date(),
        });
        inserted++;
        console.log(`loaded ${locale}/${file} (${docKey} ${version}${isDraft ? ", draft" : ""})`);
      }
    }
    console.log(`Legal loader done: ${inserted} new version(s).`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
