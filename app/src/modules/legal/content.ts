import type { LegalDocKey } from "@/db/schema";

/** Public route of each legal document (nb path; English adds /en). */
export const LEGAL_ROUTES: Record<LegalDocKey, string> = {
  terms: "/vilkar",
  privacy: "/personvern",
  cookies: "/informasjonskapsler",
  rental_simple: "/avtaler/forenklet-leieavtale",
  rental_extended: "/avtaler/utvidet-leieavtale",
  giveaway_transfer: "/avtaler/gis-bort",
  dispute_guidelines: "/retningslinjer/tvister",
  prohibited_items: "/retningslinjer/forbudte-gjenstander",
  safe_rental: "/retningslinjer/trygg-utleie",
  support_page: "/stott-laandet",
};

/** Source file names (laandet/legal/{nb,en}) → document, for rewriting links between documents. */
const FILE_TO_KEY: Record<string, LegalDocKey> = {
  "brukervilkar.md": "terms",
  "terms-of-use.md": "terms",
  "personvernerklaering.md": "privacy",
  "privacy-notice.md": "privacy",
  "informasjonskapsler.md": "cookies",
  "cookies.md": "cookies",
  "forenklet-leieavtale.md": "rental_simple",
  "simplified-rental-agreement.md": "rental_simple",
  "utvidet-leieavtale.md": "rental_extended",
  "extended-rental-agreement.md": "rental_extended",
  "gis-bort-overleveringsbekreftelse.md": "giveaway_transfer",
  "giveaway-transfer-confirmation.md": "giveaway_transfer",
  "retningslinjer-for-tvister.md": "dispute_guidelines",
  "dispute-guidelines.md": "dispute_guidelines",
  "forbudte-og-begrensede-gjenstander.md": "prohibited_items",
  "prohibited-and-restricted-items.md": "prohibited_items",
  "retningslinjer-for-trygg-utleie.md": "safe_rental",
  "safe-rental-guidelines.md": "safe_rental",
  "stott-laandet.md": "support_page",
  "support-laandet.md": "support_page",
};

/** Link target in a legal text → safe href (internal paths get the locale prefix). */
export function rewriteLegalHref(href: string | undefined, locale: "nb" | "en"): string | undefined {
  if (!href) return undefined;
  const prefix = locale === "en" ? "/en" : "";
  const [file, hash] = href.split("#");
  const key = file ? FILE_TO_KEY[file] : undefined;
  if (key) return `${prefix}${LEGAL_ROUTES[key]}${hash ? `#${hash}` : ""}`;
  if (href.startsWith("#")) return href;
  if (href.startsWith("/") && !href.startsWith("//")) return `${prefix}${href}`;
  if (/^https:\/\//.test(href) || href.startsWith("mailto:")) return href;
  return undefined; // anything else (javascript:, data:, relative junk) is dropped
}

/** Stable heading anchors; the ranking section is always #rangering (linked from explore and footer). */
export function headingId(text: string): string {
  if (/rangering|ranking/i.test(text)) return "rangering";
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Remove front matter and HTML comments (developer notes); `@block` markers are kept. */
export function stripLegalMarkup(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n/, "").replace(/<!--(?!\s*@block)[\s\S]*?-->/g, "");
}

export type SupportCampaign = {
  url: string;
  providerName: string;
  feeText: string;
  recipientName: string;
  recipientOrgNr: string;
};

const escapeMd = (s: string) => s.replace(/[\\`*_{}[\]()#+\-.!|<>]/g, "\\$&");

/**
 * The support page has two blocks (docs/SUPPORT_AND_FUNDING.md): `no_campaign` (default) and
 * `campaign_active`, shown only when a real campaign is configured. Values are escaped.
 */
export function renderSupportPage(md: string, campaign: SupportCampaign | null): string {
  const parts = md.split(/<!--\s*@block\s+(\w+)\s*-->/);
  const common = (parts[0] ?? "").replace(/\n---\s*$/, "");
  const blocks: Record<string, string> = {};
  for (let i = 1; i < parts.length; i += 2) blocks[parts[i]!] = (parts[i + 1] ?? "").replace(/\n---\s*$/m, "").trim();
  if (!campaign) return `${common}\n\n${blocks.no_campaign ?? ""}`;
  const values: Record<string, string> = {
    "provider.name": escapeMd(campaign.providerName),
    "provider.feeText": escapeMd(campaign.feeText),
    "recipient.legalName": escapeMd(campaign.recipientName),
    "recipient.orgNumber": escapeMd(campaign.recipientOrgNr),
    "campaign.url": encodeURI(campaign.url),
  };
  const block = (blocks.campaign_active ?? "").replace(/\{\{([a-zA-Z.]+)\}\}/g, (_, k: string) => values[k] ?? "");
  return `${common}\n\n${block}`;
}
