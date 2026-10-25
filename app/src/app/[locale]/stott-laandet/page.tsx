import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { env } from "@/modules/config/env";
import { renderSupportPage, type SupportCampaign } from "@/modules/legal/content";
import { LegalDocument } from "@/ui/legal/LegalDocument";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: t("supportTitle") };
}

/** Voluntary support (docs/SUPPORT_AND_FUNDING.md). The campaign block shows only with a real, configured campaign. */
export default async function SupportPage({ params }: PageProps<"/[locale]/stott-laandet">) {
  const locale = await pageLocale(params);
  const e = env();
  const campaign: SupportCampaign | null =
    e.SUPPORT_CAMPAIGN_URL && e.SUPPORT_PROVIDER_NAME && e.SUPPORT_FEE_TEXT && e.SUPPORT_RECIPIENT_NAME && e.SUPPORT_RECIPIENT_ORGNR
      ? {
          url: e.SUPPORT_CAMPAIGN_URL,
          providerName: e.SUPPORT_PROVIDER_NAME,
          feeText: e.SUPPORT_FEE_TEXT,
          recipientName: e.SUPPORT_RECIPIENT_NAME,
          recipientOrgNr: e.SUPPORT_RECIPIENT_ORGNR,
        }
      : null;
  return <LegalDocument docKey="support_page" locale={locale} transform={(md) => renderSupportPage(md, campaign)} />;
}
