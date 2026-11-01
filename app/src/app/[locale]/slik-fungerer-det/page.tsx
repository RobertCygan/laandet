import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pageLocale } from "@/i18n/page";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: t("howTitle") };
}

export default async function HowItWorksPage({ params }: PageProps<"/[locale]/slik-fungerer-det">) {
  await pageLocale(params);
  const t = await getTranslations("pages");
  const tf = await getTranslations("footer");
  return (
    <div className="wrap max-w-3xl py-10">
      <PageHeader title={t("howTitle")} lead={t("howLead")} />
      <div className="flex flex-col gap-8">
        <Notice>
          <p className="font-bold">{t("howStatusHeading")}</p>
          <p>{t("howStatus")}</p>
        </Notice>
        <section className="card p-6">
          <h2 className="mb-4 text-2xl">{t("howRentHeading")}</h2>
          <ol className="flex list-decimal flex-col gap-3 pl-6">
            <li>{t("howRent1")}</li>
            <li>{t("howRent2")}</li>
            <li>{t("howRent3")}</li>
            <li>{t("howRent4")}</li>
          </ol>
        </section>
        <section className="card p-6">
          <h2 className="mb-4 text-2xl">{t("howWantedHeading")}</h2>
          <p>{t("howWanted1")}</p>
        </section>
        <section className="card p-6">
          <h2 className="mb-4 text-2xl">{t("howGiveHeading")}</h2>
          <p>{t("howGive1")}</p>
        </section>
        <p className="flex flex-wrap gap-4">
          <Link href="/retningslinjer/trygg-utleie" className="text-link">
            {tf("safeRental")}
          </Link>
          <Link href="/vilkar" className="text-link">
            {tf("terms")}
          </Link>
        </p>
      </div>
    </div>
  );
}
