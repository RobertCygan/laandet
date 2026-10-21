import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";
const url = pathToFileURL(path.resolve("out/Laanndet.html")).href;
const issues = new WeakMap<Page, string[]>();
const requests = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, context }) => {
  await page.addLocatorHandler(
    page.getByRole("button", { name: "Hopp over intro" }),
    async (locator) => locator.click(),
  );
  await context.setOffline(true);
  const errors: string[] = [];
  const network: string[] = [];
  issues.set(page, errors);
  requests.set(page, network);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) network.push(request.url());
  });
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
test.afterEach(async ({ page }) => {
  expect(issues.get(page)).toEqual([]);
  expect(
    requests.get(page),
    "No external requests from the self-contained file",
  ).toEqual([]);
});
test("standalone home embeds all assets and navigates to all 18 rentals", async ({
  page,
}) => {
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Lei det du trenger.",
  );
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page
      .locator(".hero-visual img")
      .evaluate(
        (img: HTMLImageElement) =>
          img.complete &&
          img.naturalWidth > 0 &&
          img.src.startsWith("data:image/"),
      ),
  ).toBe(true);
  await page
    .getByRole("link", { name: "Finn noe å leie", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/utforsk$/);
  await expect(page.getByTestId("listing-card")).toHaveCount(18);
  for (const card of await page.getByTestId("listing-card").all())
    await expect(card.getByText("Demoannonse", { exact: true })).toBeVisible();
});
test("standalone search and filtering work with no server", async ({
  page,
}) => {
  await page
    .getByRole("textbox", { name: "Hva trenger du?" })
    .fill("tepperenser");
  await page.getByRole("button", { name: "Søk i nabolaget" }).click();
  await expect(page.getByTestId("listing-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Tøm søk" }).click();
  await page.getByLabel("Kategori", { exact: true }).selectOption("hage");
  await expect(page.getByTestId("listing-card")).toHaveCount(4);
  await page.getByLabel("Område", { exact: true }).selectOption("Leines");
  await expect(page.getByTestId("listing-card")).toHaveCount(2);
});
test("standalone wanted posts and response modal remain transparent", async ({
  page,
}) => {
  await page.goto(url + "#/utforsk?type=wanted");
  await expect(page.getByTestId("wanted-card")).toHaveCount(5);
  await page
    .getByRole("button", { name: "Jeg har dette", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Denne annonsen er et eksempel",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ja", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "registrert lokalt",
  );
});
test("standalone detail has working images, calendar, delivery and file sharing guidance", async ({
  page,
}) => {
  await page.goto(url + "#/annonse/hoytrykksspyler");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Høytrykksspyler",
  );
  await page.getByRole("button", { name: "Forstørr eksempelbildet" }).click();
  await expect(
    page.getByRole("dialog", { name: "Forstørret eksempelbilde" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "uke 500 kr" }).click();
  await page.getByLabel("Jeg er interessert i levering").check();
  await expect(page.locator(".price-total")).toContainText("600 kr");
  await page.getByRole("button", { name: "26. oktober", exact: true }).click();
  await expect(page.locator(".calendar")).toContainText(
    "Datoen blir ikke reservert",
  );
  await page.getByRole("button", { name: "Del", exact: true }).click();
  await expect(
    page.getByText(
      "Dette er en lokal demo. Del HTML-filen, ikke adressen i nettleseren.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send forespørsel" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ja", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("status")).toBeVisible();
});
test("standalone survey saves locally and populates the local dashboard", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Hva synes du?" }).click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Neste", exact: true }).click();
  await expect(d.getByRole("alert")).toContainText("Velg minst ett svar");
  for (const answer of [
    "Ja",
    "Begge deler",
    "Verktøy",
    "Kanskje",
    "Gode priser",
    "5–15 km",
    "Ja",
  ]) {
    await d.getByRole("button", { name: answer, exact: true }).click();
    await d.getByRole("button", { name: "Neste", exact: true }).click();
  }
  await d.getByLabel("Dine tanker").fill("Enkel lokal utleie.");
  await d.getByRole("button", { name: "Fortsett", exact: true }).click();
  await d.getByRole("button", { name: "Lagre svaret" }).click();
  await expect(
    d.getByRole("heading", { name: "Du er med på å forme Lånndet." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("laanndet:surveys:v1") ?? "[]").length,
    ),
  ).toBe(1);
  await page.keyboard.press("Escape");
  await page.goto(url + "#/research");
  await expect(
    page
      .locator(".metric")
      .filter({ hasText: "Fullførte spørreskjema" })
      .getByRole("strong"),
  ).toHaveText("1");
});
test("standalone listing wizard accepts pictures and completes only a local demo", async ({
  page,
}) => {
  await page.goto(url + "#/ny-annonse");
  await page
    .getByLabel("Velg kategori", { exact: true })
    .selectOption("verktoy");
  await page.getByRole("button", { name: "Neste", exact: true }).click();
  await page
    .getByLabel("Tittel", { exact: true })
    .fill("Batteridrill til helgen");
  await page
    .getByLabel("Beskrivelse", { exact: true })
    .fill("En praktisk drill med to batterier og lader til mindre prosjekter.");
  await page
    .getByLabel("Velg bilder")
    .setInputFiles("public/images/equipment-5.webp");
  await expect(page.locator(".upload-previews img")).toHaveCount(1);
  await page.getByRole("button", { name: "Neste", exact: true }).click();
  await page.getByLabel("Per dag", { exact: false }).fill("120");
  await page.getByRole("button", { name: "Neste", exact: true }).click();
  await page.getByLabel("Område", { exact: true }).selectOption("Leinesfjord");
  await page.getByLabel("Postnummer", { exact: true }).fill("8283");
  await page.getByRole("button", { name: "Forhåndsvis annonse" }).click();
  await expect(page.locator(".listing-preview")).toContainText("120 kr / dag");
  await page.getByRole("button", { name: "Fullfør demoen" }).click();
  await expect(
    page.getByRole("heading", { name: "Lånndet er ikke lansert ennå." }),
  ).toBeVisible();
});
test("standalone privacy export, favorite persistence and deletion work", async ({
  page,
}) => {
  await page.goto(url + "#/annonse/kajakk");
  await page.getByRole("button", { name: "Lagre", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Lagret", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto(url + "#/personvern");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Last ned mine data" }).click();
  expect((await download).suggestedFilename()).toContain("laanndet");
  await page
    .getByRole("button", { name: "Slett lokale data", exact: true })
    .click();
  await page.getByRole("button", { name: "Ja, slett alt lokalt" }).click();
  await expect(page.getByRole("status")).toContainText("slettet");
  expect(
    await page.evaluate(() => localStorage.getItem("laanndet:favorites:v1")),
  ).toBeNull();
});
test("standalone categories, profile and legal pages are included", async ({
  page,
}) => {
  await page.goto(url + "#/kategorier");
  await expect(page.locator(".category-card")).toHaveCount(19);
  await page.goto(url + "#/profil/owner-0");
  await expect(page.getByText("Eksempelprofil", { exact: true })).toBeVisible();
  for (const route of ["om", "trygghet", "vilkar", "kontakt"]) {
    await page.goto(url + "#/" + route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.goto(url + "#/finnes-ikke");
  await expect(
    page.getByRole("heading", { name: "Denne siden fant vi ikke." }),
  ).toBeVisible();
});
test("standalone mobile navigation and responsive layout work", async ({
  page,
}) => {
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Åpne meny" }).click();
  await page
    .getByRole("navigation", { name: "Mobilmeny" })
    .getByRole("link", { name: "Ønskes leid" })
    .click();
  await expect(page.getByTestId("wanted-card")).toHaveCount(5);
});
test("standalone home and survey retain automated accessibility", async ({
  page,
}) => {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Hva synes du?" }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
