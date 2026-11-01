import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { TotpForm } from "@/ui/forms/AuthForms";
import { NarrowPage, PageHeader } from "@/ui/layout/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("totpTitle") };
}

export default async function TotpPage({ params }: PageProps<"/[locale]/logg-inn/totp">) {
  const locale = await pageLocale(params);
  const t = await getTranslations("auth");
  return (
    <NarrowPage>
      <PageHeader title={t("totpTitle")} lead={t("totpLead")} />
      <div className="card p-6">
        <TotpForm locale={locale} />
      </div>
    </NarrowPage>
  );
}
