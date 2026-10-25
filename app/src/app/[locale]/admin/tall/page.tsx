import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { formatDateTime } from "@/i18n/format";
import { pageLocale } from "@/i18n/page";
import { getMetrics } from "@/modules/admin/metrics";
import { requireStaffPage } from "@/modules/auth/guards";
import { AdminNav } from "@/ui/admin/AdminNav";
import { PageHeader } from "@/ui/layout/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminPanel");
  return { title: t("metricsTitle"), robots: { index: false } };
}

const ACCOUNT = ["active", "restricted", "suspended", "deletion_pending", "deleted"] as const;
const LISTING = ["draft", "published", "paused", "reserved", "given_away", "archived", "removed", "deleted"] as const;
const BOOKING = [
  "requested",
  "accepted",
  "confirmed",
  "handed_over",
  "return_pending",
  "not_returned",
  "disputed",
  "completed",
  "declined",
  "withdrawn",
  "expired",
  "cancelled",
] as const;
const CLAIM = ["requested", "selected", "transferred", "declined", "withdrawn", "cancelled", "expired"] as const;
const DISPUTE = [
  "awaiting_response",
  "in_negotiation",
  "support_review",
  "awaiting_documentation",
  "resolved_by_agreement",
  "withdrawn",
  "closed_without_agreement",
  "referred_to_insurer",
  "referred_to_authority",
] as const;
const REPORT_TARGETS = ["listing", "user", "message", "review", "dispute"] as const;

/** Operations (P03-04, all staff): counts, the email outbox and the worker's heartbeats. No personal data. */
export default async function AdminMetricsPage({ params }: PageProps<"/[locale]/admin/tall">) {
  const locale = await pageLocale(params);
  const actor = await requireStaffPage(locale);
  const m = await getMetrics(actor);
  const t = await getTranslations("adminPanel");
  const tl = await getTranslations("listing");
  const ti = await getTranslations("inbox");

  const block = (id: string, title: string, items: { key: string; label: string; n: number }[]) => (
    <section className="card p-4" aria-labelledby={id}>
      <h2 id={id} className="mb-3 text-lg">
        {title}
      </h2>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        {items.map((i) => (
          <div key={i.key} className="contents">
            <dt>{i.label}</dt>
            <dd className="text-right font-bold tabular-nums">{i.n}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
  const pick = <K extends string>(keys: readonly K[], counts: Record<string, number>, label: (k: K) => string) =>
    keys.map((k) => ({ key: k, label: label(k), n: counts[k] ?? 0 }));
  const lateJobs = m.jobs.filter((j) => j.late || j.failing).length;

  return (
    <div className="wrap py-10">
      <PageHeader title={t("metricsTitle")} lead={t("metricsLead")} />
      <AdminNav current="metrics" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {block(
          "m-users",
          t("metricUsers"),
          pick(ACCOUNT, m.users, (k) => t(`accountStatus.${k}`)),
        )}
        {block(
          "m-listings",
          t("metricListings"),
          pick(LISTING, m.listings, (k) => tl(`status.${k}`)),
        )}
        {block(
          "m-bookings",
          t("metricBookings"),
          pick(BOOKING, m.bookings, (k) => ti(`bookingStatus.${k}`)),
        )}
        {block(
          "m-claims",
          t("metricClaims"),
          pick(CLAIM, m.claims, (k) => ti(`claimStatus.${k}`)),
        )}
        {block(
          "m-disputes",
          t("metricDisputes"),
          pick(DISPUTE, m.disputes, (k) => t(`disputeStatus.${k}`)),
        )}
        {block("m-moderation", t("metricModeration"), [
          ...pick(REPORT_TARGETS, m.openReports, (k) => t(`openReports.${k}`)),
          { key: "appeals", label: t("openAppeals"), n: m.openAppeals },
        ])}
        {block("m-outbox", t("metricOutbox"), [
          { key: "pending", label: t("outbox.pending"), n: m.outbox.pending },
          { key: "sending", label: t("outbox.sending"), n: m.outbox.sending },
          { key: "failed", label: t("outbox.failed"), n: m.outbox.failed },
          { key: "sent", label: t("outbox.sentLast7Days"), n: m.outbox.sentLast7Days },
        ])}
        {block("m-limits", t("metricRateLimits"), [
          { key: "auth", label: t("rateLimit.auth"), n: m.rateLimited["auth.rate_limited"] ?? 0 },
          { key: "abuse", label: t("rateLimit.abuse"), n: m.rateLimited["abuse.rate_limited"] ?? 0 },
        ])}
      </div>

      <section className="mt-8" aria-labelledby="m-jobs">
        <h2 id="m-jobs" className="mb-3 text-xl">
          {t("jobsTitle")}
        </h2>
        <p className="mb-3 text-sm">{lateJobs ? t("jobsAttention", { count: lateJobs }) : t("jobsOk")}</p>
        <ul className="flex flex-col gap-2">
          {m.jobs.map((j) => (
            <li
              key={j.name}
              className={`card flex flex-col gap-1 p-3 text-sm ${j.late || j.failing ? "border-l-4 border-l-danger" : ""}`}
            >
              <p className="flex flex-wrap items-center gap-2">
                <code className="font-bold">{j.name}</code>
                {j.failing && <span className="badge badge-danger">{t("jobFailing")}</span>}
                {j.late && <span className="badge badge-warning">{j.lastRunAt ? t("jobLate") : t("jobNeverRun")}</span>}
              </p>
              <p className="text-muted">
                {t("jobLastRun", { date: j.lastRunAt ? formatDateTime(j.lastRunAt, locale) : "–" })} ·{" "}
                {t("jobLastOk", { date: j.lastOkAt ? formatDateTime(j.lastOkAt, locale) : "–" })}
              </p>
              {j.lastError && <p className="break-all text-xs">{j.lastError}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
