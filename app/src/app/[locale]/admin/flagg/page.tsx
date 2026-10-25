import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { formatDateTime } from "@/i18n/format";
import { pageLocale, param } from "@/i18n/page";
import { listFlags } from "@/modules/admin/settings";
import { requireStaffPage } from "@/modules/auth/guards";
import { can } from "@/modules/authz/policy";
import { AdminNav } from "@/ui/admin/AdminNav";
import { FlagForm } from "@/ui/admin/PanelForms";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminPanel");
  return { title: t("flagsTitle"), robots: { index: false } };
}

/** Feature flags (P03-04, admin): each switch takes a reason and is audited. */
export default async function AdminFlagsPage({ params, searchParams }: PageProps<"/[locale]/admin/flagg">) {
  const locale = await pageLocale(params);
  const actor = await requireStaffPage(locale);
  if (!can(actor, "flag.manage").allow) notFound();
  const saved = param((await searchParams).lagret) === "1";
  const flags = await listFlags(actor);
  const t = await getTranslations("adminPanel");
  return (
    <div className="wrap py-10">
      <PageHeader title={t("flagsTitle")} lead={t("flagsLead")} />
      <AdminNav current="flags" />
      {saved && (
        <div className="mb-6">
          <Notice tone="success" role="status">
            {t("saved")}
          </Notice>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {flags.map((f) => (
          <li key={f.key} className="card flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg">{t(`flag.${f.key}`)}</h2>
              <code className="text-sm">{f.key}</code>
              <span className={`badge ${f.enabled ? "badge-warning" : ""}`}>{f.enabled ? t("on") : t("off")}</span>
            </div>
            <p className="text-sm text-muted">
              {f.isDefault
                ? t("flagDefault")
                : t("flagChanged", {
                    date: f.updatedAt ? formatDateTime(f.updatedAt, locale) : "–",
                    name: f.updatedByName ?? t("flagChangedBySystem"),
                  })}
            </p>
            {(f.key === "extended_agreements" || f.key === "high_value_preview") && (
              <Notice tone="warning">{t("flagHighValueWarning")}</Notice>
            )}
            <details>
              <summary className="cursor-pointer font-bold">{f.enabled ? t("turnOff") : t("turnOn")}</summary>
              <div className="mt-3">
                <FlagForm flagKey={f.key} enabled={f.enabled} locale={locale} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
