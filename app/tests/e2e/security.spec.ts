import { expect, test } from "@playwright/test";
import { query } from "./support";

/**
 * SEC-22: Server Actions are protected by Next.js's origin check. A form posted from another site is
 * refused before the action runs; the same post from our own origin reaches the action.
 */
test("SEC-22: a Server Action posted with a foreign Origin is refused", async ({ page, request }) => {
  const [l] = await query<{ id: string }>(
    "SELECT id FROM listings WHERE status = 'published' AND is_demo ORDER BY created_at LIMIT 1",
  );
  expect(l).toBeTruthy();
  await page.goto(`/annonse/${l!.id}`);
  const html = await page.content();
  const actionId = /\$ACTION_ID_([0-9a-f]+)/.exec(html)?.[1];
  expect(actionId).toBeTruthy();

  const post = (origin: string) =>
    request.post(`/annonse/${l!.id}`, {
      headers: { "Next-Action": actionId!, Origin: origin },
      multipart: { [`$ACTION_ID_${actionId}`]: "", listingId: l!.id, locale: "nb" },
      maxRedirects: 0,
      failOnStatusCode: false,
    });

  const foreign = await post("https://evil.example");
  expect(foreign.status()).toBeGreaterThanOrEqual(400);
  // The same action from our own page runs: an anonymous «Lagre» is sent to sign in.
  await page.getByRole("button", { name: "Lagre" }).click();
  await expect(page).toHaveURL(/\/logg-inn\?neste=/);
});
