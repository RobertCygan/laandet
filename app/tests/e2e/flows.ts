import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Browser, type Page } from "@playwright/test";
import { grantRole, publishRental, query, registerAndVerify, signIn, totp, uniqueEmail } from "./support";

/** Shared steps for the Phase 02–03 journeys (rental, case, reviews). */
export const PHOTO = path.resolve("seed/demo-images/equipment-1.webp");
export const osloDate = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(d);
export const inDays = (n: number) => osloDate(new Date(Date.now() + n * 24 * 3600 * 1000));

export async function setRentalsOpen(on: boolean) {
  await query(
    `INSERT INTO feature_flags (key, enabled, description) VALUES ('rentals_open', $1, 'e2e')
     ON CONFLICT (key) DO UPDATE SET enabled = $1`,
    [on],
  );
}

/** No serious or critical axe violations (WCAG 2.1 AA), as in the smoke tests. */
export async function accessible(page: Page) {
  const results = await new AxeBuilder({
    page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"],
  })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Records this party's condition entry on the open page (handover or return). */
export async function addEntry(page: Page, opts: { photo?: boolean; outcome?: string } = {}) {
  await page.getByRole("combobox", { name: "Tilstand", exact: true }).selectOption("good");
  await page.getByRole("combobox", { name: "Fungerer den?" }).selectOption("works");
  if (opts.outcome) await page.getByLabel(opts.outcome).check();
  if (opts.photo) {
    await page.locator('input[type="file"][capture="environment"]').setInputFiles(PHOTO);
    await expect(page.locator('input[name="photoId"]')).toHaveCount(1, { timeout: 20_000 });
  }
  await page.getByRole("button", { name: "Lagre registreringen" }).click();
  await expect(page.getByText("Registreringen er lagret.")).toBeVisible();
}

export async function confirmEntry(page: Page, checklist: boolean) {
  if (checklist) for (const box of await page.locator('input[name="check"]').all()) await box.check();
  await page.getByRole("button", { name: "Bekreft", exact: true }).click();
}

export const PHONE = { viewport: { width: 390, height: 844 } };

/**
 * Through the UI: owner publishes, renter asks for tomorrow → day after, owner accepts, both accept the
 * agreement, the handover is recorded and confirmed by both. Returns both pages and the booking path.
 */
export async function rentalHandedOver(browser: Browser, prefix: string) {
  const owner = await (await browser.newContext(PHONE)).newPage();
  await registerAndVerify(owner, uniqueEmail(`${prefix}-eier`), "Eva E.");
  const listingId = await publishRental(owner, "Hekksaks");
  const renter = await (await browser.newContext(PHONE)).newPage();
  await registerAndVerify(renter, uniqueEmail(`${prefix}-leier`), "Rolf R.");
  await renter.goto(`/annonse/${listingId}`);
  const form = renter.locator("form").filter({ has: renter.locator('input[name="startDate"]') });
  await form.getByLabel("Fra dato").fill(inDays(1));
  await form.getByLabel("Til dato").fill(inDays(2));
  await form.getByRole("button", { name: "Send forespørsel" }).click();
  await expect(renter).toHaveURL(/\/leieforhold\/[0-9a-f-]{36}\?ok=requested/);
  const bookingPath = new URL(renter.url()).pathname;
  await owner.goto(bookingPath);
  await owner.getByRole("button", { name: "Godta forespørselen" }).click();
  await expect(owner.getByText("Du har godtatt forespørselen.")).toBeVisible();
  for (const p of [owner, renter]) {
    await p.goto(`${bookingPath}/avtale`);
    await p.getByLabel("Jeg har lest hele avtalen og godtar den.").check();
    await p.getByRole("button", { name: "Jeg godtar avtalen" }).click();
    await expect(p).toHaveURL(/\/avtale\?ok=(waiting|confirmed)/);
  }
  await expect(renter.getByText("Begge har godtatt. Leieforholdet er bekreftet.")).toBeVisible();
  await owner.goto(`${bookingPath}/utlevering`);
  await addEntry(owner);
  await confirmEntry(owner, true);
  await expect(owner.getByText("Du har bekreftet. Venter på den andre parten.")).toBeVisible();
  await renter.goto(`${bookingPath}/utlevering`);
  await confirmEntry(renter, true);
  await expect(renter.getByText("Begge har bekreftet.").first()).toBeVisible();
  return { owner, renter, bookingPath };
}

/** Registers a staff member, grants the role through the audited CLI and sets up TOTP 2FA (needed for /admin). */
export async function staffWithTotp(page: Page, role: "admin" | "moderator" = "admin", name = "Admin A.") {
  const email = uniqueEmail(role);
  await registerAndVerify(page, email, name);
  grantRole(email, role);
  await signIn(page, email);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/konto\/tofaktor/);
  await page.getByLabel("Passord").fill("en lang og trygg setning");
  await page.getByRole("button", { name: "Start oppsett" }).click();
  const secret = (await page.locator("code").first().textContent())!.replace(/\s/g, "");
  await page.getByLabel("Kode").fill(totp(secret));
  await page.getByRole("button", { name: "Bekreft med kode" }).click();
  await expect(page.getByText("Tofaktorinnlogging er slått på.")).toBeVisible();
}
