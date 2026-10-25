import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { formatDateTime } from "@/i18n/format";
import { pageLocale } from "@/i18n/page";
import { requireStaffPage } from "@/modules/auth/guards";
import { adminCounts, listRecentModeration } from "@/modules/moderation/service";
import { AdminNav } from "@/ui/admin/AdminNav";
import { PageHeader } from "@/ui/layout/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("title"), robots: { index: false } };
}

const COUNT_KEYS = ["users", "listings", "open_reports", "open_appeals", "outbox_pending", "outbox_failed"] as const;

export default async function AdminPage({ params }: PageProps<"/[locale]/admin">) {
  const locale = await pageLocale(params);
  const actor = await requireStaffPage(locale);
  const [counts, recent] = await Promise.all([adminCounts(actor), listRecentModeration(actor)]);
  const t = await getTranslations("admin");
  const tr = await getTranslations("report");
  return (
    <div className="wrap py-10">
      <PageHeader title={t("title")} lead={t("dashboardLead")} />
      <AdminNav current="dashboard" />
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {COUNT_KEYS.map((k) => (
          <div key={k} className="card p-5">
            <dt className="text-sm text-muted">{t(`counts.${k}`)}</dt>
            <dd className="mt-1 text-3xl font-bold">{counts[k]}</dd>
          </div>
        ))}
      </dl>
      <section className="mt-10" aria-labelledby="recent-h">
        <h2 id="recent-h" className="mb-4 text-2xl">
          {t("recent")}
        </h2>
        {recent.length === 0 ? (
          <p>{t("noRecent")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((a) => (
              <li key={a.id} className="card p-4 text-sm">
                <p className="font-bold">
                  {t("listingHiddenLabel")} ·{" "}
                  {a.reasonCode && tr.has(`reasons.${a.reasonCode}`)
                    ? tr(`reasons.${a.reasonCode}` as "reasons.other")
                    : a.reasonCode}
                </p>
                <p className="text-muted">{formatDateTime(a.createdAt, locale)}</p>
                <p className="mt-1 line-clamp-2 whitespace-pre-line">{a.statementOfReasons}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
