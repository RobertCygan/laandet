import { expect, test } from "@playwright/test";
import { publishRental, registerAndVerify, uniqueEmail, watchForInjection } from "./support";

test("N2 + N9: a conversation is private, messages are plain text, and replies arrive by polling", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const a = await (await browser.newContext()).newPage();
  const problemsA = watchForInjection(a);
  await registerAndVerify(a, uniqueEmail("msg-eier"), "Anne E.");
  const listingId = await publishRental(a, "Høytrykksspyler");

  // B writes to the owner from the listing page.
  const b = await (await browser.newContext()).newPage();
  const problemsB = watchForInjection(b);
  await registerAndVerify(b, uniqueEmail("msg-leier"), "Bjørn L.");
  await b.goto(`/annonse/${listingId}`);
  await b.getByText("Send melding til eieren").click();
  const evil = `<script>alert(1)</script><img src=x onerror=alert(2)> Er den ledig på lørdag?`;
  await b.getByLabel("Skriv en melding").fill(evil);
  await b.getByRole("button", { name: "Send melding" }).click();
  await expect(b).toHaveURL(/\/meldinger\/[0-9a-f-]{36}$/);
  const threadPath = new URL(b.url()).pathname;
  await expect(b.getByText(evil)).toBeVisible();
  expect(await b.locator('main img[src="x"], main script').count()).toBe(0);

  // A sees it in the inbox, opens it, and gets the payment warning before sending a risky text.
  await a.goto("/meldinger");
  await expect(a.getByRole("main").getByText("Ulest", { exact: true })).toBeVisible();
  await a
    .getByRole("main")
    .getByRole("link", { name: /Bjørn L\./ })
    .click();
  await expect(a).toHaveURL(new RegExp(`${threadPath}$`));
  await expect(a.getByText(evil)).toBeVisible();
  expect(await a.locator('main img[src="x"], main script').count()).toBe(0);
  const field = a.getByLabel("Skriv en melding");
  await field.fill("Betal her: https://pay.example.invalid/123");
  await expect(a.getByText(/Laandet sender aldri betalingslenker/)).toBeVisible();
  await field.fill("Ja, den er ledig. Hent den kl. 10.");
  await a.getByRole("button", { name: "Send", exact: true }).click();
  await expect(a.getByText("Ja, den er ledig. Hent den kl. 10.")).toBeVisible();
  await expect(field).toHaveValue("");

  // B's open thread picks the reply up without a reload (polling every 20 s).
  await expect(b.getByText("Ja, den er ledig. Hent den kl. 10.")).toBeVisible({ timeout: 30_000 });

  // N2: a third user gets 404 and an empty inbox.
  const c = await (await browser.newContext()).newPage();
  await registerAndVerify(c, uniqueEmail("msg-annen"), "Carl A.");
  const res = await c.goto(threadPath);
  expect(res?.status()).toBe(404);
  await expect(c.getByText(evil)).toHaveCount(0);
  await c.goto("/meldinger");
  await expect(c.getByText(/Du har ingen meldinger ennå/)).toBeVisible();

  expect(problemsA).toEqual([]);
  expect(problemsB).toEqual([]);
});
