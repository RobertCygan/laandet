import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { formatDateTime } from "@/i18n/format";
import { pageLocale, param } from "@/i18n/page";
import { AUDIT_LIMIT, listAuditEvents } from "@/modules/admin/settings";
import { requireStaffPage } from "@/modules/auth/guards";
import { can } from "@/modules/authz/policy";
import { AdminNav } from "@/ui/admin/AdminNav";
import { PageHeader } from "@/ui/layout/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminPanel");
  return { title: t("securityTitle"), robots: { index: false } };
}

const PREFIXES = ["auth.", "staff.", "moderation.", "flag.", "category.", "locality.", "transparency.", "user."];

/** Security log (P03-04, admin, read-only): newest audit events, filtered by action prefix. */
export default async function AdminSecurityPage({ params, searchParams }: PageProps<"/[locale]/admin/sikkerhet">) {
  const locale = await pageLocale(params);
  const actor = await requireStaffPage(locale);
  if (!can(actor, "audit.view").allow) notFound();
  const prefix = param((await searchParams).handling)?.trim() || undefined;
  const events = await listAuditEvents(actor, { prefix });
  const t = await getTranslations("adminPanel");
  return (
    <div className="wrap py-10">
      <PageHeader title={t("securityTitle")} lead={t("securityLead", { limit: AUDIT_LIMIT })} />
      <AdminNav current="security" />
      <form method="get" className="mb-6 flex flex-wrap items-end gap-2">
        <label className="field">
          {t("actionPrefix")}
          <input name="handling" list="audit-prefixes" defaultValue={prefix ?? ""} maxLength={40} />
          <datalist id="audit-prefixes">
            {PREFIXES.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <button type="submit" className="button button-outline button-sm">
          {t("filter")}
        </button>
      </form>
      {events.length === 0 ? (
        <p>{t("noEvents")}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {events.map((e) => (
            <li key={e.id} className="card flex flex-col gap-1 p-3 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <code className="font-bold">{e.action}</code>
                <span className="text-muted">{formatDateTime(e.occurredAt, locale)}</span>
              </p>
              <p>
                {t("actor")}: {e.actorId ? `${e.actorName ?? t("unknownUser")} (${e.actorRole ?? "–"})` : t("noActor")}
                {e.targetType
                  ? ` · ${t("target")}: ${e.targetType}${e.targetId ? ` ${e.targetId.slice(0, 8)}` : ""}`
                  : ""}
              </p>
              {e.reason && (
                <p className="whitespace-pre-line">
                  {t("reason")}: {e.reason}
                </p>
              )}
              {Object.keys(e.metadata).length > 0 && (
                <p className="break-all text-xs text-muted">{JSON.stringify(e.metadata).slice(0, 300)}</p>
              )}
              <p className="text-xs text-muted">
                {e.ipHash ? `${t("ipHash")}: ${e.ipHash.slice(0, 12)}…` : t("noIp")}
                {e.requestId ? ` · ${t("requestId")}: ${e.requestId}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
