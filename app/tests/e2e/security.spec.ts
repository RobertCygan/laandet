import { expect, test } from "@playwright/test";
import { query, registerAndVerify, uniqueEmail } from "./support";

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

test("SEC-11, SEC-12, N10: a __Host- HttpOnly Secure SameSite=Lax session that stops working when the account goes", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  const email = uniqueEmail("sec-session");
  await registerAndVerify(page, email, "Sara S."); // verifying the email signs the user in
  const session = (await context.cookies()).find((c) => c.name === "__Host-laandet.session");
  expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
  // A __Host- cookie has no Domain attribute: Playwright reports the exact host then.
  expect(session!.domain).toBe("localhost");
  expect((await context.cookies()).filter((c) => c.name.startsWith("__Secure-__Host-"))).toEqual([]);
  await page.goto("/konto");
  await expect(page).toHaveURL(/\/konto$/);

  // L4: the data export is a same-origin POST from the account page; GET and foreign posts do nothing.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Last ned mine data (JSON)" }).click();
  expect((await download).suggestedFilename()).toMatch(/^laandet-mine-data-\d{4}-\d{2}-\d{2}\.json$/);
  expect((await page.request.get("/konto/mine-data", { maxRedirects: 0, failOnStatusCode: false })).status()).toBe(405);
  const foreign = await page.request.post("/konto/mine-data", {
    headers: { Origin: "https://evil.example" },
    maxRedirects: 0,
    failOnStatusCode: false,
  });
  expect(foreign.status()).toBe(403);
  const [exports] = await query<{ n: string }>(
    "SELECT count(*) AS n FROM audit_events WHERE action = 'user.data_export' AND actor_id = (SELECT id FROM users WHERE email = $1)",
    [email],
  );
  expect(Number(exports!.n)).toBe(1);

  // The status is read on every request: a deleted account is signed out at once, session row or not.
  await query("UPDATE user_profiles SET status = 'deleted' WHERE user_id = (SELECT id FROM users WHERE email = $1)", [
    email,
  ]);
  await page.goto("/konto");
  await expect(page).toHaveURL(/\/logg-inn\?neste=/);
});
