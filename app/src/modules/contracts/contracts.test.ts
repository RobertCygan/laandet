import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatKr } from "@/i18n/format";
import { Markdown } from "@/ui/legal/Markdown";
import { renderMustache, tagsOf } from "./mustache";
import { renderContract, templateBody } from "./render";
import { selectContractKind } from "./select";
import { DEADLINES, materialChanges, platformId, toContractView, type GiveawayTerms, type RentalTerms } from "./terms";

const legal = (p: string) => readFileSync(path.resolve(import.meta.dirname, "../../../../legal", p), "utf8");

const rental = (o: Partial<RentalTerms> = {}): RentalTerms => ({
  kind: "rental_simple",
  agreementNumber: "LA-2026-000123",
  templateVersion: "0.1.0-utkast",
  revision: 1,
  owner: { userId: "11111111-1111-1111-1111-111111111111", displayName: "Ola N.", platformId: "L-11111111" },
  renter: { userId: "22222222-2222-2222-2222-222222222222", displayName: "Kari N.", platformId: "L-22222222" },
  item: {
    title: "Tilhengerkopling",
    description: "Solid.",
    categoryLabelNb: "Verktøy",
    categoryLabelEn: "Tools",
    condition: "good",
    knownDefects: null,
  },
  declaredValueOre: 300_000,
  price: { amountOre: 15_000, unit: "day", units: 2, totalOre: 30_000 },
  period: { start: "2026-12-14T09:00:00.000Z", end: "2026-12-16T09:00:00.000Z" },
  handover: { method: "pickup", deliveryFeeOre: null },
  return: { method: "pickup" },
  accessories: ["Koffert"],
  depositOre: 50_000,
  permittedUse: null,
  operatingInstructions: null,
  safetyNoticeNb: null,
  safetyNoticeEn: null,
  deadlines: DEADLINES,
  ...o,
});

const giveaway: GiveawayTerms = {
  kind: "giveaway_transfer",
  agreementNumber: "GB-2026-000007",
  templateVersion: "0.1.0-utkast",
  revision: 1,
  giver: { userId: "1", displayName: "Ola", platformId: "L-1" },
  recipient: { userId: "2", displayName: "Kari", platformId: "L-2" },
  item: { title: "Sofa", description: "Grå", condition: "worn", knownDefects: "Flekk på setet" },
  handover: { method: "pickup", date: "20.12.2026" },
};

/** True if `path` can be resolved in the view (or in an array item, for `{{.}}`). */
function resolvable(view: Record<string, unknown>, tag: string): boolean {
  if (tag === ".") return true;
  let v: unknown = view;
  for (const k of tag.split(".")) {
    if (!v || typeof v !== "object" || !(k in (v as object))) return false;
    v = (v as Record<string, unknown>)[k];
  }
  return true;
}

describe("contract kind (RENTAL_AGREEMENTS §8.1)", () => {
  it.each([
    [499_999, "rental_simple"],
    [500_000, "rental_simple"],
    [500_001, "rental_extended"],
  ] as const)("%i øre → %s", (ore, kind) => {
    expect(selectContractKind({ type: "rent_out", declaredValueOre: ore })).toBe(kind);
  });
  it("give away and wanted", () => {
    expect(selectContractKind({ type: "give_away", declaredValueOre: null })).toBe("giveaway_transfer");
    expect(() => selectContractKind({ type: "wanted", declaredValueOre: null })).toThrow();
  });
});

describe("templates and views", () => {
  it.each([
    ["nb/forenklet-leieavtale.md", "nb", rental()],
    ["en/simplified-rental-agreement.md", "en", rental()],
    ["nb/gis-bort-overleveringsbekreftelse.md", "nb", giveaway],
    ["en/giveaway-transfer-confirmation.md", "en", giveaway],
  ] as const)("every tag in %s exists in the view", (file, locale, terms) => {
    const view = toContractView(terms, locale);
    const missing = tagsOf(templateBody(legal(file))).filter((t) => !resolvable(view, t));
    expect(missing).toEqual([]);
  });

  it("rendering is deterministic (§8.2) and fills the agreement", () => {
    const tpl = legal("nb/forenklet-leieavtale.md");
    const a = renderContract(tpl, rental(), "nb");
    const b = renderContract(tpl, rental(), "nb");
    expect(a.sha256).toBe(b.sha256);
    expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(a.text).toContain("LA-2026-000123");
    expect(a.text).toContain("14.12.2026 kl.");
    expect(a.text).toContain("300\u00a0kr"); // 2 × 150 kr
    expect(a.text).not.toMatch(/\{\{|<!--|UTVIKLERMERKNAD/);
    expect(renderContract(tpl, rental({ revision: 2 }), "nb").sha256).not.toBe(a.sha256);
  });

  it("free lending says so instead of a price", () => {
    const { text } = renderContract(
      legal("nb/forenklet-leieavtale.md"),
      rental({ price: { amountOre: 0, unit: "day", units: 2, totalOre: 0 } }),
      "nb",
    );
    expect(text).toContain("lånes ut **gratis**");
  });

  it("user text cannot inject HTML or Markdown (§8.3)", () => {
    const evil = rental({
      item: {
        title: "<script>alert(1)</script> **fet** [lenke](javascript:alert(1))",
        description: "# Overskrift\n<img src=x onerror=alert(2)>",
        categoryLabelNb: "Verktøy",
        categoryLabelEn: "Tools",
        condition: "good",
        knownDefects: "| tabell |",
      },
    });
    const { text } = renderContract(legal("nb/forenklet-leieavtale.md"), evil, "nb");
    const html = renderToStaticMarkup(createElement(Markdown, { source: text, locale: "nb" }));
    for (const bad of ["<script", "<img", "<h1>Overskrift", 'href="javascript:', "<strong>fet"])
      expect(html, bad).not.toContain(bad);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("detects material changes (§8.4)", () => {
    const base = rental();
    expect(materialChanges(base, rental({ period: { ...base.period, end: "2026-12-17T09:00:00.000Z" } }))).toEqual([
      "period",
    ]);
    expect(materialChanges(base, rental({ depositOre: 0 }))).toEqual(["depositOre"]);
    expect(materialChanges(base, rental({ handover: { method: "meet", deliveryFeeOre: null } }))).toEqual(["handover"]);
    expect(materialChanges(base, rental({ accessories: [] }))).toEqual(["accessories"]);
    expect(materialChanges(base, rental({ revision: 2, agreementNumber: "LA-2026-000999" }))).toEqual([]);
  });

  it("formats money in Norwegian style (§8.7) and gives a short public id", () => {
    expect(formatKr(150_000)).toBe("1 500 kr");
    expect(platformId("2b7c9f4e-0000-0000-0000-000000000000")).toBe("L-2B7C9F4E");
  });

  it("the mustache subset handles sections, inverted sections and lists", () => {
    const out = renderMustache(
      "{{#a}}A{{x}}{{/a}}{{^b}}noB{{/b}}{{#list}}[{{.}}]{{/list}}",
      { a: { x: "1" }, b: false, list: ["p", "q"] },
      (s) => s,
    );
    expect(out).toBe("A1noB[p][q]");
  });
});
