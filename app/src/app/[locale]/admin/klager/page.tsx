import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/i18n/format";
import { localePath, pageLocale, param } from "@/i18n/page";
import { requireStaffPage } from "@/modules/auth/guards";
import { listOpenAppeals } from "@/modules/moderation/service";
import { AdminNav } from "@/ui/admin/AdminNav";
import { DecideAppealForm } from "@/ui/admin/AdminForms";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("appeals"), robots: { index: false } };
}

export default async function AppealsPage({ params, searchParams }: PageProps<"/[locale]/admin/klager">) {
  const locale = await pageLocale(params);
  const saved = param((await searchParams).lagret) === "1";
  const back = localePath(locale, "/admin/klager");
  const actor = await requireStaffPage(locale);
  const appeals = await listOpenAppeals(actor);
  const t = await getTranslations("admin");
  return (
    <div className="wrap py-10">
      <PageHeader title={t("appeals")} />
      <AdminNav current="appeals" />
      {saved && (
        <div className="mb-6">
          <Notice tone="success" role="status">
            {t("done")}
          </Notice>
        </div>
      )}
      {appeals.length === 0 ? (
        <p>{t("noAppeals")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {appeals.map((a) => (
            <li key={a.id} className="card flex flex-col gap-3 p-5">
              <p className="font-bold">
                {a.listingId ? (
                  <Link href={`/annonse/${a.listingId}`} className="text-link" target="_blank">
                    {t("appealAbout", { title: a.listingTitle ?? "" })}
                  </Link>
                ) : (
                  t("appealAbout", { title: "–" })
                )}
              </p>
              <p className="text-sm text-muted">{formatDateTime(a.createdAt, locale)}</p>
              <div>
                <p className="text-sm font-bold">{t("originalStatement")}</p>
                <p className="whitespace-pre-line">{a.statement}</p>
              </div>
              <blockquote className="border-l-4 border-accent pl-4 whitespace-pre-line">{a.text}</blockquote>
              <DecideAppealForm appealId={a.id} back={back} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
