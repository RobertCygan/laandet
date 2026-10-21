import { test, expect, type Page } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
const offline = pathToFileURL(path.resolve("out/Laanndet.html")).href;
async function assertPlaying(page: Page) {
  const overlay = page.getByTestId("logo-intro");
  await expect(overlay).toBeVisible();
  await expect(page.locator(".logo-intro-video")).toBeVisible();
  await expect
    .poll(
      () =>
        page
          .locator(".logo-intro-video")
          .evaluate((video: HTMLVideoElement) => video.currentTime),
      { timeout: 5000 },
    )
    .toBeGreaterThan(0);
  await expect(
    page.getByRole("button", { name: "Hopp over intro" }),
  ).toBeVisible();
  return overlay;
}
test("web intro plays supplied logo, ends naturally and does not replay on navigation", async ({
  page,
}) => {
  await page.goto("/");
  const overlay = await assertPlaying(page);
  await expect(overlay).not.toBeVisible({ timeout: 12000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Lei det du trenger.",
  );
  await page
    .getByRole("link", { name: "Finn noe å leie", exact: true })
    .click();
  await expect(page.getByTestId("listing-card")).toHaveCount(18);
  await expect(overlay).toHaveCount(0);
});
test("one-file intro decodes and plays with network completely disabled", async ({
  page,
  context,
}) => {
  await context.setOffline(true);
  const external: string[] = [];
  const errors: string[] = [];
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) external.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
  });
  await page.goto(offline);
  const overlay = await assertPlaying(page);
  expect(
    await page
      .locator(".logo-intro-video")
      .evaluate((v: HTMLVideoElement) =>
        v.currentSrc.startsWith("data:video/"),
      ),
  ).toBe(true);
  await expect(overlay).not.toBeVisible({ timeout: 12000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Lei det du trenger.",
  );
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
test("intro can be skipped immediately by keyboard and keeps focus contained", async ({
  page,
  context,
}) => {
  await context.setOffline(true);
  await page.goto(offline);
  await assertPlaying(page);
  await page.getByRole("button", { name: "Hopp over intro" }).focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Hopp over intro" }),
  ).toBeFocused();
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("logo-intro")).not.toBeVisible({
    timeout: 1500,
  });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
test("reduced motion bypasses intro without loading the animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const videoRequests: string[] = [];
  page.on("request", (r) => {
    if (/\/videos\/intro\./.test(r.url())) videoRequests.push(r.url());
  });
  await page.goto("/");
  await expect(page.getByTestId("logo-intro")).not.toBeVisible({
    timeout: 2000,
  });
  await expect(page.locator(".logo-intro-video")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(videoRequests).toEqual([]);
});
test("playback failure reveals the page and never traps the visitor", async ({
  page,
}) => {
  await page.goto("/");
  await assertPlaying(page);
  await page.locator(".logo-intro-video").dispatchEvent("error");
  await expect(page.getByTestId("logo-intro")).not.toBeVisible({
    timeout: 1500,
  });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
