import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pageLocale } from "@/i18n/page";
import { PageHeader } from "@/ui/layout/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: t("safetyTitle") };
}

export default async function SafetyPage({ params }: PageProps<"/[locale]/trygghet">) {
  await pageLocale(params);
  const t = await getTranslations("pages");
  const tf = await getTranslations("footer");
  return (
    <div className="wrap max-w-3xl py-10">
      <PageHeader title={t("safetyTitle")} lead={t("safetyLead")} />
      <div className="flex flex-col gap-8">
        <section className="card p-6">
          <h2 className="mb-4 text-2xl">{t("safetyNow")}</h2>
          <ul className="flex list-disc flex-col gap-2 pl-6">
            {(["safetyNow1", "safetyNow2", "safetyNow3", "safetyNow4", "safetyNow5"] as const).map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ul>
        </section>
        <section className="card p-6">
          <h2 className="mb-4 text-2xl">{t("safetyPlanned")}</h2>
          <ul className="flex list-disc flex-col gap-2 pl-6">
            {(["safetyPlanned1", "safetyPlanned2", "safetyPlanned3"] as const).map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ul>
        </section>
        <p className="flex flex-wrap gap-4">
          <Link href="/retningslinjer/trygg-utleie" className="text-link">
            {tf("safeRental")}
          </Link>
          <Link href="/retningslinjer/forbudte-gjenstander" className="text-link">
            {tf("prohibited")}
          </Link>
          <Link href="/retningslinjer/tvister" className="text-link">
            {tf("disputes")}
          </Link>
        </p>
      </div>
    </div>
  );
}
