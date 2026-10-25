import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Release check (P04-02): what code can tell about the go/no-go gates in DEVELOPMENT_ROADMAP §4,
 * SECURITY §3 and LEGAL_REVIEW_CHECKLIST §3. Pure functions here; `scripts/release-check.ts` gathers the inputs.
 */

/** Placeholders, as the legal loader refuses them in production (`scripts/load-legal.ts`). */
export const UNFINISHED_MARKER =
  /MÅ FYLLES UT|KONTROLLERES FØR LANSERING|MUST BE COMPLETED BEFORE LAUNCH|TO BE VERIFIED BEFORE LAUNCH/;

/** The extended agreement is not used while category B stays blocked (LEGAL_REVIEW_CHECKLIST §3.1). */
export const UNUSED_LEGAL_DOCS: readonly string[] = ["rental_extended"];

const EXAMPLE_MAIL_FROM = /example\.invalid/i;

export type Marker = { file: string; line: number; text: string };
export type Finding = { gate: string; ok: boolean; detail: string };
export type LegalRow = { docKey: string; locale: string; version: string; isDraft: boolean };

export function findMarkers(file: string, content: string): Marker[] {
  const out: Marker[] = [];
  content.split("\n").forEach((text, i) => {
    if (UNFINISHED_MARKER.test(text)) out.push({ file, line: i + 1, text: text.trim().slice(0, 120) });
  });
  return out;
}

/** Markers in every legal text below `dir` (`.md`, except the folder's README), paths relative to `dir`. */
export async function scanLegalDir(dir: string): Promise<Marker[]> {
  const markers: Marker[] = [];
  async function walk(sub: string) {
    const entries = (await readdir(path.join(dir, sub), { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      const rel = path.join(sub, entry.name);
      if (entry.isDirectory()) await walk(rel);
      else if (entry.name.endsWith(".md") && entry.name !== "README.md") {
        markers.push(...findMarkers(rel, await readFile(path.join(dir, rel), "utf8")));
      }
    }
  }
  await walk("");
  return markers;
}

/** Current versions still marked as drafts, except documents that are not in use. */
export function draftLegalDocs(current: LegalRow[]): LegalRow[] {
  return current.filter((r) => r.isDraft && !UNUSED_LEGAL_DOCS.includes(r.docKey));
}

export type ReleaseInputs = {
  appEnv: string;
  markers: Marker[];
  /** Current version per document and locale; null when the database could not be reached. */
  legal: LegalRow[] | null;
  /** Demo listings that are not deleted; null when not checked. */
  demoListings: number | null;
  mailFrom: string | undefined;
};

/** «nb/a.md (lines 3, 9); en/b.md (line 4)» */
function byFile(markers: Marker[]): string {
  const lines = new Map<string, number[]>();
  for (const m of markers) lines.set(m.file, [...(lines.get(m.file) ?? []), m.line]);
  return [...lines].map(([file, ls]) => `${file} (${ls.length === 1 ? "line" : "lines"} ${ls.join(", ")})`).join("; ");
}

export function evaluate(i: ReleaseInputs): Finding[] {
  const legalGate = "Legal texts in the database are final (not drafts)";
  const findings: Finding[] = [
    {
      gate: "Legal texts: no «MÅ FYLLES UT» or «KONTROLLERES FØR LANSERING» markers",
      ok: i.markers.length === 0,
      detail: i.markers.length ? byFile(i.markers) : "none found",
    },
  ];
  if (i.legal === null) {
    findings.push({ gate: legalGate, ok: false, detail: "not checked: no database" });
  } else {
    const drafts = draftLegalDocs(i.legal);
    findings.push({
      gate: legalGate,
      ok: i.legal.length > 0 && drafts.length === 0,
      detail:
        i.legal.length === 0
          ? "no legal texts loaded"
          : drafts.length
            ? drafts.map((d) => `${d.docKey}/${d.locale} ${d.version}`).join(", ")
            : "all current versions are final",
    });
  }
  if (i.appEnv === "production") {
    findings.push({
      gate: "No demo listings in production",
      ok: i.demoListings === 0,
      detail: i.demoListings === null ? "not checked: no database" : `${i.demoListings} demo listing(s)`,
    });
    const example = !i.mailFrom || EXAMPLE_MAIL_FROM.test(i.mailFrom);
    findings.push({
      gate: "MAIL_FROM is a real sender address",
      ok: !example,
      detail: !i.mailFrom
        ? "not set (the example default would be used)"
        : example
          ? "still the example address"
          : "set",
    });
  }
  return findings;
}

export function report(findings: Finding[]): { text: string; blockers: number } {
  const blockers = findings.filter((f) => !f.ok).length;
  const lines = findings.map((f) => `${f.ok ? "OK     " : "BLOCKER"}  ${f.gate}\n         ${f.detail}`);
  lines.push("", blockers ? `${blockers} blocker(s): not ready for release.` : "No blockers found by this check.");
  return { text: lines.join("\n"), blockers };
}
