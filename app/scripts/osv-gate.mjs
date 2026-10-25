/**
 * SEC-60 gate for OSV-Scanner's JSON output (CI, "Secrets and dependency audit"):
 *   node scripts/osv-gate.mjs osv.json
 * Lists every known vulnerability in the lockfile. High and critical ones (CVSS 7.0 or more) fail the job;
 * lower ones, and advisories without a score, are listed only (`npm audit --audit-level=high` runs too).
 * Plain Node, no dependencies, so the job needs no `npm ci`.
 */
import { readFileSync } from "node:fs";

const HIGH = 7.0;

const report = JSON.parse(readFileSync(process.argv[2] ?? "osv.json", "utf8"));
const findings = [];
for (const result of report.results ?? []) {
  for (const p of result.packages ?? []) {
    for (const group of p.groups ?? []) {
      const score = Number.parseFloat(group.max_severity);
      findings.push({
        pkg: `${p.package?.name}@${p.package?.version}`,
        ids: (group.ids ?? []).join(", "),
        score: Number.isFinite(score) ? score : null,
      });
    }
  }
}

for (const f of findings) {
  console.log(`${f.score === null ? "  ?" : f.score.toFixed(1).padStart(4)}  ${f.pkg}  ${f.ids}`);
}
const blocking = findings.filter((f) => f.score !== null && f.score >= HIGH);
console.log(
  findings.length
    ? `\n${findings.length} finding(s); ${blocking.length} high or critical.`
    : "No known vulnerabilities in the lockfile.",
);
process.exitCode = blocking.length ? 1 : 0;
