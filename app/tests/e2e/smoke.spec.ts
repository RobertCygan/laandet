import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { query, registerAndVerify, uniqueEmail } from "./support";

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

test("legal pages show version and that no lawyer has reviewed them; English shows that Norwegian prevails", async ({
  page,
}) => {
  await page.goto("/vilkar");
  // Final texts (D-058): no draft banner, but an honest note that no lawyer has reviewed them.
  await expect(page.getByText("Utkast – ikke juridisk gjennomgått")).toHaveCount(0);
  await expect(page.getByText("ikke gjennomgått av jurist").first()).toBeVisible();
  await expect(page.getByText(/Versjon \d+\.\d+\.\d+/).first()).toBeVisible();
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

test("signed in, the account links sit in one menu and the main menu stays on one line", async ({ page, isMobile }) => {
  test.skip(isMobile, "The account menu belongs to the desktop header; phones use the menu button.");
  await registerAndVerify(page, uniqueEmail("meny"), "Kari Nordmann");
  await page.goto("/");
  const main = page.getByRole("navigation", { name: "Hovedmeny" });
  for (const name of ["Utforsk", "Kategorier", "Ønskes leid", "Gis bort"]) {
    const box = await main.getByRole("link", { name, exact: true }).boundingBox();
    expect(box?.height, `${name} on one line`).toBeLessThan(60);
  }
  await expect(main.getByRole("link", { name: "Slik fungerer det" })).toHaveCount(0);

  const button = page.getByRole("button", { name: /Kontomeny/ });
  await expect(button).toContainText("Kari Nordmann");
  await expect(page.getByRole("link", { name: "Min profil" })).toHaveCount(0);
  await button.click();
  const menu = page.getByRole("navigation", { name: "Kontomeny" });
  for (const name of ["Slik fungerer det", "Meldinger", "Varsler", "Leieforhold", "Mine annonser", "Min profil"]) {
    await expect(menu.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Logg ut" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(button).toBeFocused();
  await menu.waitFor({ state: "detached" });
  await button.click();
  await page.getByRole("navigation", { name: "Kontomeny" }).getByRole("link", { name: "Min profil" }).click();
  await expect(page).toHaveURL(/\/konto$/);
});

test("a profile photo can be added, is shown to others and can be removed (D-061)", async ({
  page,
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "One run is enough; the header part needs the desktop layout.");
  const email = uniqueEmail("bilde");
  await registerAndVerify(page, email, "Per Bilde");
  await page.goto("/konto");
  await page.getByLabel("Velg bilde").setInputFiles(path.resolve("seed/demo-images/equipment-1.webp"));
  await page.getByRole("button", { name: "Lagre bilde" }).click();
  await expect(page.getByText("Profilbildet er lagret.")).toBeVisible();

  const [row] = await query<{ id: string; avatar: string }>(
    "SELECT u.id, p.avatar_media_id AS avatar FROM users u JOIN user_profiles p ON p.user_id = u.id WHERE u.email = $1",
    [email],
  );
  expect(row?.avatar).toBeTruthy();
  await page.reload();
  await expect(page.locator(`header img[src="/media/${row!.avatar}/thumb"]`)).toBeVisible();

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/profil/${row!.id}`);
  await expect(visitor.locator(`main img[src="/media/${row!.avatar}/thumb"]`)).toBeVisible();
  expect((await visitor.request.get(`/media/${row!.avatar}/thumb`)).status()).toBe(200);

  await page.getByRole("button", { name: "Fjern bilde" }).click();
  await expect(page.getByText("Profilbildet er fjernet.")).toBeVisible();
  expect((await visitor.request.get(`/media/${row!.avatar}/thumb`)).status()).toBe(404);
});

test.describe("front-page logo intro (D-062)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("plays at double speed, can be skipped, and does not come back inside the site", async ({ page }) => {
    await page.goto("/");
    const intro = page.getByTestId("logo-intro");
    await expect(intro).toBeVisible();
    await expect(page.getByRole("button", { name: "Hopp over intro" })).toBeFocused();
    await expect
      .poll(() => page.locator(".logo-intro-video").evaluate((v: HTMLVideoElement) => v.playbackRate))
      .toBe(2);
    await page.keyboard.press("Escape");
    await expect(intro).toHaveCount(0);
    await page.getByRole("main").getByRole("link", { name: "Finn noe å leie" }).first().click();
    await expect(page).toHaveURL(/\/utforsk/);
    await page.getByRole("link", { name: /Laandet – til forsiden/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(intro).toHaveCount(0);
  });

  test("ends by itself after a few seconds", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("logo-intro")).toBeVisible();
    await expect(page.getByTestId("logo-intro")).toHaveCount(0, { timeout: 8000 });
  });
});
