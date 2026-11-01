import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { formatDate } from "@/i18n/format";
import { pageLocale } from "@/i18n/page";
import { listLegalVersions } from "@/modules/admin/settings";
import { requireStaffPage } from "@/modules/auth/guards";
import { can } from "@/modules/authz/policy";
import { AdminNav } from "@/ui/admin/AdminNav";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminPanel");
  return { title: t("legalTitle"), robots: { index: false } };
}

/** Legal versions (P03-04, admin, read-only): texts are loaded with `npm run legal:load`. */
export default async function AdminLegalPage({ params }: PageProps<"/[locale]/admin/juridisk">) {
  const locale = await pageLocale(params);
  const actor = await requireStaffPage(locale);
  if (!can(actor, "legal.view").allow) notFound();
  const rows = await listLegalVersions(actor);
  const t = await getTranslations("adminPanel");
  const docs = [...new Set(rows.map((r) => r.docKey))];
  return (
    <div className="wrap py-10">
      <PageHeader title={t("legalTitle")} lead={t("legalLead")} />
      <AdminNav current="legal" />
      <div className="mb-6">
        <Notice tone="warning">{t("legalNotReviewed")}</Notice>
      </div>
      {rows.length === 0 && <p>{t("legalEmpty")}</p>}
      <div className="flex flex-col gap-4">
        {docs.map((doc) => (
          <section key={doc} className="card p-4" aria-labelledby={`doc-${doc}`}>
            <h2 id={`doc-${doc}`} className="mb-2 text-lg">
              {t(`doc.${doc}`)} <code className="text-sm font-normal">{doc}</code>
            </h2>
            <ul className="flex flex-col gap-2">
              {rows
                .filter((r) => r.docKey === doc)
                .map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="badge">{r.locale}</span>
                    <strong>{t("version", { version: r.version })}</strong>
                    {r.current && <span className="badge badge-warning">{t("current")}</span>}
                    {r.isDraft && <span className="badge">{t("draft")}</span>}
                    {r.isAuthoritative && <span className="badge">{t("authoritative")}</span>}
                    {r.materialChange && <span className="badge">{t("materialChange")}</span>}
                    <span className="text-muted">
                      {t("loaded", { date: formatDate(r.createdAt) })}
                      {r.effectiveAt ? ` · ${t("effective", { date: formatDate(r.effectiveAt) })}` : ""}
                    </span>
                    <code className="break-all text-xs" title={r.contentSha256}>
                      {r.contentSha256.slice(0, 16)}…
                    </code>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
