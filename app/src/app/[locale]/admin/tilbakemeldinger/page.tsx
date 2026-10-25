import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { formatDateTime } from "@/i18n/format";
import { pageLocale, param } from "@/i18n/page";
import { requireStaffPage } from "@/modules/auth/guards";
import { listFeedback } from "@/modules/feedback/service";
import { AdminNav } from "@/ui/admin/AdminNav";
import { MarkHandledForm } from "@/ui/feedback/FeedbackForms";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("feedback");
  return { title: t("adminTitle"), robots: { index: false } };
}

/** Feedback from members and beta testers (P04-01), for all staff. */
export default async function AdminFeedbackPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/tilbakemeldinger">) {
  const locale = await pageLocale(params);
  const actor = await requireStaffPage(locale);
  const saved = param((await searchParams).lagret) === "1";
  const { open, handled } = await listFeedback(actor);
  const t = await getTranslations("feedback");
  const item = (f: (typeof open)[number], withButton: boolean) => (
    <li key={f.id} className="card flex flex-col gap-2 p-4">
      <p className="text-sm text-muted">
        {t(`kind.${f.kind}`)} · {formatDateTime(f.createdAt, locale)} · {f.senderName}
        {f.pagePath && <> · {f.pagePath}</>}
      </p>
      <p className="whitespace-pre-line">{f.body}</p>
      {withButton && <MarkHandledForm feedbackId={f.id} locale={locale} />}
    </li>
  );
  return (
    <div className="wrap py-10">
      <PageHeader title={t("adminTitle")} lead={t("adminLead")} />
      <AdminNav current="feedback" />
      {saved && (
        <div className="mb-6">
          <Notice tone="success" role="status">
            {t("handledSaved")}
          </Notice>
        </div>
      )}
      <section aria-labelledby="open-h" className="mb-10">
        <h2 id="open-h" className="mb-3 text-xl">
          {t("openHeading", { count: open.length })}
        </h2>
        {open.length === 0 ? (
          <p>{t("noneOpen")}</p>
        ) : (
          <ul className="flex flex-col gap-3">{open.map((f) => item(f, true))}</ul>
        )}
      </section>
      {handled.length > 0 && (
        <section aria-labelledby="handled-h">
          <h2 id="handled-h" className="mb-3 text-xl">
            {t("handledHeading")}
          </h2>
          <ul className="flex flex-col gap-3">{handled.map((f) => item(f, false))}</ul>
        </section>
      )}
    </div>
  );
}
