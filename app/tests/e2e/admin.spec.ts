import { expect, test, type Page } from "@playwright/test";
import { accessible, staffWithTotp } from "./flows";
import { query } from "./support";

const adminWithTotp = (page: Page) => staffWithTotp(page, "admin");

const REASON = "Pilotdrift: endring avtalt med eieren.";

test.describe("admin panel and transparency (P03-04, P03-07)", () => {
  test.beforeAll(async () => {
    await query("UPDATE user_profiles SET role = 'user' WHERE role <> 'user'");
    await query("DELETE FROM transparency_months");
    await query("UPDATE feature_flags SET enabled = false WHERE key = 'rentals_open'");
  });
  test.afterAll(async () => {
    await query("DELETE FROM transparency_months");
    await query("UPDATE feature_flags SET enabled = false, updated_by = NULL WHERE key = 'rentals_open'");
  });

  test("every admin section opens for an admin with 2FA and passes axe; a flag switch is logged", async ({ page }) => {
    test.setTimeout(150_000);
    await adminWithTotp(page);

    for (const [path, heading] of [
      ["/admin/tall", "Driftstall"],
      ["/admin/kategorier", "Kategorier"],
      ["/admin/steder", "Steder"],
      ["/admin/flagg", "Funksjonsbrytere"],
      ["/admin/juridisk", "Juridiske tekster"],
      ["/admin/sikkerhet", "Sikkerhetslogg"],
      ["/admin/apenhet", "Åpenhet: tall"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await accessible(page);
    }

    // Open rental requests from the browser, with a reason.
    await page.goto("/admin/flagg");
    const card = page.locator("li").filter({ has: page.locator("code", { hasText: /^rentals_open$/ }) });
    await card.locator("summary").click();
    await card.getByLabel(/Begrunnelse/).fill(REASON);
    await card.getByRole("button", { name: "Slå på" }).click();
    await expect(page).toHaveURL(/\/admin\/flagg\?lagret=1/);
    await expect(card.getByText("På", { exact: true })).toBeVisible();
    await expect(card.getByText(/Sist endret .* av Admin A\./)).toBeVisible();

    await page.goto("/admin/sikkerhet?handling=flag.");
    await expect(page.getByText("flag.updated")).toBeVisible();
    await expect(page.getByText(REASON)).toBeVisible();
    await accessible(page);
  });

  test("/apenhet: the empty state, then a month the owner entered, never the internal source", async ({ browser }) => {
    test.setTimeout(150_000);
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto("/apenhet");
    await expect(visitor.getByText(/Vi publiserer tall når de første fakturaene/)).toBeVisible();
    await expect(visitor.getByRole("heading", { name: "Forventede kostnader (estimat)" })).toBeVisible();
    await accessible(visitor);

    const admin = await (await browser.newContext()).newPage();
    await adminWithTotp(admin);
    await admin.goto("/admin/apenhet");
    await admin.getByLabel("Måned", { exact: true }).fill("2026-09");
    await admin.getByLabel("Driftskostnader totalt, inkl. mva. (kr)").fill("212,50");
    await admin.getByLabel("Herav server (kr)").fill("93");
    await admin.getByLabel("Merknad (vises offentlig)").fill("Første måned med server.");
    await admin.getByLabel("Kilde (internt)").fill("Faktura H-123");
    await admin.getByLabel(/Begrunnelse/).fill(REASON);
    await admin.getByRole("button", { name: "Lagre måneden" }).click();
    await expect(admin).toHaveURL(/\/admin\/apenhet\?lagret=1/);

    await visitor.reload();
    await expect(visitor.getByRole("heading", { name: "september 2026" })).toBeVisible();
    await expect(visitor.getByText(/212,50/)).toBeVisible();
    await expect(visitor.getByText("Første måned med server.")).toBeVisible();
    await expect(visitor.getByText("Faktura H-123")).toHaveCount(0);
    await accessible(visitor);
  });
});
