import path from "node:path";
import { expect, test } from "@playwright/test";
import { publishRental, registerAndVerify, uniqueEmail } from "./support";

const PHOTO = path.resolve("seed/demo-images/equipment-1.webp");

/**
 * N11 + main Phase 01 journey: register → verify → publish with a photo → find it in explore.
 * A donation or the support page is never needed (no request to /stott-laandet at all).
 */
test("register, publish a listing with a photo and find it, without ever touching the support page", async ({
  page,
  browser,
}) => {
  // Pages actually opened (link prefetching in the footer is not a visit).
  const visited: string[] = [];
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) visited.push(new URL(f.url()).pathname);
  });

  await registerAndVerify(page, uniqueEmail("reise"));
  // No long digit runs in titles: they are rejected as possible phone numbers.
  const title = `Slagdrill ${Math.random().toString(36).slice(2, 8).replace(/\d/g, "x")}`;
  const id = await publishRental(page, title, "Kraftig slagdrill med bor og koffert.", PHOTO);

  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  // What a visitor sees: «Privatperson», requests not open yet, and never the declared value.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/annonse/${id}`);
  await expect(visitor.getByText("Privatperson").first()).toBeVisible();
  await expect(visitor.getByRole("button", { name: "Send forespørsel" })).toBeDisabled();
  await expect(visitor.getByText("Forespørsler åpner snart")).toBeVisible();
  await expect(visitor.getByText(/3\s000/)).toHaveCount(0);

  await page.goto(`/utforsk?q=${encodeURIComponent("slagdrill")}`);
  await expect(page.locator(`a[href$="/annonse/${id}"]`)).toBeVisible();

  expect(visited.filter((p) => p.includes("stott-laandet"))).toEqual([]);
});
