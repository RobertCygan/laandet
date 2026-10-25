import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/i18n/format";
import { pageLocale, param } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { getReviewPage } from "@/modules/reviews/service";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";
import { ReviewCard } from "@/ui/reviews/ReviewCard";
import { ReviewForm } from "@/ui/reviews/ReviewForm";

const OK_KEYS = ["sealed", "published"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reviews");
  return { title: t("title"), robots: { index: false } };
}

/** `/leieforhold/[id]/vurdering` (P03-02): write one's own review; see both once they are published. */
export default async function ReviewPage({ params, searchParams }: PageProps<"/[locale]/leieforhold/[id]/vurdering">) {
  const locale = await pageLocale(params);
  const { id } = await params;
  const actor = await requirePageUser(locale, `/leieforhold/${id}/vurdering`);
  const v = await getReviewPage(actor, id);
  if (!v) notFound();
  const t = await getTranslations("reviews");
  const tr = await getTranslations("rentals");
  const ok = param((await searchParams).ok);

  return (
    <div className="wrap flex max-w-2xl flex-col gap-6 py-10">
      <Link href={`/leieforhold/${v.bookingId}`} className="text-link inline-flex items-center gap-1.5">
        <ArrowLeft size={16} aria-hidden="true" />
        {tr("bookingTitle")}
      </Link>
      <PageHeader title={t("title")} lead={t("lead", { title: v.title, name: v.otherName })} />

      {ok && (OK_KEYS as readonly string[]).includes(ok) && (
        <Notice tone="success" role="status">
          {t(`ok.${ok}`)}
        </Notice>
      )}

      {v.canWrite && (
        <section className="card flex flex-col gap-4 p-6" aria-labelledby="write">
          <h2 id="write" className="text-xl">
            {t("writeTitle", { name: v.otherName })}
          </h2>
          {v.windowEnd && <p className="text-sm">{t("deadline", { date: formatDateTime(v.windowEnd, locale) })}</p>}
          <ReviewForm bookingId={v.bookingId} role={v.role} locale={locale} />
        </section>
      )}

      {v.mine?.status === "sealed" && (
        <Notice>
          <p>{t("sealedNote")}</p>
          {v.windowEnd && <p>{t("sealedUntil", { date: formatDateTime(v.windowEnd, locale) })}</p>}
        </Notice>
      )}
      {v.mine?.status === "removed" && <Notice tone="warning">{t("removedNote")}</Notice>}
      {!v.canWrite && !v.mine && <Notice>{v.bookingStatus === "completed" ? t("windowClosed") : t("notYet")}</Notice>}

      {v.published.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="published">
          <h2 id="published" className="text-xl">
            {t("publishedTitle")}
          </h2>
          {v.published.map((r) => (
            <ReviewCard
              key={r.id}
              review={{
                id: r.id,
                authorRole: r.authorRole,
                authorName: r.authorId === v.meId ? t("you") : v.otherName,
                communication: r.ratingCommunication,
                punctuality: r.ratingPunctuality,
                accuracy: r.ratingAccuracy,
                itemCondition: r.ratingItemCondition,
                agreement: r.ratingAgreement,
                comment: r.comment,
                publishedAt: r.publishedAt,
              }}
            />
          ))}
        </section>
      )}
    </div>
  );
}
