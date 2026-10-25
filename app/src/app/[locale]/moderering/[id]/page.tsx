import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { formatDateTime } from "@/i18n/format";
import { pageLocale } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { getModerationForUser } from "@/modules/moderation/service";
import { NarrowPage, PageHeader } from "@/ui/layout/PageHeader";
import { AppealForm } from "@/ui/listings/ListingActions";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("moderation");
  return { title: t("title"), robots: { index: false } };
}

/** The affected user's view of a decision: statement of reasons and appeal (P01-11). */
export default async function ModerationDecisionPage({ params }: PageProps<"/[locale]/moderering/[id]">) {
  const locale = await pageLocale(params);
  const { id } = await params;
  const actor = await requirePageUser(locale, `/moderering/${id}`);
  const view = await getModerationForUser(actor, id);
  if (!view) notFound();
  const t = await getTranslations("moderation");
  const tr = await getTranslations("report");
  const a = view.action;
  const reason =
    a.reasonCode && tr.has(`reasons.${a.reasonCode}`) ? tr(`reasons.${a.reasonCode}` as "reasons.other") : a.reasonCode;

  return (
    <NarrowPage>
      <PageHeader title={t("title")} lead={t("hidden", { title: view.listingTitle })} />
      <section className="card mb-6 flex flex-col gap-2 p-6">
        <h2 className="text-xl">{t("reasons")}</h2>
        {reason && <p className="font-bold">{reason}</p>}
        <p className="whitespace-pre-line">{a.statementOfReasons}</p>
        <p className="fine-print">{t("decidedAt", { date: formatDateTime(a.createdAt, locale) })}</p>
      </section>
      <section className="card flex flex-col gap-4 p-6">
        <h2 className="text-xl">{t("appealHeading")}</h2>
        {view.appeal ? (
          <>
            <Notice tone={view.appeal.status === "reversed" ? "success" : "info"}>
              {t(`appealStatus.${view.appeal.status}`)}
            </Notice>
            {view.appeal.decisionText && <p className="whitespace-pre-line">{view.appeal.decisionText}</p>}
            {view.appeal.decidedBySameStaff && <p className="fine-print">{t("sameStaffNote")}</p>}
          </>
        ) : (
          <>
            <p>{t("appealLead")}</p>
            <AppealForm actionId={a.id} />
          </>
        )}
      </section>
    </NarrowPage>
  );
}
