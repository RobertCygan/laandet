import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { listTransparencyMonths } from "@/modules/admin/transparency";
import { CostEstimates, TransparencyMonths } from "@/ui/admin/TransparencyTable";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: t("transparencyTitle") };
}

/** Costs and contributions (P03-07): only real figures the owner entered; estimates in their own section. */
export default async function TransparencyPage({ params }: PageProps<"/[locale]/apenhet">) {
  const locale = await pageLocale(params);
  const rows = await listTransparencyMonths();
  const t = await getTranslations("pages");
  const tt = await getTranslations("transparency");
  return (
    <div className="wrap flex max-w-3xl flex-col gap-8 py-10">
      <PageHeader title={t("transparencyTitle")} lead={t("transparencyLead")} />
      <section className="flex flex-col gap-3" aria-labelledby="actual">
        <h2 id="actual" className="text-xl">
          {tt("actualTitle")}
        </h2>
        {rows.length === 0 ? (
          <Notice>{t("transparencyEmpty")}</Notice>
        ) : (
          <>
            <p className="text-sm">{tt("actualLead")}</p>
            <TransparencyMonths rows={rows} locale={locale} />
          </>
        )}
      </section>
      <CostEstimates />
    </div>
  );
}
