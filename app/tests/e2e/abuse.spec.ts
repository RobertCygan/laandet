import { expect, test } from "@playwright/test";
import { publishRental, registerAndVerify, uniqueEmail, watchForInjection } from "./support";

test("N1: another user cannot open the edit page of my listing (404)", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  await registerAndVerify(a, uniqueEmail("n1-eier"));
  const id = await publishRental(a, "Tilhengerfeste-verktøy");

  const b = await (await browser.newContext()).newPage();
  const emailB = uniqueEmail("n1-annen");
  await registerAndVerify(b, emailB, "Kari B.");
  const res = await b.goto(`/annonse/${id}/rediger`);
  expect(res?.status()).toBe(404);
  // …and anonymous visitors are sent to sign in.
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(`/annonse/${id}/rediger`);
  await expect(anon).toHaveURL(/logg-inn\?neste=/);
});

test("N9: HTML and script in names and listings are shown as text and never run", async ({ page }) => {
  const problems = watchForInjection(page);
  const evilName = "<b onmouseover=alert(3)>Ola</b>";
  await registerAndVerify(page, uniqueEmail("n9"), evilName);
  const title = `<img src=x onerror=alert(1)>Drill`;
  const id = await publishRental(
    page,
    title,
    `<script>alert(2)</script> Beskrivelse med <iframe src="https://example.invalid"></iframe>`,
  );

  await page.goto(`/annonse/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByText(evilName)).toBeVisible();
  expect(await page.locator('main img[src="x"], main iframe, main b[onmouseover]').count()).toBe(0);
  expect(await page.locator("main script").count()).toBe(0);
  await page.goto("/utforsk?q=Drill");
  await page.waitForLoadState("networkidle");
  expect(problems).toEqual([]);
});
