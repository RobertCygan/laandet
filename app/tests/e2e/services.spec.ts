import { expect, test } from "@playwright/test";
import { accessible, noHorizontalScroll, PHONE } from "./flows";
import { registerAndVerify, uniqueEmail, watchForInjection } from "./support";

/** D-063: a service listing is posted through the wizard and found under «Tjenester». */
test.describe("Tjenester at 390 px", () => {
  test.use(PHONE);

  test("offer a paid service → it shows under Tjenester with its price per hour", async ({ page }) => {
    test.setTimeout(120_000);
    const problems = watchForInjection(page);
    await registerAndVerify(page, uniqueEmail("tjeneste"), "Hege H.");
    await page.goto("/ny-annonse");
    await page.getByText("Tilby en tjeneste", { exact: true }).click();
    await page.getByLabel("Kategori").selectOption({ label: "Hagearbeid og plenklipping" });
    await page.getByRole("button", { name: "Neste" }).click();
    await page.getByLabel("Overskrift").fill("Plenklipping med egen klipper");
    await page.getByLabel("Beskrivelse").fill("Jeg klipper plenen din i Nordfold og tar med graset.");
    await page.getByRole("button", { name: "Neste" }).click();
    await page.getByRole("textbox", { name: /Pris/ }).fill("300");
    await page.getByRole("combobox", { name: /^Per/ }).selectOption({ label: "time" });
    await accessible(page);
    await page.getByRole("button", { name: "Neste" }).click();
    await page.getByRole("combobox", { name: "Område", exact: true }).selectOption({ label: "Nordfold" });
    // No handover choices for a service.
    await expect(page.getByText("Hentes av leietaker")).toBeHidden();
    const publish = page.getByRole("button", { name: "Publiser" });
    while (!(await publish.isVisible())) await page.getByRole("button", { name: "Neste" }).click();
    await publish.click();
    await expect(page).toHaveURL(/\/annonse\/[0-9a-f-]{36}\?lagret=published/);
    await expect(page.getByText("per time").first()).toBeVisible();

    await page.goto("/utforsk?type=tjenester");
    const card = page.locator("article").filter({ hasText: "Plenklipping med egen klipper" });
    await expect(card).toBeVisible();
    await expect(card.getByText("Tjeneste tilbys")).toBeVisible();
    await expect(page.getByRole("link", { name: "Tjenester" }).first()).toBeVisible();
    await accessible(page);
    await noHorizontalScroll(page);
    expect(problems).toEqual([]);
  });

  test("sign-up offers a business account with an org number instead of the private-use box", async ({ page }) => {
    await page.goto("/registrer");
    await expect(page.getByLabel(/som privatperson/)).toBeVisible();
    await page.getByText("Bedrift eller forening", { exact: true }).click();
    await expect(page.getByLabel(/Organisasjonsnummer/)).toBeVisible();
    await expect(page.getByLabel(/som privatperson/)).toBeHidden();
    await accessible(page);
  });
});
