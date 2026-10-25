import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/i18n/format";
import { pageLocale, param } from "@/i18n/page";
import { requireStaffPage } from "@/modules/auth/guards";
import { getCaseForStaff, getCaseMetaForStaff } from "@/modules/disputes/support";
import { isAppError } from "@/modules/errors";
import { AdminNav } from "@/ui/admin/AdminNav";
import { CaseTimeline } from "@/ui/disputes/CaseTimeline";
import {
  DocumentationForm,
  RecommendForm,
  ReopenForm,
  StaffCloseForm,
  SupportNoteForm,
  TakeCaseForm,
} from "@/ui/disputes/DisputeForms";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

const OK_KEYS = ["taken", "note", "documentation", "recommended", "closed", "reopened"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("disputes");
  return { title: t("caseTitle"), robots: { index: false } };
}

/**
 * Staff view of a case. Without an active grant only metadata is shown, with «Ta saken» (reason
 * required). With a grant, the whole case file; every view is audited by the service.
 */
export default async function StaffCasePage({ params, searchParams }: PageProps<"/[locale]/admin/saker/[id]">) {
  const locale = await pageLocale(params);
  const { id } = await params;
  const actor = await requireStaffPage(locale);
  const meta = await getCaseMetaForStaff(actor, id).catch((err: unknown) => {
    if (isAppError(err) && (err.code === "not_found" || err.code === "forbidden")) return null;
    throw err;
  });
  if (!meta) notFound();
  const t = await getTranslations("disputes");
  const tl = await getTranslations("listing");
  const tc = await getTranslations("condition");
  const ok = param((await searchParams).ok);
  const view = meta.hasGrant ? await getCaseForStaff(actor, id) : null;
  const open = ["support_review", "awaiting_documentation", "awaiting_response", "in_negotiation"].includes(
    meta.status,
  );

  return (
    <div className="wrap py-10">
      <Link href="/admin/saker" className="text-link mb-4 inline-flex items-center gap-1.5">
        <ArrowLeft size={16} aria-hidden="true" />
        {t("staff.queueTitle")}
      </Link>
      <PageHeader title={t("caseTitle")} lead={t(`categories.${meta.category}`)}>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="badge badge-warning">{t(`status.${meta.status}`)}</span>
          {meta.reportedLate && <span className="badge">{t("reportedLate")}</span>}
        </div>
      </PageHeader>
      <AdminNav current="disputes" />
      {ok && (OK_KEYS as readonly string[]).includes(ok) && (
        <div className="mb-6">
          <Notice tone="success" role="status">
            {t(`staff.ok.${ok}`)}
          </Notice>
        </div>
      )}

      {!view && (
        <section className="card flex max-w-2xl flex-col gap-4 p-6">
          <p>{t("staff.noGrant")}</p>
          {meta.canTake && <TakeCaseForm disputeId={id} locale={locale} />}
          {meta.canReopen && <ReopenForm disputeId={id} locale={locale} />}
        </section>
      )}

      {view && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-6">
            <Notice>
              <p>{t("staff.grantUntil", { date: formatDateTime(view.grantExpiresAt, locale) })}</p>
            </Notice>
            <section className="card flex flex-col gap-2 p-6">
              <h2 className="text-xl">{view.booking.title}</h2>
              <p className="text-sm text-muted">
                {t("openedBy", { name: view.openerName, date: formatDateTime(view.dispute.openedAt, locale) })} ·{" "}
                {t("staff.respondent", { name: view.respondentName })}
              </p>
              <p className="whitespace-pre-line">{view.dispute.summary}</p>
            </section>
            <section className="flex flex-col gap-3">
              <h2 className="text-xl">{t("caseFile")}</h2>
              <CaseTimeline
                events={view.events}
                proposals={view.proposals}
                names={{
                  [view.dispute.openedBy]: view.openerName,
                  [view.dispute.respondentId]: view.respondentName,
                }}
                messages={view.referencedMessages}
                locale={locale}
                staffView
              />
            </section>
            <section className="flex flex-col gap-3">
              <h2 className="text-xl">{t("staff.conditionReports")}</h2>
              {view.reports.length === 0 && <p>{t("staff.noReports")}</p>}
              {view.reports.map((r) => (
                <div key={r.id} className="card flex flex-col gap-2 p-4">
                  <h3 className="text-base">
                    {t(`staff.phase.${r.phase}`)} · {t(`staff.reportStatus.${r.status}`)}
                    {r.returnOutcome && tc.has(`outcomeValue.${r.returnOutcome}`)
                      ? ` · ${tc(`outcomeValue.${r.returnOutcome}`)}`
                      : ""}
                  </h3>
                  {r.entries.map((e) => (
                    <div key={e.id} className="border-t border-border pt-2 text-sm">
                      <p className="text-muted">
                        {formatDateTime(e.createdAt, locale)} ·{" "}
                        {e.authorId === view.booking.ownerId ? t("staff.owner") : t("staff.renter")} · v{e.seq}
                      </p>
                      <p>
                        {e.overallCondition ? tl(`condition.${e.overallCondition}`) : ""}
                        {e.existingDamage ? ` · ${e.existingDamage}` : ""}
                        {e.newDamage ? ` · ${e.newDamage}` : ""}
                        {e.notes ? ` · ${e.notes}` : ""}
                      </p>
                      {e.photoIds.length > 0 && (
                        <ul className="mt-1 flex flex-wrap gap-2">
                          {e.photoIds.map((m) => (
                            <li key={m}>
                              <a
                                href={`/media/${m}/display`}
                                target="_blank"
                                rel="noopener"
                                aria-label={t("openPhoto")}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element -- authorised media route (grant, audited) */}
                                <img
                                  src={`/media/${m}/thumb`}
                                  alt=""
                                  width={160}
                                  height={120}
                                  loading="lazy"
                                  className="rounded object-cover"
                                />
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </section>
          </div>
          <aside className="flex flex-col gap-5">
            {open ? (
              <>
                <section className="card flex flex-col gap-3 p-6">
                  <h2 className="text-lg">{t("staff.recommendTitle")}</h2>
                  <p className="text-sm">{t("staff.recommendHint")}</p>
                  <RecommendForm disputeId={id} locale={locale} />
                </section>
                <section className="card flex flex-col gap-3 p-6">
                  <h2 className="text-lg">{t("staff.noteTitle")}</h2>
                  <SupportNoteForm disputeId={id} locale={locale} />
                </section>
                {meta.status === "support_review" && (
                  <section className="card flex flex-col gap-3 p-6">
                    <h2 className="text-lg">{t("staff.requestDocs")}</h2>
                    <DocumentationForm disputeId={id} locale={locale} />
                  </section>
                )}
                <section className="card flex flex-col gap-3 p-6">
                  <h2 className="text-lg">{t("staff.closeTitle")}</h2>
                  <p className="text-sm">{t("staff.closeHint")}</p>
                  <StaffCloseForm disputeId={id} locale={locale} />
                </section>
              </>
            ) : (
              <section className="card flex flex-col gap-3 p-6">
                <p>{t(`closed.${meta.status}`)}</p>
                {meta.canReopen && <ReopenForm disputeId={id} locale={locale} />}
              </section>
            )}
            <Notice>{t("staff.limits")}</Notice>
          </aside>
        </div>
      )}
    </div>
  );
}
