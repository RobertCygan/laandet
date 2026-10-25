import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatDateTime, formatKr } from "@/i18n/format";
import { pageLocale, param } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { caseStepAction, recommendationAnswerAction, respondProposalAction } from "@/modules/disputes/actions";
import { getDisputeForParty } from "@/modules/disputes/queries";
import { CaseTimeline } from "@/ui/disputes/CaseTimeline";
import { ProposalForm, ReferenceForm, StatementForm } from "@/ui/disputes/DisputeForms";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";
import { StepForm } from "@/ui/rentals/RentalForms";

const OK_KEYS = [
  "opened",
  "statement",
  "reference",
  "proposal",
  "accepted",
  "rejected",
  "answered",
  "escalate",
  "withdraw",
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("disputes");
  return { title: t("caseTitle"), robots: { index: false } };
}

/** The case page for the two parties (P03-01): private, neutral, and never shown anywhere public (N12). */
export default async function CasePage({ params, searchParams }: PageProps<"/[locale]/saker/[id]">) {
  const locale = await pageLocale(params);
  const { id } = await params;
  const actor = await requirePageUser(locale, `/saker/${id}`);
  const v = await getDisputeForParty(actor, id);
  if (!v) notFound();
  const t = await getTranslations("disputes");
  const tr = await getTranslations("rentals");
  const ok = param((await searchParams).ok);
  const d = v.dispute;
  const fields = { disputeId: d.id, locale };
  const p = v.pendingProposal;
  const rec = v.latestRecommendation;

  return (
    <div className="wrap flex max-w-3xl flex-col gap-6 py-10">
      <Link href={`/leieforhold/${d.bookingId}`} className="text-link inline-flex items-center gap-1.5">
        <ArrowLeft size={16} aria-hidden="true" />
        {tr("bookingTitle")}
      </Link>
      <PageHeader title={t("caseTitle")} lead={`${v.title} · ${t(`categories.${d.category}`)}`}>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={`badge ${v.open ? "badge-warning" : ""}`}>{t(`status.${d.status}`)}</span>
          {d.reportedLate && <span className="badge">{t("reportedLate")}</span>}
        </div>
      </PageHeader>

      {ok && (OK_KEYS as readonly string[]).includes(ok) && (
        <Notice tone="success" role="status">
          {t(`ok.${ok}`)}
        </Notice>
      )}
      {d.category === "unsafe_equipment" && v.open && (
        <Notice tone="danger">
          <p className="font-bold">{t("safetyTitle")}</p>
          <p>{t("safetyText")}</p>
        </Notice>
      )}
      <Notice>
        <p>{t("principles")}</p>
      </Notice>

      <section className="card flex flex-col gap-2 p-6" aria-labelledby="facts">
        <h2 id="facts" className="text-xl">
          {t("about")}
        </h2>
        <p className="text-sm text-muted">
          {t("openedBy", { name: v.openerName, date: formatDateTime(d.openedAt, locale) })}
        </p>
        <p className="whitespace-pre-line">{d.summary}</p>
        {d.status === "awaiting_response" && (
          <p className="text-sm">
            {t("respondBy", { name: v.respondentName, date: formatDateTime(d.responseDueAt, locale) })}
          </p>
        )}
        {d.status === "awaiting_documentation" && (
          <p className="text-sm">{t("documentationBy", { date: formatDateTime(d.responseDueAt, locale) })}</p>
        )}
        <p className="flex flex-wrap gap-3 text-sm">
          <Link href={`/leieforhold/${d.bookingId}/utlevering`} className="text-link">
            {tr("openHandoverReport")}
          </Link>
          <Link href={`/leieforhold/${d.bookingId}/tilbakelevering`} className="text-link">
            {tr("openReturnReport")}
          </Link>
        </p>
        <p className="fine-print">{t("deadlinesNote")}</p>
      </section>

      {!v.open && (
        <Notice tone={d.status === "resolved_by_agreement" ? "success" : "info"}>
          <p className="font-bold">{t(`closed.${d.status}`)}</p>
          {d.closureNote && (
            <p className="whitespace-pre-line">
              {d.status === "resolved_by_agreement" ? `${t("agreedSolution")}: ` : ""}
              {d.closureNote}
            </p>
          )}
          {d.status !== "resolved_by_agreement" && d.status !== "withdrawn" && <p>{t("externalOptions")}</p>}
          {d.status === "resolved_by_agreement" && <p>{t("noMoneyThroughLaandet")}</p>}
        </Notice>
      )}

      {v.open && p && (
        <section className="card flex flex-col gap-3 p-6" aria-labelledby="pending">
          <h2 id="pending" className="text-xl">
            {t("pendingProposal")}
          </h2>
          <p className="font-bold">
            {t(`proposalTypes.${p.type}`)}
            {p.amountOre !== null ? ` · ${formatKr(p.amountOre)}` : ""}
            {p.newReturnAt ? ` · ${formatDateTime(p.newReturnAt, locale)}` : ""}
          </p>
          <p className="whitespace-pre-line">{p.text}</p>
          {p.proposerId === v.meId ? (
            <p className="text-sm">{t("waitingForAnswer")}</p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <StepForm
                action={respondProposalAction}
                fields={{ ...fields, proposalId: p.id, decision: "accept" }}
                label={t("accept")}
              />
              <StepForm
                action={respondProposalAction}
                fields={{ ...fields, proposalId: p.id, decision: "reject" }}
                label={t("reject")}
                className="button button-outline"
              />
            </div>
          )}
        </section>
      )}

      {v.open && rec?.text && (
        <section className="card flex flex-col gap-3 p-6" aria-labelledby="rec">
          <h2 id="rec" className="text-xl">
            {t("recommendationTitle")}
          </h2>
          <p className="text-sm">{t("recommendationNotBinding")}</p>
          <p className="text-sm">
            {t("yourAnswer")}: {rec.mine ? t(rec.mine === "accept" ? "accepted" : "rejected") : t("notAnswered")} ·{" "}
            {t("otherAnswer")}: {rec.other ? t(rec.other === "accept" ? "accepted" : "rejected") : t("notAnswered")}
          </p>
          {rec.mine !== "accept" && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <StepForm
                action={recommendationAnswerAction}
                fields={{ ...fields, eventId: rec.id, decision: "accept" }}
                label={t("acceptRecommendation")}
              />
              {rec.mine !== "reject" && (
                <StepForm
                  action={recommendationAnswerAction}
                  fields={{ ...fields, eventId: rec.id, decision: "reject" }}
                  label={t("rejectRecommendation")}
                  className="button button-outline"
                />
              )}
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="file">
        <h2 id="file" className="text-xl">
          {t("caseFile")}
        </h2>
        <CaseTimeline
          events={v.events}
          proposals={v.proposals}
          names={v.nameOf}
          messages={v.referenced}
          locale={locale}
        />
      </section>

      {v.open && (
        <>
          <section className="card flex flex-col gap-4 p-6" aria-labelledby="add">
            <h2 id="add" className="text-xl">
              {t("addTitle")}
            </h2>
            <StatementForm disputeId={d.id} locale={locale} />
          </section>
          <section className="card flex flex-col gap-4 p-6" aria-labelledby="propose">
            <h2 id="propose" className="text-xl">
              {t("proposeTitle")}
            </h2>
            <p className="text-sm">{t("guidance")}</p>
            <ProposalForm disputeId={d.id} locale={locale} />
          </section>
          <section className="card flex flex-col gap-4 p-6" aria-labelledby="attach">
            <h2 id="attach" className="text-xl">
              {t("attachTitle")}
            </h2>
            <ReferenceForm
              disputeId={d.id}
              locale={locale}
              messages={v.thread.map((m) => ({
                id: m.id,
                label: `${formatDateTime(m.createdAt, locale)} · ${v.nameOf[m.senderId ?? ""] ?? ""}: ${m.body.slice(0, 80)}`,
              }))}
            />
          </section>
          <section className="card flex flex-col gap-3 p-6" aria-labelledby="help">
            <h2 id="help" className="text-xl">
              {t("helpTitle")}
            </h2>
            {d.status === "support_review" || d.status === "awaiting_documentation" ? (
              <p>{t("supportFollowing")}</p>
            ) : v.canEscalate ? (
              <StepForm
                action={caseStepAction}
                fields={{ ...fields, op: "escalate" }}
                label={t("escalate")}
                className="button button-outline"
              >
                <p className="text-sm">{t("escalateNote")}</p>
              </StepForm>
            ) : (
              <p className="text-sm">{t("escalateLater")}</p>
            )}
            {v.isOpener && (
              <StepForm
                action={caseStepAction}
                fields={{ ...fields, op: "withdraw" }}
                label={t("withdraw")}
                className="button button-subtle"
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
