import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: t("transparencyTitle") };
}

/** Costs and contributions: shown only when real, checked numbers exist (none yet). */
export default async function TransparencyPage({ params }: PageProps<"/[locale]/apenhet">) {
  await pageLocale(params);
  const t = await getTranslations("pages");
  return (
    <div className="wrap max-w-3xl py-10">
      <PageHeader title={t("transparencyTitle")} lead={t("transparencyLead")} />
      <Notice>{t("transparencyEmpty")}</Notice>
    </div>
  );
}
