import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { Pool } from "pg";
import { TEST_DB_OWNER_URL } from "../integration/env";

export const PASSWORD = "en lang og trygg setning";
const pool = new Pool({ connectionString: TEST_DB_OWNER_URL, max: 1 });

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await pool.query(text, params)).rows as T[];
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.test`;
}

/** Register through the form and open the verification link from the outbox (no SMTP in tests). */
export async function registerAndVerify(page: Page, email: string, name = "Ola N."): Promise<void> {
  // All test sign-ups come from one IP; reset the per-IP sign-up limit (5/h) between them.
  await query("DELETE FROM app_rate_limits WHERE bucket LIKE 'signup:%'");
  await page.goto("/registrer");
  await page.getByLabel("Visningsnavn").fill(name);
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Passord").fill(PASSWORD);
  await page.getByLabel("Jeg er 18 år eller eldre.").check();
  await page.getByLabel(/privatperson/).check();
  await page.getByLabel(/Jeg godtar/).check();
  await page.waitForTimeout(3_100); // the form refuses submissions faster than 3 s (bot check)
  await page.getByRole("button", { name: "Opprett konto" }).click();
  await expect(page).toHaveURL(/bekreft-epost\?sendt=1/);
  const [mail] = await query<{ url: string }>(
    "SELECT payload->>'url' AS url FROM email_outbox WHERE to_email = $1 AND template = 'verify_email' ORDER BY created_at DESC LIMIT 1",
    [email],
  );
  expect(mail?.url).toBeTruthy();
  await page.goto(mail!.url.replace(/^https?:\/\/[^/]+/, ""));
  await expect(page.getByText("E-postadressen er bekreftet")).toBeVisible();
}

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/logg-inn");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Passord").fill(PASSWORD);
  await page.getByRole("main").getByRole("button", { name: "Logg inn" }).click();
  await page.waitForURL((u) => !u.pathname.endsWith("/logg-inn"));
}

/** Publish a simple «Leies ut» listing through the wizard; returns its id. */
export async function publishRental(
  page: Page,
  title: string,
  description = "Kraftig verktøy i god stand, med koffert.",
  image?: string,
): Promise<string> {
  await page.goto("/ny-annonse");
  await page.getByText("Leie ut eller låne ut").click();
  await page.getByLabel("Kategori").selectOption({ label: "Verktøy" });
  await page.getByRole("button", { name: "Neste" }).click();
  await page.getByLabel("Overskrift").fill(title);
  await page.getByLabel("Beskrivelse").fill(description);
  await page.getByLabel("Tilstand").selectOption("good");
  if (image) {
    await page.locator('input[type="file"]').setInputFiles(image);
    await expect(page.locator('input[name="imageId"]')).toHaveCount(1, { timeout: 20_000 });
    // The preview of the not-yet-attached upload is served to its uploader only, and must load.
    const preview = page.locator('img[src^="/media/"]').first();
    await expect
      .poll(() => preview.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBeGreaterThan(0);
  }
  await page.getByRole("button", { name: "Neste" }).click();
  await page.getByLabel("Pris (kr)").fill("150");
  await page.getByLabel("Omtrentlig verdi (kr)").fill("3000");
  await page.getByRole("button", { name: "Neste" }).click();
  await page.getByRole("combobox", { name: "Område", exact: true }).selectOption({ label: "Nordfold" });
  await page.getByRole("button", { name: "Neste" }).click();
  await page.getByRole("button", { name: "Publiser" }).click();
  await expect(page).toHaveURL(/\/annonse\/[0-9a-f-]{36}\?lagret=published/);
  return page.url().match(/annonse\/([0-9a-f-]{36})/)![1]!;
}

function base32(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s), as produced by authenticator apps. */
export function totp(secret: string): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const h = createHmac("sha1", base32(secret)).update(counter).digest();
  const o = h[h.length - 1]! & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

export function grantRole(email: string, role: "moderator" | "admin"): void {
  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/grant-role.ts",
      "--email",
      email,
      "--role",
      role,
      "--reason",
      "Ende-til-ende-test av moderering",
    ],
    {
      env: process.env,
      stdio: "pipe",
    },
  );
}

/** Fail the test on any JavaScript dialog or CSP violation (N9). */
export function watchForInjection(page: Page): string[] {
  const problems: string[] = [];
  page.on("dialog", async (d) => {
    problems.push(`dialog: ${d.message()}`);
    await d.dismiss();
  });
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) problems.push(`csp: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}
