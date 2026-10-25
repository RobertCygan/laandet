import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { formatDate } from "@/i18n/format";

export type ReviewView = {
  id: string;
  authorRole: "owner" | "renter";
  /** null = the author deleted the account («Tidligere medlem»). */
  authorName: string | null;
  communication: number;
  punctuality: number;
  accuracy: number | null;
  itemCondition: number;
  agreement: number;
  comment: string | null;
  publishedAt: Date | null;
};

/** A published review, rendered as plain text. */
export async function ReviewCard({ review: r, children }: { review: ReviewView; children?: ReactNode }) {
  const t = await getTranslations("reviews");
  const scores = [
    ["communication", r.communication],
    ["punctuality", r.punctuality],
    ["accuracy", r.accuracy],
    ["itemCondition", r.itemCondition],
    ["agreement", r.agreement],
  ] as const;
  return (
    <article className="card flex flex-col gap-3 p-4">
      <p className="text-sm text-muted">
        {t(r.authorRole === "owner" ? "byOwner" : "byRenter", { name: r.authorName ?? t("formerMember") })}
        {r.publishedAt ? ` · ${formatDate(r.publishedAt)}` : ""}
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        {scores.map(([k, v]) =>
          v === null ? null : (
            <div key={k} className="contents">
              <dt>{t(`criteria.${k}`)}</dt>
              <dd className="font-bold">{t("outOf5", { n: v })}</dd>
            </div>
          ),
        )}
      </dl>
      {r.comment && <p className="whitespace-pre-line">{r.comment}</p>}
      {children}
    </article>
  );
}
