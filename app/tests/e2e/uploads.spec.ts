import { appendFileSync, mkdtempSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { registerAndVerify, uniqueEmail } from "./support";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * A photo just under the 10 MB limit must arrive whole. With the form overhead the request is
 * then slightly over 10 MB, which the proxy layer would cut without `proxyClientMaxBodySize`.
 */
test("a photo just under 10 MB uploads through the wizard", async ({ page }) => {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), "laandet-upload-")), "stort-bilde.png");
  const size = 1750;
  const noise = Buffer.alloc(size * size * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24; // incompressible pattern
  const info = await sharp(noise, { raw: { width: size, height: size, channels: 3 } })
    .png({ compressionLevel: 0 })
    .toFile(file);
  // Pad after the image data (decoders ignore it) to 200 bytes under the limit.
  appendFileSync(file, Buffer.alloc(MAX_UPLOAD_BYTES - 200 - info.size));
  expect(statSync(file).size).toBe(MAX_UPLOAD_BYTES - 200);

  await registerAndVerify(page, uniqueEmail("stort"));
  await page.goto("/ny-annonse");
  await page.getByText("Gi bort").first().click();
  await page.getByLabel("Kategori").selectOption({ label: "Møbler" });
  await page.getByRole("button", { name: "Neste" }).click();
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.locator('input[name="imageId"]')).toHaveCount(1, { timeout: 30_000 });
});

test("the auth API only answers the two email links", async ({ request }) => {
  expect(
    (
      await request.post("/api/auth/sign-up/email", {
        data: { email: "x@example.test", password: "x".repeat(12), name: "X" },
      })
    ).status(),
  ).toBe(404);
  expect((await request.post("/api/auth/change-email", { data: { newEmail: "x@example.test" } })).status()).toBe(404);
  expect((await request.get("/api/auth/get-session")).status()).toBe(404);
  // The verification link itself is served (an invalid token is handled by Better Auth, not a 404).
  expect((await request.get("/api/auth/verify-email?token=ugyldig", { maxRedirects: 0 })).status()).not.toBe(404);
});
