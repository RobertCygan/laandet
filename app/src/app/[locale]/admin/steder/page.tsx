import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { pageLocale, param } from "@/i18n/page";
import { listLocalitiesForAdmin } from "@/modules/admin/catalog";
import { requireStaffPage } from "@/modules/auth/guards";
import { can } from "@/modules/authz/policy";
import { AdminNav } from "@/ui/admin/AdminNav";
import { CreateLocalityForm, LocalityForm } from "@/ui/admin/PanelForms";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminPanel");
  return { title: t("localitiesTitle"), robots: { index: false } };
}

/** Localities (P03-04, admin): add, rename, reorder, deactivate. Slugs never change. */
export default async function AdminLocalitiesPage({ params, searchParams }: PageProps<"/[locale]/admin/steder">) {
  const locale = await pageLocale(params);
  const actor = await requireStaffPage(locale);
  if (!can(actor, "locality.manage").allow) notFound();
  const saved = param((await searchParams).lagret) === "1";
  const rows = await listLocalitiesForAdmin(actor);
  const t = await getTranslations("adminPanel");
  return (
    <div className="wrap py-10">
      <PageHeader title={t("localitiesTitle")} lead={t("localitiesLead")} />
      <AdminNav current="localities" />
      {saved && (
        <div className="mb-6">
          <Notice tone="success" role="status">
            {t("saved")}
          </Notice>
        </div>
      )}
      <ul className="mb-8 flex flex-col gap-3">
        {rows.map((l) => (
          <li key={l.id} className="card flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg">{l.name}</h2>
              <span className="text-sm text-muted">
                {l.slug} · {l.municipality}
              </span>
              {!l.active && <span className="badge">{t("inactive")}</span>}
            </div>
            <details>
              <summary className="cursor-pointer font-bold">{t("edit")}</summary>
              <div className="mt-3">
                <LocalityForm locale={locale} l={l} />
              </div>
            </details>
          </li>
        ))}
      </ul>
      <section className="card flex flex-col gap-3 p-6" aria-labelledby="new-locality">
        <h2 id="new-locality" className="text-xl">
          {t("addLocality")}
        </h2>
        <CreateLocalityForm locale={locale} />
      </section>
    </div>
  );
}
