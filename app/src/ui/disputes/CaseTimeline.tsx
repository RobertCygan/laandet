import { getTranslations } from "next-intl/server";
import { formatDateTime, formatKr } from "@/i18n/format";
import { decodeRecommendation } from "@/modules/disputes/rules";

type Event = {
  id: string;
  actorId: string | null;
  kind: string;
  body: string | null;
  mediaId: string | null;
  reference: { type: string; id: string } | null;
  visibility: string;
  createdAt: Date;
};
type Proposal = {
  id: string;
  proposerId: string;
  type: string;
  amountOre: number | null;
  newReturnAt: Date | null;
  text: string;
  status: string;
};

/**
 * The case file in time order (P03-01). Plain text only. For the parties, staff-only notes arrive
 * without text and are shown as «intern merknad».
 */
export async function CaseTimeline({
  events,
  proposals,
  names,
  messages,
  locale,
  staffView = false,
}: {
  events: Event[];
  proposals: Proposal[];
  names: Record<string, string>;
  messages: { id: string; senderId: string | null; body: string; createdAt: Date }[];
  locale: "nb" | "en";
  staffView?: boolean;
}) {
  const t = await getTranslations("disputes");
  const who = (id: string | null) => (id ? (names[id] ?? t("laandetSupport")) : t("system"));
  const proposalOf = (id: string | undefined) => proposals.find((p) => p.id === id);

  return (
    <ol className="flex flex-col gap-3">
      {events.map((e) => {
        const head = (
          <p className="text-sm text-muted">
            {formatDateTime(e.createdAt, locale)} · {who(e.actorId)}
            {staffView && e.visibility === "staff_only" ? ` · ${t("staffOnlyLabel")}` : ""}
          </p>
        );
        if (e.kind === "statement")
          return (
            <li key={e.id} className="card p-4">
              {head}
              <p className="mt-1 whitespace-pre-line">{e.body}</p>
            </li>
          );
        if (e.kind === "evidence_photo" && e.mediaId)
          return (
            <li key={e.id} className="card p-4">
              {head}
              <a href={`/media/${e.mediaId}/display`} target="_blank" rel="noopener" aria-label={t("openPhoto")}>
                {/* eslint-disable-next-line @next/next/no-img-element -- authorised media route (parties, staff with a grant) */}
                <img
                  src={`/media/${e.mediaId}/thumb`}
                  alt=""
                  width={240}
                  height={180}
                  loading="lazy"
                  className="mt-2 aspect-[4/3] w-40 rounded object-cover"
                />
              </a>
            </li>
          );
        if (e.kind === "reference" && e.reference?.type === "message") {
          const m = messages.find((x) => x.id === e.reference!.id);
          return (
            <li key={e.id} className="card p-4">
              {head}
              <p className="text-sm font-bold">{t("attachedMessage")}</p>
              {m ? (
                <blockquote className="mt-1 border-l-4 border-secondary pl-3 whitespace-pre-line">
                  {who(m.senderId)}, {formatDateTime(m.createdAt, locale)}: {m.body}
                </blockquote>
              ) : (
                <p className="text-sm text-muted">{t("messageUnavailable")}</p>
              )}
            </li>
          );
        }
        if (e.kind === "proposal") {
          const p = proposalOf(e.reference?.id);
          if (!p) return null;
          return (
            <li key={e.id} className="card p-4">
              {head}
              <p className="font-bold">
                {t("proposalLabel")}: {t(`proposalTypes.${p.type}`)}
                {p.amountOre !== null ? ` · ${formatKr(p.amountOre)}` : ""}
                {p.newReturnAt ? ` · ${formatDateTime(p.newReturnAt, locale)}` : ""}
              </p>
              <p className="whitespace-pre-line">{p.text}</p>
              <p className="mt-1 text-sm">
                <span className="badge">{t(`proposalStatus.${p.status}`)}</span>
              </p>
            </li>
          );
        }
        if (e.kind === "proposal_response")
          return (
            <li key={e.id} className="text-sm">
              {formatDateTime(e.createdAt, locale)} ·{" "}
              {t(e.body === "accept" ? "answerAccepted" : "answerRejected", { name: who(e.actorId) })}
            </li>
          );
        if (e.kind === "status_change")
          return (
            <li key={e.id} className="text-sm">
              {formatDateTime(e.createdAt, locale)} ·{" "}
              {e.body === "reopened" ? t("reopened") : t.has(`status.${e.body}`) ? t(`status.${e.body}`) : e.body}
            </li>
          );
        if (e.kind === "support_request")
          return (
            <li key={e.id} className="text-sm">
              {formatDateTime(e.createdAt, locale)} · {t("askedForHelp", { name: who(e.actorId) })}
            </li>
          );
        if (e.kind === "support_note")
          return (
            <li key={e.id} className="card border-l-4 border-l-primary p-4">
              <p className="text-sm text-muted">
                {formatDateTime(e.createdAt, locale)} · {t("laandetSupport")}
                {staffView && e.visibility === "staff_only" ? ` · ${t("staffOnlyLabel")}` : ""}
              </p>
              {e.body === null ? (
                <p className="italic">{t("internalNote")}</p>
              ) : (
                <p className="mt-1 whitespace-pre-line">{e.body}</p>
              )}
            </li>
          );
        if (e.kind === "support_recommendation") {
          const r = decodeRecommendation(e.body);
          if (!r) return null;
          return (
            <li key={e.id} className="card border-l-4 border-l-primary p-4">
              <p className="text-sm text-muted">
                {formatDateTime(e.createdAt, locale)} · {t("laandetSupport")}
              </p>
              <h3 className="mt-1 text-base">{t("recommendationTitle")}</h3>
              <dl className="mt-2 flex flex-col gap-2">
                {(["documented", "disagreed", "recommendation"] as const).map((k) => (
                  <div key={k}>
                    <dt className="font-bold">{t(`recommendation.${k}`)}</dt>
                    <dd className="whitespace-pre-line">{r[k]}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        }
        return null;
      })}
    </ol>
  );
}
