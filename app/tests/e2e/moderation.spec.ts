import { expect, test } from "@playwright/test";
import { grantRole, publishRental, query, registerAndVerify, signIn, totp, uniqueEmail } from "./support";

/** TEST_STRATEGY §5.5 and N14: report → moderator (2FA) hides with reasons → owner appeals → decision. */
test("report, hide with a statement of reasons, appeal and reversal", async ({ browser }) => {
  await query("UPDATE user_profiles SET role = 'user' WHERE role <> 'user'"); // single staff member in this test

  const owner = await (await browser.newContext()).newPage();
  const ownerEmail = uniqueEmail("mod-eier");
  await registerAndVerify(owner, ownerEmail);
  const id = await publishRental(owner, "Høytrykksspyler med terrassevasker");

  // A third person reports (staff never handle reports they made themselves).
  const reporter = await (await browser.newContext()).newPage();
  await registerAndVerify(reporter, uniqueEmail("melder"), "Melder R.");
  await reporter.goto(`/annonse/${id}`);
  await reporter.getByText("Rapporter annonse").click();
  await reporter.getByLabel("Hva gjelder det?").selectOption("misleading");
  await reporter.getByLabel("Beskriv kort").fill("Bildet viser noe annet enn teksten.");
  await reporter.getByLabel("Jeg rapporterer i god tro.").check();
  await reporter.getByRole("button", { name: "Send rapport" }).click();
  await expect(reporter.getByText("Takk! Rapporten er sendt")).toBeVisible();

  const mod = await (await browser.newContext()).newPage();
  const modEmail = uniqueEmail("moderator");
  await registerAndVerify(mod, modEmail, "Moderator M.");
  grantRole(modEmail, "moderator");
  await signIn(mod, modEmail);
  // N14: without 2FA the admin area is not available.
  await mod.goto("/admin");
  await expect(mod).toHaveURL(/\/konto\/tofaktor/);
  await mod.getByLabel("Passord").fill("en lang og trygg setning");
  await mod.getByRole("button", { name: "Start oppsett" }).click();
  const secret = (await mod.locator("code").first().textContent())!.replace(/\s/g, "");
  await mod.getByLabel("Kode").fill(totp(secret));
  await mod.getByRole("button", { name: "Bekreft med kode" }).click();
  await expect(mod.getByText("Tofaktorinnlogging er slått på.")).toBeVisible();

  await mod.goto("/admin/rapporter");
  await mod.getByText("Skjul annonsen").first().click();
  await mod.getByRole("combobox", { name: "Regel" }).selectOption("misleading");
  await mod
    .getByLabel(/Begrunnelse til eieren/)
    .fill("Regel: villedende annonse. Bildet viser en annen gjenstand. Bytt bildet og klag hvis du er uenig.");
  await mod.getByRole("button", { name: "Skjul annonsen" }).click();
  await expect(mod).toHaveURL(/lagret=1/);

  const anon = await (await browser.newContext()).newPage();
  expect((await anon.goto(`/annonse/${id}`))?.status()).toBe(404);

  await owner.goto(`/annonse/${id}`);
  await owner.getByRole("link", { name: "Se begrunnelsen og klag" }).click();
  await expect(owner.getByText("Bildet viser en annen gjenstand")).toBeVisible();
  await owner.getByLabel("Din klage").fill("Jeg har byttet bildet nå, og teksten stemmer.");
  await owner.getByRole("button", { name: "Send klage" }).click();
  await expect(owner.getByText("Klagen er under behandling.")).toBeVisible();

  await mod.goto("/admin/klager");
  await mod.getByLabel("Svar til den som klaget").fill("Bildet er byttet. Annonsen kan publiseres igjen.");
  await mod.getByRole("button", { name: "Omgjør avgjørelsen" }).click();
  await expect(mod).toHaveURL(/lagret=1/);

  await owner.reload();
  await expect(owner.getByText(/avgjørelsen er omgjort/)).toBeVisible();
  await expect(owner.getByText(/samme person/)).toBeVisible();
});
