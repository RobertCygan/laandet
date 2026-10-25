import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { inArray, like } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { acceptPending, pendingAcceptances } from "@/modules/legal/acceptance";
import { saveListing } from "@/modules/listings/service";
import { createUser, owner, rentalDraft, resetDb } from "./helpers";

const TEST_VERSION = "9.9.9-integrasjonstest";

async function removeTestVersions() {
  const rows = await owner
    .select({ id: schema.legalDocumentVersions.id })
    .from(schema.legalDocumentVersions)
    .where(like(schema.legalDocumentVersions.version, `${TEST_VERSION}%`));
  if (!rows.length) return;
  const ids = rows.map((r) => r.id);
  await owner.delete(schema.legalAcceptances).where(inArray(schema.legalAcceptances.documentVersionId, ids));
  await owner.delete(schema.legalDocumentVersions).where(inArray(schema.legalDocumentVersions.id, ids));
}

function runLoader(dir: string, appEnv: string, ...args: string[]) {
  return execFileSync(process.execPath, ["--import", "tsx", "scripts/load-legal.ts", ...args], {
    env: { ...process.env, LEGAL_DIR: dir, APP_ENV: appEnv },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function legalDir(body: string, version = TEST_VERSION): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "laandet-legal-"));
  for (const locale of ["nb", "en"]) mkdirSync(path.join(dir, locale));
  writeFileSync(
    path.join(dir, "nb", "brukervilkar.md"),
    `---\ndoc_key: terms\nlocale: nb\nversion: ${version}\nstatus: UTKAST\n---\n\n${body}\n`,
  );
  return dir;
}

describe("legal document loader (P01-11 §4)", () => {
  beforeEach(removeTestVersions);
  afterEach(removeTestVersions);

  it("inserts a version only when the content hash changes", () => {
    const dir = legalDir("# Vilkår\n\nFørste tekst.");
    expect(runLoader(dir, "development")).toContain("1 new version");
    expect(runLoader(dir, "development")).toContain("0 new version");
    writeFileSync(
      path.join(dir, "nb", "brukervilkar.md"),
      `---\ndoc_key: terms\nlocale: nb\nversion: ${TEST_VERSION}\nstatus: UTKAST\n---\n\nEndret tekst.\n`,
    );
    expect(runLoader(dir, "development")).toContain("1 new version");
  });

  it("refuses unfinished texts in production, even with --allow-draft, and in staging without it", () => {
    const dir = legalDir("Organisasjonsnummer: MÅ FYLLES UT FØR LANSERING");
    expect(() => runLoader(dir, "production", "--allow-draft")).toThrow();
    expect(() => runLoader(dir, "staging")).toThrow();
    expect(runLoader(dir, "staging", "--allow-draft")).toContain("1 new version");
  });
});

describe("re-acceptance after a material change (P01-11 §6)", () => {
  beforeEach(async () => {
    await resetDb();
    await removeTestVersions();
  });
  afterEach(removeTestVersions);

  it("blocks publishing until the user accepts the changed terms", async () => {
    const u = await createUser();
    expect(await pendingAcceptances(u)).toEqual([]);
    await owner.insert(schema.legalDocumentVersions).values({
      docKey: "terms",
      locale: "nb",
      version: `${TEST_VERSION}-vesentlig`,
      isAuthoritative: true,
      isDraft: true,
      materialChange: true,
      contentMd: "Nye vilkår",
      contentSha256: "a".repeat(64),
    });
    expect((await pendingAcceptances(u)).map((d) => d.docKey)).toEqual(["terms"]);
    await expect(saveListing(u, await rentalDraft(), [], { intent: "publish" })).rejects.toMatchObject({
      code: "conflict",
      message: "terms_acceptance_required",
    });
    await acceptPending(u);
    expect(await pendingAcceptances(u)).toEqual([]);
    expect((await saveListing(u, await rentalDraft(), [], { intent: "publish" })).status).toBe("published");
  });
});
