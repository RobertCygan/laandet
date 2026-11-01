import { expect, test } from "@playwright/test";
import { accessible, noHorizontalScroll, PHONE, staffWithTotp } from "./flows";
import { registerAndVerify, uniqueEmail, watchForInjection } from "./support";

test.describe("closed beta (P04-01) at 390 px", () => {
  test.use(PHONE);

  test("«Gi tilbakemelding» from the footer reaches the staff list, where it is marked handled", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const member = await (await browser.newContext(PHONE)).newPage();
    const problems = watchForInjection(member);
    await registerAndVerify(member, uniqueEmail("p04-tilbakemelding"), "Tove T.");
    await member.goto("/utforsk");
    await member.getByRole("contentinfo").getByRole("link", { name: "Gi tilbakemelding" }).click();
    await expect(member).toHaveURL(/\/tilbakemelding\?fra=%2Futforsk$/);
    await expect(member.getByText("Siden du kom fra: /utforsk")).toBeVisible();
    await accessible(member);
    await noHorizontalScroll(member);
    await member.getByLabel("Forslag til forbedring").check();
    await member.getByLabel(/Beskriv det med egne ord/).fill("Filteret for sted bør huske valget mitt. <b>fet</b>");
    await member.getByRole("button", { name: "Send tilbakemelding" }).click();
    await expect(member.getByText("Takk! Tilbakemeldingen er sendt til Laandet.")).toBeVisible();

    const mod = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await staffWithTotp(mod, "moderator", "Moderator M.");
    await mod.goto("/admin/tilbakemeldinger");
    // Shown as text, never as HTML.
    await expect(mod.getByText("Filteret for sted bør huske valget mitt. <b>fet</b>")).toBeVisible();
    await expect(mod.getByText(/Forslag til forbedring · .* · Tove T\. · \/utforsk/)).toBeVisible();
    await accessible(mod);
    await mod.getByRole("button", { name: "Marker som behandlet" }).first().click();
    await expect(mod.getByText("Tilbakemeldingen er markert som behandlet.")).toBeVisible();
    await expect(mod.getByRole("heading", { name: "Behandlet", exact: true })).toBeVisible();
    expect(problems).toEqual([]);
  });
});
