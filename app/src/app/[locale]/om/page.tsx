import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { PageHeader } from "@/ui/layout/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: t("aboutTitle") };
}

export default async function AboutPage({ params }: PageProps<"/[locale]/om">) {
  await pageLocale(params);
  const t = await getTranslations("pages");
  return (
    <div className="wrap max-w-3xl py-10">
      <PageHeader title={t("aboutTitle")} lead={t("aboutLead")} />
      <div className="flex flex-col gap-4 text-base">
        <p>{t("aboutText1")}</p>
        <p>{t("aboutText2")}</p>
        <p>{t("aboutText3")}</p>
      </div>
    </div>
  );
}
