import { expect, test } from "@playwright/test";
import { accessible, inDays, noHorizontalScroll, PHONE, setRentalsOpen } from "./flows";
import { publishRental, registerAndVerify, uniqueEmail, watchForInjection } from "./support";

/** TEST_STRATEGY §5 journey 3 (D-020): a wish, a reply pointing to the replier's own listing, a request on it. */
test.describe("«Ønskes leid» at 390 px", () => {
  test.use(PHONE);
  test.beforeAll(() => setRentalsOpen(true));
  test.afterAll(() => setRentalsOpen(false));

  test("a wish → a reply with the replier's own listing → a rental request on that listing", async ({ browser }) => {
    test.setTimeout(180_000);
    // The person who wishes to rent publishes «Ønskes leid».
    const seeker = await (await browser.newContext(PHONE)).newPage();
    const problems = watchForInjection(seeker);
    await registerAndVerify(seeker, uniqueEmail("p04-onske"), "Silje S.");
    await seeker.goto("/ny-annonse");
    await seeker.getByText("Jeg ønsker å leie", { exact: true }).click();
    await seeker.getByLabel("Kategori").selectOption({ label: "Verktøy" });
    await seeker.getByRole("button", { name: "Neste" }).click();
    await seeker.getByLabel("Overskrift").fill("Ønsker å leie en hekksaks");
    await seeker.getByLabel("Beskrivelse").fill("Trenger en hekksaks en helg i Nordfold for å klippe hekken.");
    const area = seeker.getByRole("combobox", { name: "Område", exact: true });
    while (!(await area.isVisible())) await seeker.getByRole("button", { name: "Neste" }).click();
    await area.selectOption({ label: "Nordfold" });
    const publish = seeker.getByRole("button", { name: "Publiser" });
    while (!(await publish.isVisible())) await seeker.getByRole("button", { name: "Neste" }).click();
    await publish.click();
    await expect(seeker).toHaveURL(/\/annonse\/[0-9a-f-]{36}\?lagret=published/);
    const wishPath = new URL(seeker.url()).pathname;

    // A neighbour has one to rent out and answers the wish with a link to that listing.
    const lender = await (await browser.newContext(PHONE)).newPage();
    await registerAndVerify(lender, uniqueEmail("p04-svar"), "Lars L.");
    const offerId = await publishRental(lender, "Hekksaks med lang rekkevidde");
    await lender.goto(wishPath);
    await lender.getByText("Svar på ønsket").click();
    await lender.getByLabel("Skriv en melding").fill("Jeg har en du kan leie. Se annonsen.");
    await lender
      .getByRole("combobox", { name: "Legg ved en av dine annonser (valgfritt)" })
      .selectOption({ label: "Hekksaks med lang rekkevidde" });
    await accessible(lender);
    await lender.getByRole("button", { name: "Send melding" }).click();
    await expect(lender).toHaveURL(/\/meldinger\/[0-9a-f-]{36}$/);
    const threadPath = new URL(lender.url()).pathname;

    // The seeker follows the link in the conversation and sends a request on that listing.
    await seeker.goto(threadPath);
    await expect(seeker.getByText("Jeg har en du kan leie. Se annonsen.")).toBeVisible();
    await accessible(seeker);
    await seeker.getByRole("link", { name: "Hekksaks med lang rekkevidde" }).click();
    await expect(seeker).toHaveURL(new RegExp(`/annonse/${offerId}$`));
    const form = seeker.locator("form").filter({ has: seeker.locator('input[name="startDate"]') });
    await form.getByLabel("Fra dato").fill(inDays(3));
    await form.getByLabel("Til dato").fill(inDays(4));
    await form.getByRole("button", { name: "Send forespørsel" }).click();
    await expect(seeker).toHaveURL(/\/leieforhold\/[0-9a-f-]{36}\?ok=requested/);
    const bookingPath = new URL(seeker.url()).pathname;
    await noHorizontalScroll(seeker);

    // The lender sees the request.
    await lender.goto(bookingPath);
    await expect(lender.getByRole("button", { name: "Godta forespørselen" })).toBeVisible();
    expect(problems).toEqual([]);
  });
});
