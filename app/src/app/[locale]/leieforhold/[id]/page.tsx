import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatDateTime, formatKr, osloInputs } from "@/i18n/format";
import { pageLocale, param } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { bookingStepAction } from "@/modules/rentals/actions";
import { getBookingForParty } from "@/modules/rentals/queries";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";
import { CancelForm, ChangeTermsForm, MeetingPlaceForm, StepForm } from "@/ui/rentals/RentalForms";
import { StatusBadge } from "@/ui/rentals/StatusBadge";
import { openDisputeIdForBooking } from "@/modules/disputes/queries";
import { REPORTABLE_BOOKING_STATUSES } from "@/modules/disputes/rules";

const OK_KEYS = ["requested", "accept", "decline", "withdraw", "cancelled", "place", "not_returned"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rentals");
  return { title: t("bookingTitle"), robots: { index: false } };
}

export default async function BookingPage({ params, searchParams }: PageProps<"/[locale]/leieforhold/[id]">) {
  const locale = await pageLocale(params);
  const { id } = await params;
  const actor = await requirePageUser(locale, `/leieforhold/${id}`);
  const v = await getBookingForParty(actor, id);
  if (!v) notFound();
  const caseId = await openDisputeIdForBooking(v.booking.id);
  const td = await getTranslations("disputes");
  const b = v.booking;
  const t = await getTranslations("rentals");
  const ok = param((await searchParams).ok);
  const isOwner = v.role === "owner";
  const other = isOwner ? v.renterName : v.ownerName;
  const { handoverOpen, notReturnedOpen, methods } = v;
  const fields = { bookingId: b.id, locale };
  const s = osloInputs(v.start);
  const e = osloInputs(v.end);
  const accepted = new Set(v.acceptances.map((a) => a.partyRole));
  const actorName = (actorId: string | null) =>
    actorId === null ? t("bySystem") : actorId === actor.id ? t("byYou") : other;

  return (
    <div className="wrap flex max-w-3xl flex-col gap-6 py-10">
      <Link href="/leieforhold" className="text-link inline-flex items-center gap-1.5">
        <ArrowLeft size={16} aria-hidden="true" />
        {t("myTitle")}
      </Link>
      <PageHeader title={v.title} lead={t(isOwner ? "youLendTo" : "youRentFrom", { name: other })}>
        <div className="mt-3">
          <StatusBadge status={b.status} />
        </div>
      </PageHeader>

      {ok && (OK_KEYS as readonly string[]).includes(ok) && (
        <Notice tone="success" role="status">
          {t(`ok.${ok}`)}
        </Notice>
      )}

      {/* The next step for this party */}
      <section className="card flex flex-col gap-4 p-6" aria-labelledby="next-step">
        <h2 id="next-step" className="text-xl">
          {t("nextStep")}
        </h2>
        {b.status === "requested" && isOwner && (
          <>
            <p>{t("next.requestedOwner", { due: formatDateTime(b.ownerResponseDueAt, locale) })}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <StepForm action={bookingStepAction} fields={{ ...fields, op: "accept" }} label={t("accept")} />
              <StepForm
                action={bookingStepAction}
                fields={{ ...fields, op: "decline" }}
                label={t("decline")}
                className="button button-outline"
              />
            </div>
          </>
        )}
        {b.status === "requested" && !isOwner && (
          <>
            <p>{t("next.requestedRenter", { due: formatDateTime(b.ownerResponseDueAt, locale) })}</p>
            <StepForm
              action={bookingStepAction}
              fields={{ ...fields, op: "withdraw" }}
              label={t("withdraw")}
              className="button button-outline"
            />
          </>
        )}
        {b.status === "accepted" && (
          <>
            <p>
              {accepted.has(v.role)
                ? t("next.acceptedWaiting", { name: other })
                : t("next.acceptedRead", { due: b.agreementDueAt ? formatDateTime(b.agreementDueAt, locale) : "–" })}
            </p>
            <Link href={`/leieforhold/${b.id}/avtale`} className="button button-primary">
              {t("openAgreement")}
            </Link>
          </>
        )}
        {b.status === "confirmed" && (
          <>
            <p>{handoverOpen ? t("next.handoverOpen") : t("next.handoverLater")}</p>
            {handoverOpen && (
              <Link href={`/leieforhold/${b.id}/utlevering`} className="button button-primary">
                {t("openHandover")}
              </Link>
            )}
          </>
        )}
        {(b.status === "handed_over" || b.status === "not_returned") && (
          <>
            <p>{t(b.status === "handed_over" ? "next.handedOver" : "next.notReturned")}</p>
            <Link href={`/leieforhold/${b.id}/tilbakelevering`} className="button button-primary">
              {t("openReturn")}
            </Link>
            {isOwner && b.status === "handed_over" && notReturnedOpen && (
              <StepForm
                action={bookingStepAction}
                fields={{ ...fields, op: "not_returned" }}
                label={t("markNotReturned")}
                className="button button-outline"
              >
                <p className="text-sm">{t("markNotReturnedHint")}</p>
              </StepForm>
            )}
          </>
        )}
        {b.status === "return_pending" && (
          <>
            <p>{t("next.returnPending")}</p>
            <Link href={`/leieforhold/${b.id}/tilbakelevering`} className="button button-primary">
              {t("openReturn")}
            </Link>
          </>
        )}
        {b.status === "completed" && <p>{t("next.completed")}</p>}
        {b.status === "disputed" && <Notice tone="warning">{t("next.disputed")}</Notice>}
        {["declined", "withdrawn", "expired", "cancelled"].includes(b.status) && <p>{t("next.closed")}</p>}
        <Link href={`/meldinger/${b.conversationId}`} className="text-link">
          {t("openConversation")}
        </Link>
        {caseId ? (
          <Link href={`/saker/${caseId}`} className="text-link">
            {td("seeCase")}
          </Link>
        ) : (
          REPORTABLE_BOOKING_STATUSES.includes(b.status) && (
            <Link href={`/leieforhold/${b.id}/problem`} className="text-link">
              {td("reportProblem")}
            </Link>
          )
        )}
      </section>

      {/* Terms snapshot: later edits to the listing never change it */}
      <section className="card flex flex-col gap-3 p-6" aria-labelledby="terms">
        <h2 id="terms" className="text-xl">
          {t("terms")}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="font-bold">{t("period")}</dt>
          <dd>
            {formatDateTime(v.start, locale)} – {formatDateTime(v.end, locale)}
          </dd>
          <dt className="font-bold">{t("price")}</dt>
          <dd>
            {b.priceOre === 0
              ? t("freeLoan")
              : t("priceSummary", {
                  unit: t(`units.${b.priceUnit}`, { n: b.units }),
                  total: formatKr(b.totalPriceOre),
                })}
          </dd>
          <dt className="font-bold">{t("deposit")}</dt>
          <dd>{b.depositOre ? formatKr(b.depositOre) : t("noDeposit")}</dd>
          <dt className="font-bold">{t("handoverMethod")}</dt>
          <dd>
            {t(`method.${b.handoverMethod}`)}
            {b.deliveryFeeOre ? ` (${t("deliveryFee", { amount: formatKr(b.deliveryFeeOre) })})` : ""}
          </dd>
          <dt className="font-bold">{t("returnMethod")}</dt>
          <dd>{t(`method.${b.returnMethod}`)}</dd>
        </dl>
        <Notice tone="warning">{t("paymentWarning")}</Notice>
        {v.contracts.length > 0 && (
          <Link href={`/leieforhold/${b.id}/avtale`} className="text-link">
            {t("openAgreement")}
          </Link>
        )}
        {v.reports.map((r) => (
          <Link
            key={r.id}
            href={`/leieforhold/${b.id}/${r.phase === "handover" ? "utlevering" : "tilbakelevering"}`}
            className="text-link"
          >
            {t(r.phase === "handover" ? "openHandoverReport" : "openReturnReport")}
          </Link>
        ))}
      </section>

      {/* The exact meeting place is private to the two parties and never in the agreement */}
      {["accepted", "confirmed", "handed_over", "return_pending", "not_returned"].includes(b.status) && (
        <section className="card flex flex-col gap-3 p-6" aria-labelledby="place">
          <h2 id="place" className="text-xl">
            {t("meetingPlace")}
          </h2>
          {b.meetingPlacePrivate && <p className="whitespace-pre-line">{b.meetingPlacePrivate}</p>}
          <MeetingPlaceForm bookingId={b.id} locale={locale} current={b.meetingPlacePrivate ?? ""} />
        </section>
      )}

      {(b.status === "accepted" || b.status === "confirmed") && (
        <section className="card flex flex-col gap-4 p-6">
          <details>
            <summary className="cursor-pointer font-bold">{t("changeTerms")}</summary>
            <div className="mt-4">
              <ChangeTermsForm
                bookingId={b.id}
                locale={locale}
                methods={methods}
                initial={{
                  startDate: s.date,
                  startTime: s.time,
                  endDate: e.date,
                  endTime: e.time,
                  handoverMethod: b.handoverMethod,
                  returnMethod: b.returnMethod,
                }}
              />
            </div>
          </details>
          <details>
            <summary className="cursor-pointer font-bold">{t("cancel")}</summary>
            <div className="mt-4">
              <CancelForm bookingId={b.id} locale={locale} />
            </div>
          </details>
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="history">
        <h2 id="history" className="text-xl">
          {t("history")}
        </h2>
        <ol className="flex flex-col gap-2 border-l-2 border-secondary pl-4">
          {v.events.map((ev) => (
            <li key={ev.id}>
              <span className="text-sm text-muted">{formatDateTime(ev.createdAt, locale)}</span>
              <br />
              {t.has(`event.${ev.event}`) ? t(`event.${ev.event}`) : ev.event} · {actorName(ev.actorId)}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
