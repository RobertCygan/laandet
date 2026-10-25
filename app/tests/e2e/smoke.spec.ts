import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const FOOTER_PATHS = [
  "/om",
  "/slik-fungerer-det",
  "/trygghet",
  "/stott-laandet",
  "/apenhet",
  "/kontakt",
  "/vilkar",
  "/personvern",
  "/informasjonskapsler",
  "/retningslinjer/forbudte-gjenstander",
  "/retningslinjer/trygg-utleie",
  "/retningslinjer/tvister",
  "/avtaler/forenklet-leieavtale",
  "/avtaler/utvidet-leieavtale",
  "/avtaler/gis-bort",
  "/kategorier",
  "/utforsk",
];

test("every footer and content page answers in both languages", async ({ request }) => {
  for (const p of FOOTER_PATHS) {
    for (const prefix of ["", "/en"]) {
      const res = await request.get(`${prefix}${p}`);
      expect(res.status(), `${prefix}${p}`).toBe(200);
    }
  }
});

test("legal pages show version and the draft label; English shows that Norwegian prevails", async ({ page }) => {
  await page.goto("/vilkar");
  await expect(page.getByText("Utkast – ikke juridisk gjennomgått").first()).toBeVisible();
  await expect(page.getByText(/Versjon 0\.1\.0/).first()).toBeVisible();
  await expect(page.locator("#rangering")).toHaveCount(1);
  await page.goto("/en/vilkar");
  await expect(page.getByText("Informational translation. The Norwegian version is the binding one.")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("N11: the support page has no campaign link until a real campaign is configured", async ({ page }) => {
  await page.goto("/stott-laandet");
  await expect(page.getByText("Vi har ikke startet noen innsamling ennå.")).toBeVisible();
  const outbound = await page.locator("main a[href^='http']").count();
  expect(outbound).toBe(0);
});

test("language switch keeps the page and Norwegian number formats", async ({ page }) => {
  await page.goto("/utforsk");
  await page.getByRole("link", { name: "English" }).first().click();
  await expect(page).toHaveURL(/\/en\/utforsk$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Explore nearby");
  const prices = await page.locator(".price strong").allTextContents();
  expect(prices.some((p) => /^\d{1,3}( \d{3})* kr$/.test(p))).toBe(true);
});

test("security headers are set on every page", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});

for (const p of ["/", "/utforsk", "/kategorier", "/registrer", "/logg-inn", "/vilkar", "/en"]) {
  test(`accessibility: no serious or critical axe violations on ${p}`, async ({ page }) => {
    await page.goto(p);
    // @axe-core/playwright is typed against its own playwright-core copy; the runtime object is the same.
    const results = await new AxeBuilder({
      page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"],
    })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(
      serious.map(
        (v) =>
          `${v.id}: ${v.nodes
            .map((n) => n.target.join(" "))
            .slice(0, 3)
            .join(" | ")}`,
      ),
    ).toEqual([]);
  });
}
