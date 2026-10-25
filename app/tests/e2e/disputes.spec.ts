import { expect, test } from "@playwright/test";
import {
  accessible,
  addEntry,
  confirmEntry,
  noHorizontalScroll,
  PHONE,
  rentalHandedOver,
  setRentalsOpen,
  staffWithTotp,
} from "./flows";
import { query, registerAndVerify, uniqueEmail, watchForInjection } from "./support";

async function renterIdOf(bookingPath: string) {
  const [b] = await query<{ renter_id: string }>("SELECT renter_id FROM bookings WHERE id = $1", [
    bookingPath.split("/").pop(),
  ]);
  return b!.renter_id;
}

test.describe("Phase 03: cases at 390 px (P03-01)", () => {
  test.use(PHONE);
  test.beforeAll(() => setRentalsOpen(true));
  test.afterAll(() => setRentalsOpen(false));

  test("contested return → case → proposal → counter-proposal → accept → resolved; private (N12)", async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const { owner, renter, bookingPath } = await rentalHandedOver(browser, "p03-sak");
    const problems = watchForInjection(owner);

    // The renter records the return; the owner contests it, which opens a case.
    await renter.goto(`${bookingPath}/tilbakelevering`);
    await addEntry(renter, { outcome: "Levert tilbake i orden" });
    await confirmEntry(renter, false);
    await owner.goto(`${bookingPath}/tilbakelevering`);
    await owner.getByLabel(/Kommentar/).fill("Det er en sprekk i bladet som ikke var der før.");
    await owner.getByRole("button", { name: "Bestrid", exact: true }).click();
    await owner.goto(bookingPath);
    await owner.getByRole("link", { name: "Se saken" }).click();
    await expect(owner).toHaveURL(/\/saker\/[0-9a-f-]{36}$/);
    const casePath = new URL(owner.url()).pathname;
    await accessible(owner);
    await noHorizontalScroll(owner);

    // The other party answers; the case moves to negotiation.
    await renter.goto(casePath);
    await renter.getByLabel(/Din forklaring/).fill("Sprekken var der da jeg hentet den. Se protokollen.");
    await renter.getByRole("button", { name: "Legg til i saken" }).click();
    await expect(renter.getByText("Lagt til i saken.")).toBeVisible();
    await expect(renter.getByText("Dere prøver å bli enige").first()).toBeVisible();

    // A proposal, a counter-proposal, and an acceptance.
    await owner.goto(casePath);
    await owner.getByLabel(/Forslag til løsning/).selectOption("partial_compensation");
    await owner.getByLabel("Beløp (kr)").fill("200");
    await owner.getByLabel(/Forklar forslaget/).fill("Vi deler på et nytt blad.");
    await owner.getByRole("button", { name: "Send forslaget" }).click();
    await expect(owner.getByText("Forslaget er sendt.")).toBeVisible();
    await renter.goto(casePath);
    await expect(renter.getByText(/Delvis erstatning · 200/).first()).toBeVisible();
    await renter.getByLabel(/Forslag til løsning/).selectOption("repair");
    await renter.getByLabel(/Forklar forslaget/).fill("Jeg kjøper et nytt blad og leverer det fredag.");
    await renter.getByRole("button", { name: "Send forslaget" }).click();
    await expect(renter.getByText("Forslaget er sendt.")).toBeVisible();
    await owner.goto(casePath);
    await owner.getByRole("button", { name: "Godta", exact: true }).click();
    await expect(owner.getByText("Du har godtatt forslaget. Saken er løst ved avtale.")).toBeVisible();
    await expect(owner.getByText(/Jeg kjøper et nytt blad og leverer det fredag/).first()).toBeVisible();
    await owner.goto(bookingPath);
    await expect(owner.getByText("Fullført").first()).toBeVisible();

    // Private: a stranger gets 404, and the renter's public profile says nothing about it (N12).
    const stranger = await (await browser.newContext(PHONE)).newPage();
    await registerAndVerify(stranger, uniqueEmail("p03-annen"), "Siri S.");
    expect((await stranger.goto(casePath))?.status()).toBe(404);
    await stranger.goto(`/profil/${await renterIdOf(bookingPath)}`);
    // Everything on the profile except the report form (which lists «svindel» as a reason to report).
    const text = (await stranger.locator("main > *").first().textContent()) ?? "";
    expect(text).not.toMatch(/sprekk|sak under behandling|\bsak\b|tvist/i);
    expect(await stranger.getByText(/sprekk i bladet/).count()).toBe(0);
    expect(problems).toEqual([]);
  });

  test("«Be Laandet om hjelp» → staff take the case with a reason → recommendation accepted by both", async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    await query("UPDATE user_profiles SET role = 'user' WHERE role <> 'user'");
    const { owner, renter, bookingPath } = await rentalHandedOver(browser, "p03-hjelp");

    // Not returned: the owner reports it and can ask for help at once.
    await owner.goto(bookingPath);
    await owner.getByRole("link", { name: "Meld fra om et problem" }).click();
    await owner.getByLabel(/Hva gjelder det/).selectOption("not_returned");
    await owner.getByLabel(/Beskriv hva som skjedde/).fill("Hekksaksen er ikke levert tilbake, og jeg får ikke svar.");
    await owner.getByRole("button", { name: "Send inn saken" }).click();
    await expect(owner).toHaveURL(/\/saker\/[0-9a-f-]{36}\?ok=opened/);
    const casePath = new URL(owner.url()).pathname;
    await owner.getByRole("button", { name: "Be Laandet om hjelp" }).click();
    await expect(owner.getByText("Laandet support er bedt om å se på saken.")).toBeVisible();

    // A moderator sees only metadata until taking the case with a reason; then the case file.
    const mod = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await staffWithTotp(mod, "moderator", "Moderator M.");
    await mod.goto("/admin/saker");
    await accessible(mod);
    await mod.getByRole("link", { name: "Åpne" }).first().click();
    await expect(mod.getByText("Hekksaksen er ikke levert tilbake")).toHaveCount(0);
    await mod.getByLabel("Begrunnelse for tilgang").fill("Saken er eskalert av utleier.");
    await mod.getByRole("button", { name: "Ta saken" }).click();
    await expect(mod.getByText("Du har tatt saken. Tilgangen gjelder i 30 dager.")).toBeVisible();
    await expect(mod.getByText("Hekksaksen er ikke levert tilbake").first()).toBeVisible();
    await accessible(mod);
    await mod.getByLabel("Dette er dokumentert").fill("Utlevering bekreftet av begge.");
    await mod.getByLabel("Dette er partene uenige om").fill("Når gjenstanden skal leveres.");
    await mod.getByLabel("Vår anbefaling (ikke bindende)").fill("Lever tilbake innen søndag kl. 18.");
    await mod.getByRole("button", { name: "Send anbefalingen" }).click();
    await expect(mod.getByText("Anbefalingen er sendt til partene.")).toBeVisible();

    for (const p of [owner, renter]) {
      await p.goto(casePath);
      await expect(p.getByText("Lever tilbake innen søndag kl. 18.").first()).toBeVisible();
      await p.getByRole("button", { name: "Godta anbefalingen" }).click();
    }
    await expect(renter.getByText("Saken er løst ved avtale.").first()).toBeVisible();
  });
});
