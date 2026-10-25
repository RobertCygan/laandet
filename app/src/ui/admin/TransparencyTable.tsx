import { getTranslations } from "next-intl/server";
import { formatKr, formatMonthYear } from "@/i18n/format";
import type { TransparencyMonth } from "@/modules/admin/transparency";

/** "2026-12-01" → «desember 2026» / «December 2026». */
export function monthLabel(month: string, locale: "nb" | "en"): string {
  return formatMonthYear(new Date(`${month.slice(0, 10)}T12:00:00Z`), locale);
}

const PARTS = [
  ["costServerOre", "costServer"],
  ["costBackupOre", "costBackup"],
  ["costEmailOre", "costEmail"],
  ["costDomainOre", "costDomain"],
  ["costOtherOre", "costOther"],
] as const;

/** The owner's real monthly figures, newest first. Only what was entered; a missing split is not guessed. */
export async function TransparencyMonths({ rows, locale }: { rows: TransparencyMonth[]; locale: "nb" | "en" }) {
  const t = await getTranslations("transparency");
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.month} className="card p-4">
          <h3 className="mb-2 text-lg">{monthLabel(r.month, locale)}</h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
            <dt className="font-bold">{t("costTotal")}</dt>
            <dd className="text-right font-bold tabular-nums">{formatKr(r.costTotalOre)}</dd>
            {PARTS.filter(([col]) => r[col] !== null).map(([col, key]) => (
              <div key={col} className="contents">
                <dt className="pl-4 text-sm">{t(`part.${key}`)}</dt>
                <dd className="text-right text-sm tabular-nums">{formatKr(r[col]!)}</dd>
              </div>
            ))}
            <dt className="font-bold">{t("supportReceived")}</dt>
            <dd className="text-right tabular-nums">
              {r.supportReceivedOre === null ? t("noSupportYet") : formatKr(r.supportReceivedOre)}
            </dd>
          </dl>
          {r.note && <p className="mt-2 whitespace-pre-line text-sm">{r.note}</p>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Estimates from docs/OPERATING_COSTS.md §4 (Variant A, incl. 25 % VAT), shown only in their own labelled
 * section and never mixed with the actual figures above.
 */
const ESTIMATES = [
  { users: 100, ore: 17_000 },
  { users: 500, ore: 17_500 },
  { users: 2_000, ore: 25_000 },
  { users: 10_000, ore: 72_000, highOre: 109_000 },
] as const;
const VARIANT_B = { lowOre: 41_000, highOre: 49_000 };

export async function CostEstimates() {
  const t = await getTranslations("transparency");
  const users = (n: number) => new Intl.NumberFormat("nb-NO").format(n).replace(/\s/g, " ");
  return (
    <section className="card flex flex-col gap-3 p-6" aria-labelledby="estimates">
      <h2 id="estimates" className="text-xl">
        {t("estimatesTitle")}
      </h2>
      <p>{t("estimatesLead")}</p>
      <ul className="flex list-disc flex-col gap-1 pl-6">
        {ESTIMATES.map((e) => (
          <li key={e.users}>
            {"highOre" in e
              ? t("estimateRange", { users: users(e.users), low: formatKr(e.ore), high: formatKr(e.highOre) })
              : t("estimate", { users: users(e.users), amount: formatKr(e.ore) })}
          </li>
        ))}
      </ul>
      <p className="text-sm">
        {t("estimatesVariantB", { low: formatKr(VARIANT_B.lowOre), high: formatKr(VARIANT_B.highOre) })}
      </p>
      <p className="fine-print">{t("estimatesNote")}</p>
    </section>
  );
}
