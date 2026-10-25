import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluate, findMarkers, report, scanLegalDir } from "./check";

const FIXTURES = path.join(import.meta.dirname, "fixtures/legal");
const base = { appEnv: "staging", markers: [], legal: [], demoListings: null, mailFrom: undefined };
const final = { docKey: "terms", locale: "nb", version: "1.0.0", isDraft: false };

describe("release check (P04-02)", () => {
  it("finds unfinished markers with file and line, and passes a clean file", async () => {
    expect(await scanLegalDir(FIXTURES)).toEqual([
      { file: "nb/utkast.md", line: 8, text: "Behandlingsansvarlig: [MÅ FYLLES UT FØR LANSERING: navn og org.nr.]" },
    ]);
    expect(findMarkers("x.md", "Ferdig tekst\nuten merker")).toEqual([]);
    expect(findMarkers("x.md", "KONTROLLERES FØR LANSERING")).toHaveLength(1);
  });

  it("counts draft legal texts as blockers, except the unused extended agreement", () => {
    const legal = [final, { docKey: "rental_extended", locale: "nb", version: "0.1.0", isDraft: true }];
    expect(report(evaluate({ ...base, legal })).blockers).toBe(0);
    const drafts = evaluate({ ...base, legal: [{ ...final, isDraft: true }] });
    expect(drafts.find((f) => !f.ok)?.detail).toBe("terms/nb 1.0.0");
    // Nothing loaded, or no database: not ready.
    expect(report(evaluate(base)).blockers).toBe(1);
    expect(evaluate({ ...base, legal: null })[1]).toMatchObject({ ok: false, detail: "not checked: no database" });
  });

  it("in production also needs no demo listings and a real sender address", () => {
    const prod = { ...base, appEnv: "production", legal: [final] };
    expect(report(evaluate({ ...prod, demoListings: 0, mailFrom: "Laandet <hei@laandet.no>" })).blockers).toBe(0);
    const bad = evaluate({ ...prod, demoListings: 20, mailFrom: "Laandet <noreply@example.invalid>" });
    expect(bad.filter((f) => !f.ok).map((f) => f.detail)).toEqual(["20 demo listing(s)", "still the example address"]);
  });

  it("reports blockers without anything but gate names and file positions", () => {
    const markers = [
      { file: "nb/a.md", line: 3, text: "x" },
      { file: "nb/a.md", line: 9, text: "y" },
      { file: "en/b.md", line: 4, text: "z" },
    ];
    const { text, blockers } = report(evaluate({ ...base, markers }));
    expect(blockers).toBe(2);
    expect(text).toContain("BLOCKER  Legal texts: no");
    expect(text).toContain("nb/a.md (lines 3, 9); en/b.md (line 4)");
  });
});
