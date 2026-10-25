import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/i18n/format";
import { localePath, pageLocale, param } from "@/i18n/page";
import { requireStaffPage } from "@/modules/auth/guards";
import { listOpenReports } from "@/modules/moderation/service";
import { AdminNav } from "@/ui/admin/AdminNav";
import { DismissReportForm, HideListingForm, UserMeasureForm } from "@/ui/admin/AdminForms";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("reports"), robots: { index: false } };
}

/** Moderation queue (P01-12): newest first, optional filter for automatic keyword reports. */
export default async function ReportsPage({ params, searchParams }: PageProps<"/[locale]/admin/rapporter">) {
  const locale = await pageLocale(params);
  const actor = await requireStaffPage(locale);
  const sp = await searchParams;
  const automaticOnly = param(sp.automatisk) === "1";
  const type = param(sp.type);
  const saved = param(sp.lagret) === "1";
  const back = localePath(locale, "/admin/rapporter");
  const reports = await listOpenReports(actor, { automaticOnly, type });
  const t = await getTranslations("admin");
  const tr = await getTranslations("report");
  const tl = await getTranslations("listing");
  const ti = await getTranslations("inbox");
  return (
    <div className="wrap py-10">
      <PageHeader title={t("reports")} />
      <AdminNav current="reports" />
      {saved && (
        <div className="mb-6">
          <Notice tone="success" role="status">
            {t("done")}
          </Notice>
        </div>
      )}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/admin/rapporter"
          className={`button button-sm ${automaticOnly ? "button-subtle" : "button-outline"}`}
          aria-current={!automaticOnly ? "page" : undefined}
        >
          {t("filterAll")}
        </Link>
        <Link
          href={{ pathname: "/admin/rapporter", query: { automatisk: "1" } }}
          className={`button button-sm ${automaticOnly ? "button-outline" : "button-subtle"}`}
          aria-current={automaticOnly ? "page" : undefined}
        >
          {t("filterAutomatic")}
        </Link>
        {(["listing", "user", "message", "review"] as const).map((k) => (
          <Link
            key={k}
            href={{ pathname: "/admin/rapporter", query: { type: k } }}
            className={`button button-sm ${type === k ? "button-outline" : "button-subtle"}`}
            aria-current={type === k ? "page" : undefined}
          >
            {t(`targetTypes.${k}`)}
          </Link>
        ))}
      </div>
      {reports.length === 0 ? (
        <p>{t("noReports")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {reports.map((r) => {
            // Staff never handle their own cases (reported by them, or about their listing or profile).
            const ownCase =
              r.listingOwnerId === actor.id ||
              r.reporterId === actor.id ||
              (r.targetType === "user" && r.targetId === actor.id) ||
              (r.targetType === "message" && r.messageSenderId === actor.id) ||
              (r.targetType === "review" && (r.reviewAuthorId === actor.id || r.reviewSubjectId === actor.id));
            return (
              <li key={r.id} className="card flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-warning">{tr(`reasons.${r.reason}`)}</span>
                  {r.isAutomatic && <span className="badge">{t("automatic")}</span>}
                  {r.repeated && <span className="badge badge-danger">{t("repeatedReports")}</span>}
                  <span className="text-sm text-muted">
                    {t("reportedAt", { date: formatDateTime(r.createdAt, locale) })}
                  </span>
                </div>
                {r.targetType === "listing" ? (
                  <p>
                    <Link href={`/annonse/${r.targetId}`} className="text-link font-bold" target="_blank">
                      {r.listingTitle ?? r.targetId}
                    </Link>{" "}
                    {r.listingStatus && <span className="text-sm text-muted">({tl(`status.${r.listingStatus}`)})</span>}
                  </p>
                ) : r.targetType === "message" ? (
                  <div>
                    <p className="text-sm font-bold">{ti("reportedMessage")}</p>
                    <p className="whitespace-pre-line break-words">{r.messageBody}</p>
                    {r.messageSenderId && (
                      <Link href={`/profil/${r.messageSenderId}`} className="text-link text-sm" target="_blank">
                        {ti("reportedMessageSender")}
                      </Link>
                    )}
                  </div>
                ) : r.targetType === "review" ? (
                  <div>
                    <p className="text-sm font-bold">{t("reportedReview")}</p>
                    <p className="whitespace-pre-line break-words">{r.reviewComment || "–"}</p>
                    {r.reviewSubjectId && (
                      <Link href={`/profil/${r.reviewSubjectId}`} className="text-link text-sm" target="_blank">
                        {t("openProfile")}
                      </Link>
                    )}
                  </div>
                ) : (
                  <p>
                    {t("reportedProfile")}: <strong>{r.userName ?? "–"}</strong>
                    {r.userStatus && r.userStatus !== "active" ? ` (${t(`accountStatus.${r.userStatus}`)})` : ""}{" "}
                    <Link href={`/profil/${r.targetId}`} className="text-link" target="_blank">
                      {t("openProfile")}
                    </Link>
                  </p>
                )}
                {r.details && (
                  <div>
                    <p className="text-sm font-bold">{t("reportDetails")}</p>
                    <p className="whitespace-pre-line">{r.details}</p>
                  </div>
                )}
                {ownCase ? (
                  <Notice>{t("ownCase")}</Notice>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {r.targetType === "listing" &&
                      r.listingStatus &&
                      !["removed", "deleted"].includes(r.listingStatus) && (
                        <details className="rounded-md border border-border p-3">
                          <summary className="cursor-pointer font-bold">{t("hide")}</summary>
                          <div className="mt-3">
                            <HideListingForm listingId={r.targetId} reportId={r.id} back={back} />
                          </div>
                        </details>
                      )}
                    {(r.targetType === "user" || (r.targetType === "message" && r.messageSenderId)) && (
                      <details className="rounded-md border border-border p-3">
                        <summary className="cursor-pointer font-bold">{t("measure.title")}</summary>
                        <div className="mt-3">
                          <UserMeasureForm
                            userId={r.targetType === "user" ? r.targetId : r.messageSenderId!}
                            reportId={r.id}
                            back={back}
                          />
                        </div>
                      </details>
                    )}
                    <details className="rounded-md border border-border p-3">
                      <summary className="cursor-pointer font-bold">{t("dismiss")}</summary>
                      <div className="mt-3">
                        <DismissReportForm reportId={r.id} back={back} />
                      </div>
                    </details>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
