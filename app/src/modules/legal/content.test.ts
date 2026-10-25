import { describe, expect, it } from "vitest";
import { headingId, renderSupportPage, rewriteLegalHref, stripLegalMarkup } from "./content";

describe("rewriteLegalHref", () => {
  it("maps document files to routes in both languages", () => {
    expect(rewriteLegalHref("personvernerklaering.md", "nb")).toBe("/personvern");
    expect(rewriteLegalHref("privacy-notice.md", "en")).toBe("/en/personvern");
    expect(rewriteLegalHref("brukervilkar.md#rangering", "nb")).toBe("/vilkar#rangering");
    expect(rewriteLegalHref("/apenhet", "en")).toBe("/en/apenhet");
  });
  it("drops unsafe targets", () => {
    expect(rewriteLegalHref("javascript:alert(1)", "nb")).toBeUndefined();
    expect(rewriteLegalHref("//evil.example", "nb")).toBeUndefined();
    expect(rewriteLegalHref("http://insecure.example", "nb")).toBeUndefined();
  });
});

describe("headingId", () => {
  it("gives the ranking section a fixed anchor", () => {
    expect(headingId("7. Rangering av annonser")).toBe("rangering");
    expect(headingId("7. Ranking of listings")).toBe("rangering");
    expect(headingId("12. Betaling skjer utenfor Laandet")).toBe("12-betaling-skjer-utenfor-laandet");
  });
});

const support = `---
doc_key: support_page
---

<!-- note -->

# Støtt Laandet

Felles tekst.

---

<!-- @block no_campaign -->

Ingen innsamling.

---

<!-- @block campaign_active -->

Hos **{{provider.name}}**, org.nr. {{recipient.orgNumber}}.

[Gå til innsamlingen]({{campaign.url}})
`;

describe("renderSupportPage", () => {
  it("shows the no-campaign block by default", () => {
    const md = renderSupportPage(stripLegalMarkup(support), null);
    expect(md).toContain("Ingen innsamling.");
    expect(md).not.toContain("{{");
    expect(md).not.toContain("innsamlingen]");
  });
  it("fills and escapes campaign values", () => {
    const md = renderSupportPage(stripLegalMarkup(support), {
      url: "https://example.org/c?a=1",
      providerName: "Spleis *test*",
      feeText: "x",
      recipientName: "R",
      recipientOrgNr: "123 456 789",
    });
    expect(md).toContain("Spleis \\*test\\*");
    expect(md).toContain("(https://example.org/c?a=1)");
    expect(md).not.toContain("Ingen innsamling.");
  });
});
