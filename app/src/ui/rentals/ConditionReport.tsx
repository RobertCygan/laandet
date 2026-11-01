import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/i18n/format";
import { requirePageUser } from "@/modules/auth/guards";
import { getBookingForParty, getConditionReport, type ConditionReportView } from "@/modules/rentals/queries";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";
import { ConditionEntryForm, ConfirmConditionForm } from "./ConditionForms";

type Phase = "handover" | "return";
type Entry = ConditionReportView["entries"][number];
const OK_KEYS = ["entry", "waiting", "agreed", "contested"] as const;

/** `/leieforhold/[id]/utlevering` and `/tilbakelevering` (P02-05): current view, history, who must confirm. */
export async function ConditionReportPage({
  locale,
  bookingId,
  phase,
  ok,
}: {
  locale: "nb" | "en";
  bookingId: string;
  phase: Phase;
  ok?: string;
}) {
  const path = `/leieforhold/${bookingId}/${phase === "handover" ? "utlevering" : "tilbakelevering"}`;
  const actor = await requirePageUser(locale, path);
  const v = await getBookingForParty(actor, bookingId);
  if (!v) notFound();
  const b = v.booking;
  const t = await getTranslations("condition");
  const tr = await getTranslations("rentals");
  const view = await getConditionReport(b.id, phase);
  const handoverOpen = v.handoverOpen;
  const reportOpen =
    !view || (view.report.status !== "agreed" && view.report.status !== "lapsed" && !view.report.closedAt);
  const canWrite =
    reportOpen &&
    (phase === "handover"
      ? b.status === "confirmed" && handoverOpen
      : ["handed_over", "not_returned", "return_pending"].includes(b.status));
  const canConfirm =
    !!view &&
    view.decisions.seq > 0 &&
    !view.report.closedAt &&
    (phase === "handover" ? b.status === "confirmed" : b.status === "return_pending");
  const myLatest = view?.entries.find((e) => e.authorId === actor.id && e.current);
  const myDecision = view ? view.decisions[v.role] : null;
  const name = (role: "owner" | "renter") => (role === "owner" ? v.ownerName : v.renterName);

  return (
    <div className="wrap flex max-w-3xl flex-col gap-6 py-10">
      <Link href={`/leieforhold/${b.id}`} className="text-link inline-flex items-center gap-1.5">
        <ArrowLeft size={16} aria-hidden="true" />
        {tr("bookingTitle")}
      </Link>
      <PageHeader title={t(phase === "handover" ? "handoverTitle" : "returnTitle")} lead={v.title} />

      {ok && (OK_KEYS as readonly string[]).includes(ok) && (
        <Notice tone="success" role="status">
          {t(`ok.${ok}`)}
        </Notice>
      )}
      {view?.report.status === "lapsed" && <Notice tone="warning">{t("lapsed")}</Notice>}
      {view?.report.status === "agreed" && <Notice tone="success">{t("agreed")}</Notice>}
      {view?.report.status === "contested" && <Notice tone="warning">{t("contested")}</Notice>}

      {view && view.decisions.seq > 0 && (
        <section className="card flex flex-col gap-2 p-6" aria-labelledby="who">
          <h2 id="who" className="text-xl">
            {t("whoConfirms")}
          </h2>
          <ul className="flex flex-col gap-1">
            {(["owner", "renter"] as const).map((r) => (
              <li key={r}>
                {name(r)}: <strong>{t(`decision.${view.decisions[r] ?? "pending"}`)}</strong>
              </li>
            ))}
          </ul>
          <p className="fine-print">{t("latestOnly")}</p>
        </section>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="current">
        <h2 id="current" className="text-xl">
          {t("current")}
        </h2>
        {!view || !view.entries.length ? (
          <p>{t("noEntries")}</p>
        ) : (
          view.entries
            .filter((e) => e.current)
            .map((e) => <EntryCard key={e.id} entry={e} author={name(e.authorRole)} locale={locale} />)
        )}
        {view && view.entries.some((e) => !e.current) && (
          <details className="card p-4">
            <summary className="cursor-pointer font-bold">{t("history")}</summary>
            <div className="mt-4 flex flex-col gap-4">
              {view.entries
                .filter((e) => !e.current)
                .map((e) => (
                  <EntryCard key={e.id} entry={e} author={name(e.authorRole)} locale={locale} superseded />
                ))}
            </div>
          </details>
        )}
        {view && view.confirmations.length > 0 && (
          <details className="card p-4">
            <summary className="cursor-pointer font-bold">{t("confirmationHistory")}</summary>
            <ul className="mt-3 flex flex-col gap-1">
              {view.confirmations.map((c) => (
                <li key={c.id}>
                  {formatDateTime(c.createdAt, locale)} · {name(c.partyRole)} · {t(`decision.${c.decision}`)} (
                  {t("version", { n: c.latestEntrySeq })}){c.comment ? `: ${c.comment}` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {canConfirm && myDecision !== "confirm" && (
        <section className="card flex flex-col gap-4 p-6" aria-labelledby="confirm">
          <h2 id="confirm" className="text-xl">
            {t("confirmTitle")}
          </h2>
          <ConfirmConditionForm bookingId={b.id} phase={phase} locale={locale} />
        </section>
      )}

      {canWrite && (
        <section className="card flex flex-col gap-4 p-6" aria-labelledby="entry">
          <h2 id="entry" className="text-xl">
            {myLatest ? t("correctTitle") : t("entryTitle")}
          </h2>
          {myLatest && <p className="text-sm">{t("correctHint")}</p>}
          <ConditionEntryForm
            bookingId={b.id}
            phase={phase}
            locale={locale}
            accessories={v.accessories}
            supersedesEntryId={myLatest?.id}
          />
        </section>
      )}
      {phase === "handover" && b.status === "confirmed" && !handoverOpen && <Notice>{tr("next.handoverLater")}</Notice>}
    </div>
  );
}

async function EntryCard({
  entry: e,
  author,
  locale,
  superseded = false,
}: {
  entry: Entry;
  author: string;
  locale: "nb" | "en";
  superseded?: boolean;
}) {
  const t = await getTranslations("condition");
  const tl = await getTranslations("listing");
  const row = (label: string, value: string | null | undefined) =>
    value ? (
      <>
        <dt className="font-bold">{label}</dt>
        <dd className="whitespace-pre-line">{value}</dd>
      </>
    ) : null;
  return (
    <article className={`card flex flex-col gap-3 p-4 ${superseded ? "opacity-70" : ""}`}>
      <p className="text-sm text-muted">
        {t("entryBy", { name: author, date: formatDateTime(e.createdAt, locale), n: e.seq })}
        {superseded ? ` · ${t("superseded")}` : ""}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {row(t("overall"), e.overallCondition ? tl(`condition.${e.overallCondition}`) : null)}
        {row(t("functional"), e.functionalStatus ? t(`functionalValue.${e.functionalStatus}`) : null)}
        {row(t("existingDamage"), e.existingDamage)}
        {row(t("newDamage"), e.newDamage)}
        {row(
          t("accessories"),
          e.accessories.length
            ? e.accessories.map((a) => `${a.name}: ${a.present ? t("present") : t("missing")}`).join(", ")
            : null,
        )}
        {row(t("fuelOrBattery"), e.fuelOrBattery)}
        {row(t("cleanliness"), e.cleanliness ? t(`cleanlinessValue.${e.cleanliness}`) : null)}
        {row(t("serial"), e.serialOrIdentifier)}
        {row(t("outcome"), e.proposedOutcome ? t(`outcomeValue.${e.proposedOutcome}`) : null)}
        {row(t("notes"), e.notes)}
      </dl>
      {e.photoIds.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {e.photoIds.map((id, i) => (
            <li key={id}>
              <a href={`/media/${id}/display`} target="_blank" rel="noopener" aria-label={t("openPhoto", { n: i + 1 })}>
                {/* eslint-disable-next-line @next/next/no-img-element -- authorised media route (parties only) */}
                <img
                  src={`/media/${id}/thumb`}
                  alt=""
                  width={240}
                  height={180}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
