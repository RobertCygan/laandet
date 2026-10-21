import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  await page.addLocatorHandler(
    page.getByRole("button", { name: "Hopp over intro" }),
    async (locator) => locator.click(),
  );
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (e) => list.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") list.push(m.text());
  });
});
test.afterEach(async ({ page }, info) => {
  if (info.title.includes("missing listing")) return;
  expect(errors.get(page) ?? [], "No browser console errors").toEqual([]);
});
async function startSurvey(page: Page) {
  await page.getByRole("button", { name: "Hva synes du?" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
async function completeSurveyToContact(page: Page) {
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Ja", exact: true }).click();
  await d.getByRole("button", { name: "Neste", exact: true }).click();
  await d.getByRole("button", { name: "Begge deler", exact: true }).click();
  await d.getByRole("button", { name: "Neste", exact: true }).click();
  await d.getByRole("button", { name: "Verktøy", exact: true }).click();
  await d.getByRole("button", { name: "Friluftsliv", exact: true }).click();
  await d.getByRole("button", { name: "Neste", exact: true }).click();
  await d.getByRole("button", { name: "Kanskje", exact: true }).click();
  await d.getByRole("button", { name: "Neste", exact: true }).click();
  await d.getByRole("button", { name: "Gode priser", exact: true }).click();
  await d.getByRole("button", { name: "Levering", exact: true }).click();
  await d.getByRole("button", { name: "Neste", exact: true }).click();
  await d.getByRole("button", { name: "5–15 km", exact: true }).click();
  await d.getByRole("button", { name: "Neste", exact: true }).click();
  await d.getByRole("button", { name: "Ja", exact: true }).click();
  await d.getByRole("button", { name: "Neste", exact: true }).click();
  await d.getByLabel("Dine tanker").fill("Enkel henting og forutsigbar pris.");
  await d.getByRole("button", { name: "Fortsett", exact: true }).click();
}

test("homepage is a transparent Norwegian marketplace", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Lånndet/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Lei det du trenger.Lån bort det du har.",
  );
  await expect(
    page.getByText("Vi bygger Lånndet sammen.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("listing-card")).toHaveCount(8);
  for (const card of await page.getByTestId("listing-card").all())
    await expect(card.getByText("Demoannonse", { exact: true })).toBeVisible();
  await expect(page.locator("img").first()).toHaveJSProperty("complete", true);
});
test("search from homepage navigates and filters", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Hva trenger du?" })
    .fill("tepperenser");
  await page.getByRole("button", { name: "Søk i nabolaget" }).click();
  await expect(page).toHaveURL(/utforsk\?q=tepperenser/);
  await expect(page.getByTestId("listing-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Teppe- og møbelrenser" }),
  ).toBeVisible();
});
test("all 18 fictional rentals and all categories are available", async ({
  page,
}) => {
  await page.goto("/utforsk");
  await expect(page.getByTestId("listing-card")).toHaveCount(18);
  await expect(
    page.getByLabel("Kategori", { exact: true }).locator("option"),
  ).toHaveCount(20);
  for (const c of await page.getByTestId("listing-card").all())
    await expect(c.getByText("Demoannonse")).toBeVisible();
});
test("category, location, price, period and delivery filters work", async ({
  page,
}) => {
  await page.goto("/utforsk");
  await page.getByLabel("Kategori", { exact: true }).selectOption("hage");
  await expect(page.getByTestId("listing-card")).toHaveCount(4);
  await page.getByLabel("Område", { exact: true }).selectOption("Leines");
  await expect(page.getByTestId("listing-card")).toHaveCount(2);
  await page.getByLabel("Kan leveres", { exact: true }).check();
  await expect(page.getByTestId("listing-card")).toHaveCount(1);
  await page.getByLabel("Prisintervall").selectOption("week");
  await page.locator("#max-price").fill("500");
  await expect(page.getByTestId("listing-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Nullstill filtre" }).click();
  await expect(page.getByTestId("listing-card")).toHaveCount(18);
  await page.getByLabel("Prisintervall").selectOption("hour");
  await expect(page.getByTestId("listing-card")).toHaveCount(4);
});
test("availability filter excludes unavailable dates", async ({ page }) => {
  await page.goto("/utforsk");
  await page.getByLabel("Fra dato", { exact: true }).fill("2026-10-24");
  await page.getByLabel("Til dato", { exact: true }).fill("2026-10-25");
  await expect(page.getByTestId("listing-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Nullstill filtre" }).click();
  await page.getByLabel("Fra dato", { exact: true }).fill("2026-10-26");
  await expect(page.getByTestId("listing-card")).toHaveCount(18);
});
test("favorites persist after refresh", async ({ page }) => {
  await page.goto("/utforsk");
  const save = page.getByRole("button", {
    name: "Lagre Høytrykksspyler med terrassevasker som favoritt",
    exact: true,
  });
  await save.click();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Fjern Høytrykksspyler med terrassevasker fra favoritt",
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Mine favoritter", { exact: true }).check();
  await expect(page.getByTestId("listing-card")).toHaveCount(1);
});
test("wanted toggle is first class and response is research only", async ({
  page,
}) => {
  await page.goto("/utforsk");
  await page.getByRole("button", { name: "Ønskes leid", exact: true }).click();
  await expect(page.getByTestId("wanted-card")).toHaveCount(5);
  for (const c of await page.getByTestId("wanted-card").all())
    await expect(c.getByText("Demoannonse")).toBeVisible();
  await page
    .getByRole("button", { name: "Jeg har dette", exact: true })
    .first()
    .click();
  const d = page.getByRole("dialog");
  await expect(d.getByText(/Denne annonsen er et eksempel/)).toBeVisible();
  await d.getByRole("button", { name: "Ja", exact: true }).click();
  await expect(d.getByRole("status")).toContainText("registrert lokalt");
});
test("homepage toggle exposes wanted cards", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ønskes leid", exact: true }).click();
  await expect(page.getByTestId("wanted-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Til leie", exact: true }).click();
  await expect(page.getByTestId("wanted-card")).toHaveCount(0);
});
test("detail gallery, price discounts, delivery, calendar and intent work", async ({
  page,
}) => {
  await page.goto("/annonse/hoytrykksspyler");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Høytrykksspyler",
  );
  await page.getByRole("button", { name: "Forstørr eksempelbildet" }).click();
  await expect(
    page.getByRole("dialog", { name: "Forstørret eksempelbilde" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "uke 500 kr" }).click();
  await expect(page.locator(".price-total")).toContainText("500 kr");
  await page.getByLabel("Jeg er interessert i levering").check();
  await expect(page.locator(".price-total")).toContainText("600 kr");
  await page.getByRole("button", { name: "26. oktober", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Datoen blir ikke reservert",
  );
  await expect(
    page.getByRole("button", { name: "24. oktober, utilgjengelig" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Send forespørsel" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Ingen reservasjon, betaling",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kanskje", exact: true })
    .click();
  const recorded = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("laanndet:events:v1") ?? "[]"),
  );
  expect(
    recorded.some(
      (e: { name: string; data: { price: number } }) =>
        e.name === "rent_cta_clicked" && e.data.price === 500,
    ),
  ).toBe(true);
});
test("wanted detail has a demo owner and research response", async ({
  page,
}) => {
  await page.goto("/annonse/minigraver");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "minigraver",
  );
  await expect(
    page.getByText("Opptil 1 500 kr", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Jeg har dette" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Ville du vurdert å leie ut",
  );
});
test("illustrative map markers open previews without private addresses", async ({
  page,
}) => {
  await page.goto("/utforsk");
  await page.getByRole("button", { name: "Kartvisning" }).click();
  await expect(
    page.getByText(
      "Illustrasjonskart · omtrentlige områder, ingen private adresser",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Vis Høytrykksspyler med terrassevasker, Leinesfjord",
    })
    .click();
  await expect(page.getByTestId("listing-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Høytrykksspyler med terrassevasker" }),
  ).toBeVisible();
});
test("survey validates each step and saves all nine answers without contact", async ({
  page,
}) => {
  await page.goto("/");
  await startSurvey(page);
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Neste", exact: true }).click();
  await expect(d.getByRole("alert")).toContainText("Velg minst ett svar");
  await completeSurveyToContact(page);
  await d.getByRole("button", { name: "Lagre svaret" }).click();
  await expect(
    d.getByRole("heading", { name: "Du er med på å forme Lånndet." }),
  ).toBeVisible();
  const answers = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("laanndet:surveys:v1") ?? "[]"),
  );
  expect(answers).toHaveLength(1);
  expect(answers[0].categories).toEqual(["Verktøy", "Friluftsliv"]);
  expect(answers[0].contact).toBeUndefined();
  await page.keyboard.press("Escape");
  await page.goto("/research");
  await expect(
    page
      .locator(".metric")
      .filter({ hasText: "Fullførte spørreskjema" })
      .getByRole("strong"),
  ).toHaveText("1");
});
test("optional contact requires valid format and consent", async ({ page }) => {
  await page.goto("/");
  await startSurvey(page);
  await completeSurveyToContact(page);
  const d = page.getByRole("dialog");
  await d
    .getByLabel("E-post eller telefon (valgfritt)")
    .fill("ikke-en-adresse");
  await d.getByRole("button", { name: "Lagre svaret" }).click();
  await expect(d.getByRole("alert")).toContainText("gyldig e-post");
  await d
    .getByLabel("E-post eller telefon (valgfritt)")
    .fill("test@example.org");
  await d.getByRole("button", { name: "Lagre svaret" }).click();
  await expect(d.getByRole("alert")).toBeVisible();
  await d.getByRole("checkbox").check();
  await d.getByRole("button", { name: "Lagre svaret" }).click();
  await expect(
    d.getByRole("heading", { name: "Du er med på å forme Lånndet." }),
  ).toBeVisible();
});
test("wizard validates, accepts images, previews and does not publish", async ({
  page,
}) => {
  await page.goto("/ny-annonse");
  await page.getByRole("button", { name: "Neste", exact: true }).click();
  await expect(page.locator(".form-error[role=alert]")).toContainText(
    "kategori",
  );
  await page
    .getByLabel("Velg kategori", { exact: true })
    .selectOption("verktoy");
  await page.getByRole("button", { name: "Neste", exact: true }).click();
  await page
    .getByLabel("Tittel", { exact: true })
    .fill("Batteridrill til små prosjekter");
  await page
    .getByLabel("Beskrivelse", { exact: true })
    .fill("En lett og praktisk batteridrill med to batterier og en lader.");
  await page
    .getByLabel("Velg bilder")
    .setInputFiles("public/images/equipment-5.webp");
  await expect(page.locator(".upload-previews img")).toHaveCount(1);
  await page.getByRole("button", { name: "Neste", exact: true }).click();
  await page.getByLabel("Per dag", { exact: false }).fill("125");
  await page.getByLabel("Per uke", { exact: false }).fill("450");
  await page.getByLabel("Jeg kan tilby levering").check();
  await page.getByLabel("Pris for levering (kr)").fill("100");
  await page.getByRole("button", { name: "Neste", exact: true }).click();
  await page.getByLabel("Område", { exact: true }).selectOption("Leinesfjord");
  await page.getByLabel("Postnummer", { exact: true }).fill("8283");
  await page.getByRole("button", { name: "Forhåndsvis annonse" }).click();
  await expect(
    page.getByRole("heading", { name: "Batteridrill til små prosjekter" }),
  ).toBeVisible();
  await expect(page.locator(".listing-preview")).toContainText("125 kr / dag");
  await page.getByRole("button", { name: "Fullfør demoen" }).click();
  await expect(
    page.getByRole("heading", { name: "Lånndet er ikke lansert ennå." }),
  ).toBeVisible();
  await expect(page.getByText(/vises ikke til andre/)).toBeVisible();
  await page.getByRole("button", { name: "Ja, gi meg beskjed" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "lagres bare i nettleseren",
  );
});
test("wanted wizard has budget and restores a local draft", async ({
  page,
}) => {
  await page.goto("/ny-annonse?type=wanted");
  await expect(
    page.getByRole("button", { name: /Jeg ønsker å leie/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByLabel("Velg kategori", { exact: true })
    .selectOption("camping");
  await page.getByRole("button", { name: "Neste", exact: true }).click();
  await page
    .getByLabel("Tittel", { exact: true })
    .fill("Trenger telt til en helgetur");
  await page
    .getByLabel("Beskrivelse", { exact: true })
    .fill("Ønsker å leie et telt for to voksne til en rolig tur på fjellet.");
  await page.getByRole("button", { name: "Lagre kladd", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Gjenopprett lokal kladd" }).click();
  await expect(page.getByRole("status")).toContainText("gjenopprettet");
  await page.getByRole("button", { name: "Neste", exact: true }).click();
  await expect(page.getByLabel("Tittel", { exact: true })).toHaveValue(
    "Trenger telt til en helgetur",
  );
  await page.getByRole("button", { name: "Neste", exact: true }).click();
  await page.getByLabel("Budsjett", { exact: true }).fill("Etter avtale");
  await page.getByRole("button", { name: "Neste", exact: true }).click();
  await page.getByLabel("Område", { exact: true }).selectOption("Nordskot");
  await page.getByLabel("Postnummer", { exact: true }).fill("8288");
  await page.getByRole("button", { name: "Forhåndsvis annonse" }).click();
  await expect(page.locator(".listing-preview")).toContainText("Ønskes leid");
});
test("login is an honest future feature and launch interest is local only", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Logg inn", exact: true }).click();
  const d = page.getByRole("dialog");
  await expect(d).toContainText("Innlogging og konto kommer ved lansering");
  await d
    .getByLabel("E-post eller telefon", { exact: true })
    .fill("test@example.org");
  await d.getByRole("checkbox").check();
  await d.getByRole("button", { name: "Ja, jeg vil teste" }).click();
  await expect(d.getByRole("status")).toContainText(
    "ikke meldt på en utsendelse",
  );
});
test("privacy export and delete work and tracking can be disabled", async ({
  page,
}) => {
  await page.goto("/annonse/kajakk");
  await page.goto("/personvern");
  await page
    .getByLabel("Registrer anonyme handlinger bare i denne nettleseren")
    .uncheck();
  const count = await page.evaluate(
    () => JSON.parse(localStorage.getItem("laanndet:events:v1") ?? "[]").length,
  );
  await page.goto("/utforsk");
  await page.goto("/personvern");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("laanndet:events:v1") ?? "[]").length,
    ),
  ).toBe(count);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Last ned mine data" }).click();
  expect((await download).suggestedFilename()).toContain("laanndet");
  await page
    .getByRole("button", { name: "Slett lokale data", exact: true })
    .click();
  await page.getByRole("button", { name: "Ja, slett alt lokalt" }).click();
  await expect(page.getByRole("status")).toContainText("slettet");
  expect(
    await page.evaluate(() => localStorage.getItem("laanndet:events:v1")),
  ).toBeNull();
});
test("profile never claims real verification or reviews", async ({ page }) => {
  await page.goto("/profil/owner-0");
  await expect(page.getByText("Eksempelprofil", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Kommer ved lansering", { exact: true }),
  ).toHaveCount(3);
  await expect(page.getByText(/Ingen identitet er verifisert/)).toBeVisible();
});
test("missing listing returns an intentional 404", async ({ page }) => {
  const response = await page.goto("/annonse/finnes-ikke");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Denne siden fant vi ikke." }),
  ).toBeVisible();
});
test("mobile navigation opens, closes and navigates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Åpne meny" }).click();
  const menu = page.getByRole("navigation", { name: "Mobilmeny" });
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "Ønskes leid" }).click();
  await expect(page).toHaveURL(/type=wanted/);
  await expect(menu).not.toBeVisible();
  await expect(page.getByTestId("wanted-card")).toHaveCount(5);
  await page.getByRole("button", { name: "Åpne meny" }).click();
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
});
for (const width of [360, 390, 430, 768, 1024, 1440, 1920])
  test(`responsive layout at ${width}px has no horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "/",
      "/utforsk",
      "/annonse/hoytrykksspyler",
      "/ny-annonse",
    ]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        route,
      ).toBe(true);
    }
    await page.goto("/");
    await page.screenshot({
      path: `test-results/home-${width}.png`,
      fullPage: true,
    });
  });
for (const route of [
  "/",
  "/utforsk",
  "/annonse/hoytrykksspyler",
  "/ny-annonse",
  "/personvern",
])
  test(`WCAG automated accessibility ${route}`, async ({ page }) => {
    await page.goto(route);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  });
test("survey modal supports keyboard focus containment and accessibility", async ({
  page,
}) => {
  await page.goto("/");
  await startSurvey(page);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      Boolean(document.activeElement?.closest("dialog")),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("all 19 category cards navigate to a meaningful filter or empty state", async ({
  page,
}) => {
  await page.goto("/kategorier");
  await expect(page.locator(".category-card")).toHaveCount(19);
  await page.getByRole("link", { name: /Foto og video/ }).click();
  await expect(page).toHaveURL(/category=foto/);
  await expect(
    page.getByRole("heading", { name: "Ikke helt det du lette etter?" }),
  ).toBeVisible();
});

test("research intent never sends booking or payment requests", async ({
  page,
}) => {
  await page.goto("/annonse/kajakk");
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method()))
      mutations.push(request.url());
  });
  await page.getByRole("button", { name: "Send forespørsel" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ja", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "registrert lokalt",
  );
  expect(mutations).toEqual([]);
});
