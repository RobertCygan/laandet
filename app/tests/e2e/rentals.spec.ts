import { expect, test, type Page } from "@playwright/test";
import { accessible, addEntry, confirmEntry, inDays, noHorizontalScroll, setRentalsOpen } from "./flows";
import { publishRental, registerAndVerify, uniqueEmail, watchForInjection } from "./support";

/** Rates every criterion on the open review page and sends the review. */
async function writeReview(page: Page, comment: string, renter: boolean) {
  for (const name of ["communication", "punctuality", "itemCondition", "agreement", ...(renter ? ["accuracy"] : [])])
    await page.locator(`input[name="${name}"][value="5"]`).check();
  await page.getByRole("textbox", { name: /Kommentar/ }).fill(comment);
  await page.getByRole("button", { name: "Send vurdering" }).click();
}

test.describe("Phase 02 journeys at 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeAll(() => setRentalsOpen(true));
  test.afterAll(() => setRentalsOpen(false));

  test("request → accept → both accept the agreement → handover → return → completed", async ({ browser }) => {
    test.setTimeout(240_000);
    const owner = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    const problems = watchForInjection(owner);
    await registerAndVerify(owner, uniqueEmail("p02-eier"), "Eva E.");
    const listingId = await publishRental(owner, "Stikksag med blader");

    // The renter asks for tomorrow 10:00 to the day after 18:00 and sees the price first.
    const renter = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await registerAndVerify(renter, uniqueEmail("p02-leier"), "Rolf R.");
    await renter.goto(`/annonse/${listingId}`);
    const form = renter.locator("form").filter({ has: renter.locator('input[name="startDate"]') });
    await form.getByLabel("Fra dato").fill(inDays(1));
    await form.getByLabel("Til dato").fill(inDays(2));
    await expect(form.getByText(/Pris for 2 dager: 300/)).toBeVisible();
    await expect(form.getByText(/Laandet håndterer ikke penger/)).toBeVisible();
    await noHorizontalScroll(renter);
    await accessible(renter);
    await form.getByRole("button", { name: "Send forespørsel" }).click();
    await expect(renter).toHaveURL(/\/leieforhold\/[0-9a-f-]{36}\?ok=requested/);
    const bookingPath = new URL(renter.url()).pathname;

    // The owner gets a notice and accepts.
    await owner.goto("/varsler");
    await accessible(owner);
    await owner.getByRole("link", { name: /forespørsel om å leie «Stikksag med blader»/ }).click();
    await expect(owner).toHaveURL(new RegExp(`${bookingPath}$`));
    await accessible(owner);
    await owner.getByRole("button", { name: "Godta forespørselen" }).click();
    await expect(owner.getByText("Du har godtatt forespørselen.")).toBeVisible();

    // Both read and accept the exact agreement text.
    for (const p of [owner, renter]) {
      await p.goto(`${bookingPath}/avtale`);
      await expect(p.getByRole("article").getByRole("heading", { name: "Kort fortalt" })).toBeVisible();
      await expect(p.getByText(/LA-\d{4}-\d{6}/).first()).toBeVisible();
      await noHorizontalScroll(p);
      await accessible(p);
      await p.getByLabel("Jeg har lest hele avtalen og godtar den.").check();
      await p.getByRole("button", { name: "Jeg godtar avtalen" }).click();
    }
    await expect(renter.getByText("Begge har godtatt. Leieforholdet er bekreftet.")).toBeVisible();

    // Handover: the owner records the condition with a photo and confirms; the renter confirms.
    await owner.goto(`${bookingPath}/utlevering`);
    await accessible(owner);
    await addEntry(owner, { photo: true });
    await confirmEntry(owner, true);
    await expect(owner.getByText("Du har bekreftet. Venter på den andre parten.")).toBeVisible();
    await renter.goto(`${bookingPath}/utlevering`);
    const photo = renter.locator('main img[src^="/media/"]').first();
    await expect
      .poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBeGreaterThan(0);
    const photoSrc = (await photo.getAttribute("src"))!;
    await confirmEntry(renter, true);
    await expect(renter.getByText("Begge har bekreftet.").first()).toBeVisible();

    // N13: nobody else can open the condition photo.
    const stranger = await (await browser.newContext()).newPage();
    await registerAndVerify(stranger, uniqueEmail("p02-annen"), "Siri S.");
    expect((await stranger.goto(photoSrc))?.status()).toBe(404);
    expect((await stranger.goto(bookingPath))?.status()).toBe(404);

    // Return: the renter records it and proposes an outcome; both confirm.
    await renter.goto(`${bookingPath}/tilbakelevering`);
    await addEntry(renter, { outcome: "Levert tilbake i orden" });
    await confirmEntry(renter, false);
    await owner.goto(`${bookingPath}/tilbakelevering`);
    await confirmEntry(owner, false);
    await expect(owner.getByText("Begge har bekreftet.").first()).toBeVisible();
    await owner.goto(bookingPath);
    await expect(owner.getByText("Fullført").first()).toBeVisible();
    await expect(owner.getByText("Tilbakelevering bekreftet av begge")).toBeVisible();
    await noHorizontalScroll(owner);

    // Both review each other (double-blind): nothing is shown until both have written.
    await renter.goto(`${bookingPath}/vurdering`);
    await accessible(renter);
    await writeReview(renter, "Ryddig utleier, alt som avtalt.", true);
    await expect(renter.getByText("Vurderingen din er levert, men ikke publisert ennå.")).toBeVisible();
    await owner.goto(`${bookingPath}/vurdering`);
    await expect(owner.getByText("Ryddig utleier, alt som avtalt.")).toHaveCount(0);
    await writeReview(owner, "Leverte tilbake i fin stand.", false);
    await expect(owner.getByText("Takk! Begge har skrevet, og vurderingene er publisert.")).toBeVisible();
    await expect(owner.getByText("Ryddig utleier, alt som avtalt.")).toBeVisible();
    await expect(owner.getByText("Leverte tilbake i fin stand.")).toBeVisible();
    // The review is on the owner's public profile, with a real count of completed rentals.
    await owner.goto("/konto");
    await owner.getByRole("link", { name: "Se din offentlige profil" }).click();
    await expect(owner.getByText("Ryddig utleier, alt som avtalt.")).toBeVisible();
    await expect(owner.getByText("1 fullført leieforhold")).toBeVisible();
    await noHorizontalScroll(owner);
    expect(problems).toEqual([]);
  });

  test("giveaway: claim → the giver chooses → both confirm → «Gitt bort»", async ({ browser }) => {
    test.setTimeout(180_000);
    const giver = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await registerAndVerify(giver, uniqueEmail("p02-giver"), "Gunn G.");
    await giver.goto("/ny-annonse");
    await giver.getByText("Gi bort", { exact: true }).click();
    await giver.getByLabel("Kategori").selectOption({ label: "Verktøy" });
    await giver.getByRole("button", { name: "Neste" }).click();
    await giver.getByLabel("Overskrift").fill("Gammel bormaskin");
    await giver.getByLabel("Beskrivelse").fill("Fungerer fint, men er litt bråkete. Hentes i Nordfold.");
    await giver.getByLabel("Tilstand").selectOption("worn");
    await giver.getByLabel("Kjente feil og mangler").fill("Litt slark i chucken");
    const area = giver.getByRole("combobox", { name: "Område", exact: true });
    while (!(await area.isVisible())) await giver.getByRole("button", { name: "Neste" }).click();
    await area.selectOption({ label: "Nordfold" });
    const publish = giver.getByRole("button", { name: "Publiser" });
    while (!(await publish.isVisible())) await giver.getByRole("button", { name: "Neste" }).click();
    await publish.click();
    await expect(giver).toHaveURL(/\/annonse\/[0-9a-f-]{36}\?lagret=published/);
    const listingPath = new URL(giver.url()).pathname;

    const taker = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await registerAndVerify(taker, uniqueEmail("p02-mottaker"), "Tor T.");
    await taker.goto(listingPath);
    const claim = taker.locator("form", { hasText: "Giveren velger selv" });
    await claim.getByLabel("Melding til giveren (valgfritt)").fill("Kan hente i morgen.");
    await claim.getByRole("button", { name: "Jeg vil gjerne ha den" }).click();
    await expect(taker).toHaveURL(/\/overlevering\/[0-9a-f-]{36}\?ok=claimed/);
    await accessible(taker);
    const claimPath = new URL(taker.url()).pathname;

    await giver.goto(listingPath);
    await expect(giver.getByText("Tor T.")).toBeVisible();
    await giver.getByRole("button", { name: "Velg" }).click();
    await expect(giver).toHaveURL(new RegExp(`${claimPath}\\?ok=select`));
    await expect(giver.getByRole("heading", { name: /GB-\d{4}-\d{6}/ })).toBeVisible();

    for (const p of [giver, taker]) {
      await p.goto(claimPath);
      await p.getByLabel("Gjenstanden er overlevert, og jeg har lest teksten over.").check();
      await p.getByRole("button", { name: "Bekreft overleveringen" }).click();
    }
    await expect(taker.getByText("Begge har bekreftet. Gjenstanden er gitt bort.")).toBeVisible();
    await giver.goto(listingPath);
    await expect(giver.getByText(/Gitt bort/).first()).toBeVisible();
    await noHorizontalScroll(giver);
  });
});
