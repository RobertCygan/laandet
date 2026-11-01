import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/i18n/format";
import { pageLocale } from "@/i18n/page";
import { requireStaffPage } from "@/modules/auth/guards";
import { listRecentlyClosed, listSupportQueue } from "@/modules/disputes/support";
import { AdminNav } from "@/ui/admin/AdminNav";
import { PageHeader } from "@/ui/layout/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("disputes");
  return { title: t("staff.queueTitle"), robots: { index: false } };
}

/** Escalated cases (P03-01 step 4). The queue shows metadata only; the case text needs a grant. */
export default async function SupportQueuePage({ params }: PageProps<"/[locale]/admin/saker">) {
  const locale = await pageLocale(params);
  const actor = await requireStaffPage(locale);
  const [queue, closed] = await Promise.all([listSupportQueue(actor), listRecentlyClosed(actor)]);
  const t = await getTranslations("disputes");
  const ta = await getTranslations("admin");

  return (
    <div className="wrap py-10">
      <PageHeader title={ta("title")} lead={t("staff.queueLead")} />
      <AdminNav current="disputes" />
      <section className="flex flex-col gap-3" aria-labelledby="queue">
        <h2 id="queue" className="text-2xl">
          {t("staff.queueTitle")}
        </h2>
        {queue.length === 0 ? (
          <p>{t("staff.queueEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.map((q) => (
              <li key={q.id} className="card flex flex-col gap-1 p-4">
                <p className="flex flex-wrap items-center gap-2">
                  <strong>{t(`categories.${q.category}`)}</strong>
                  <span className="badge badge-warning">{t(`status.${q.status}`)}</span>
                  {q.reportedLate && <span className="badge">{t("reportedLate")}</span>}
                  {q.repeated && <span className="badge badge-danger">{t("staff.repeated")}</span>}
                </p>
                <p className="text-sm text-muted">
                  {t("staff.escalatedAt", { date: q.escalatedAt ? formatDateTime(q.escalatedAt, locale) : "–" })} ·{" "}
                  {q.assignedName ? t("staff.assignedTo", { name: q.assignedName }) : t("staff.unassigned")}
                </p>
                <Link href={`/admin/saker/${q.id}`} className="text-link">
                  {t("staff.open")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {closed.length > 0 && (
        <section className="mt-10 flex flex-col gap-3" aria-labelledby="closed">
          <h2 id="closed" className="text-2xl">
            {t("staff.recentlyClosed")}
          </h2>
          <ul className="flex flex-col gap-2">
            {closed.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/saker/${c.id}`} className="text-link">
                  {t(`categories.${c.category}`)} · {t(`status.${c.status}`)} ·{" "}
                  {c.closedAt ? formatDateTime(c.closedAt, locale) : ""}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
