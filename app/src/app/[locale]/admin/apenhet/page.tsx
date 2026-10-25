import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatKr, oreToInput } from "@/i18n/format";
import { pageLocale, param } from "@/i18n/page";
import { listTransparencyForAdmin } from "@/modules/admin/transparency";
import { requireStaffPage } from "@/modules/auth/guards";
import { can } from "@/modules/authz/policy";
import { AdminNav } from "@/ui/admin/AdminNav";
import { RemoveTransparencyForm, TransparencyForm } from "@/ui/admin/PanelForms";
import { monthLabel } from "@/ui/admin/TransparencyTable";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminPanel");
  return { title: t("transparencyTitle"), robots: { index: false } };
}

/** Transparency figures (P03-07, admin): one row per month from invoices and payout statements. */
export default async function AdminTransparencyPage({ params, searchParams }: PageProps<"/[locale]/admin/apenhet">) {
  const locale = await pageLocale(params);
  const actor = await requireStaffPage(locale);
  if (!can(actor, "transparency.manage").allow) notFound();
  const saved = param((await searchParams).lagret) === "1";
  const rows = await listTransparencyForAdmin(actor);
  const t = await getTranslations("adminPanel");
  return (
    <div className="wrap py-10">
      <PageHeader title={t("transparencyTitle")} lead={t("transparencyLead")} />
      <AdminNav current="transparency" />
      {saved && (
        <div className="mb-6">
          <Notice tone="success" role="status">
            {t("saved")}
          </Notice>
        </div>
      )}
      <p className="mb-6">
        <Link href="/apenhet" className="text-link">
          {t("openPublicPage")}
        </Link>
      </p>
      <section className="card mb-8 flex flex-col gap-3 p-6" aria-labelledby="new-month">
        <h2 id="new-month" className="text-xl">
          {t("addMonth")}
        </h2>
        <p className="text-sm">{t("addMonthHint")}</p>
        <TransparencyForm locale={locale} />
      </section>
      {rows.length === 0 ? (
        <p>{t("noMonths")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id} className="card flex flex-col gap-2 p-4">
              <h2 className="text-lg">{monthLabel(r.month, locale)}</h2>
              <p>
                {t("amount.costTotal")}: <strong>{formatKr(r.costTotalOre)}</strong> · {t("amount.supportReceived")}:{" "}
                {r.supportReceivedOre === null ? "–" : formatKr(r.supportReceivedOre)}
              </p>
              {r.sourceNote && (
                <p className="text-sm text-muted">
                  {t("sourceNote")}: {r.sourceNote}
                </p>
              )}
              <details>
                <summary className="cursor-pointer font-bold">{t("correctMonth")}</summary>
                <div className="mt-3">
                  <TransparencyForm
                    locale={locale}
                    initial={{
                      month: r.month.slice(0, 7),
                      costTotal: oreToInput(r.costTotalOre),
                      costServer: oreToInput(r.costServerOre),
                      costBackup: oreToInput(r.costBackupOre),
                      costEmail: oreToInput(r.costEmailOre),
                      costDomain: oreToInput(r.costDomainOre),
                      costOther: oreToInput(r.costOtherOre),
                      supportReceived: oreToInput(r.supportReceivedOre),
                      note: r.note ?? "",
                      sourceNote: r.sourceNote ?? "",
                    }}
                  />
                </div>
              </details>
              <details>
                <summary className="cursor-pointer font-bold">{t("removeMonth")}</summary>
                <div className="mt-3">
                  <RemoveTransparencyForm monthId={r.id} locale={locale} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
