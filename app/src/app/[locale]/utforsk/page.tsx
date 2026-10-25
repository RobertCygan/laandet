import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { parseKrToOre } from "@/i18n/format";
import { pageLocale, param } from "@/i18n/page";
import {
  listCategories,
  listLocalities,
  PAGE_SIZE,
  searchListings,
  type SearchFilters,
} from "@/modules/listings/queries";
import { PageHeader } from "@/ui/layout/PageHeader";
import { ListingCard } from "@/ui/ListingCard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("explore");
  return { title: t("title") };
}

const TYPES = ["rent_out", "wanted", "give_away"] as const;
const DELIVERY = ["pickup", "owner_delivery", "meet"] as const;
const SLUG = /^[a-z0-9-]{1,60}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type SP = Record<string, string | string[] | undefined>;

/** Search params → validated filters (anything unexpected is ignored). */
function parseFilters(sp: SP): SearchFilters {
  const str = (k: string) => param(sp[k])?.trim() || undefined;
  const kr = (k: string) => {
    const v = str(k);
    const ore = v ? parseKrToOre(v) : null;
    return ore === null ? undefined : ore;
  };
  const levering = ([] as string[]).concat(sp.levering ?? []);
  const page = Number(str("side"));
  return {
    q: str("q")?.slice(0, 100),
    type: TYPES.find((x) => x === str("type")),
    category: SLUG.test(str("kategori") ?? "") ? str("kategori") : undefined,
    locality: SLUG.test(str("sted") ?? "") ? str("sted") : undefined,
    minPriceOre: kr("min"),
    maxPriceOre: kr("maks"),
    delivery: DELIVERY.filter((d) => levering.includes(d)),
    from: DATE.test(str("fra") ?? "") ? str("fra") : undefined,
    to: DATE.test(str("til") ?? "") ? str("til") : undefined,
    sort: str("sortering") === "pris" ? "price" : "newest",
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 50) : 1,
  };
}

/** Query string with some params replaced (for tabs and pagination). */
function withParams(sp: SP, changes: Record<string, string | undefined>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(sp)) if (v !== undefined && v !== "") out[k] = v;
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined) delete out[k];
    else out[k] = v;
  }
  return out;
}

export default async function ExplorePage({ params, searchParams }: PageProps<"/[locale]/utforsk">) {
  const locale = await pageLocale(params);
  const sp = await searchParams;
  const f = parseFilters(sp);
  const [{ items, hasMore }, cats, locs] = await Promise.all([searchListings(f), listCategories(), listLocalities()]);
  const t = await getTranslations("explore");
  const tl = await getTranslations("listing");
  const tw = await getTranslations("wizard");
  const tc = await getTranslations("common");
  const page = f.page ?? 1;
  const hasFilters = Boolean(
    f.category ||
    f.locality ||
    f.minPriceOre !== undefined ||
    f.maxPriceOre !== undefined ||
    f.delivery?.length ||
    f.from ||
    f.to ||
    f.sort === "price",
  );
  const prefix = locale === "en" ? "/en" : "";
  const shown = (page - 1) * PAGE_SIZE + items.length;

  return (
    <div className="wrap py-10">
      <PageHeader title={t("title")} lead={t("lead")} />

      <nav aria-label={t("tabs")} className="mb-5 flex flex-wrap gap-2">
        {[undefined, ...TYPES].map((type) => (
          <Link
            key={type ?? "all"}
            href={{ pathname: "/utforsk", query: withParams(sp, { type, side: undefined }) }}
            className={`button button-sm ${f.type === type ? "button-primary" : "button-subtle"}`}
            aria-current={f.type === type ? "page" : undefined}
          >
            {type ? tl(`type.${type}`) : tc("all")}
          </Link>
        ))}
      </nav>

      <form action={`${prefix}/utforsk`} method="get" className="mb-8 flex flex-col gap-4">
        {f.type && <input type="hidden" name="type" value={f.type} />}
        <div className="card flex flex-col gap-3 p-3 md:flex-row md:items-end">
          <label className="field flex-1">
            {t("searchLabel")}
            <input name="q" type="search" defaultValue={f.q} maxLength={100} />
          </label>
          <button type="submit" className="button button-primary">
            <Search size={18} aria-hidden="true" />
            {t("search")}
          </button>
        </div>
        <details className="card p-4" open={hasFilters}>
          <summary className="cursor-pointer font-bold">{t("filters")}</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="field">
              {t("category")}
              <select name="kategori" defaultValue={f.category ?? ""}>
                <option value="">{t("allCategories")}</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.labels[locale]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              {t("area")}
              <select name="sted" defaultValue={f.locality ?? ""}>
                <option value="">{tc("steigen")}</option>
                {locs.map((l) => (
                  <option key={l.id} value={l.slug}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="flex gap-2 border-0 p-0">
              <legend className="mb-1.5 text-sm font-bold">{t("price")}</legend>
              <label className="field flex-1">
                <span className="visually-hidden">{t("price")}</span>
                {t("minPrice")}
                <input name="min" inputMode="numeric" defaultValue={param(sp.min)} />
              </label>
              <label className="field flex-1">
                <span className="visually-hidden">{t("price")}</span>
                {t("maxPrice")}
                <input name="maks" inputMode="numeric" defaultValue={param(sp.maks)} />
              </label>
            </fieldset>
            <label className="field">
              {t("sort")}
              <select name="sortering" defaultValue={f.sort === "price" ? "pris" : "nyeste"}>
                <option value="nyeste">{t("sortNewest")}</option>
                <option value="pris">{t("sortPrice")}</option>
              </select>
            </label>
            <fieldset className="flex flex-col gap-2 border-0 p-0">
              <legend className="mb-1.5 text-sm font-bold">{t("delivery")}</legend>
              {(
                [
                  ["pickup", tw("pickupOption")],
                  ["owner_delivery", tw("deliveryOption")],
                  ["meet", tw("meetOption")],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="check">
                  <input type="checkbox" name="levering" value={value} defaultChecked={f.delivery?.includes(value)} />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="flex gap-2 border-0 p-0 lg:col-span-2">
              <legend className="mb-1.5 text-sm font-bold">{t("available")}</legend>
              <label className="field flex-1">
                {t("from")}
                <input type="date" name="fra" defaultValue={f.from} />
              </label>
              <label className="field flex-1">
                {t("to")}
                <input type="date" name="til" defaultValue={f.to} />
              </label>
            </fieldset>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="submit" className="button button-primary">
              {t("applyFilters")}
            </button>
            <Link
              href={{ pathname: "/utforsk", query: f.type ? { type: f.type } : {} }}
              className="button button-subtle"
            >
              {t("reset")}
            </Link>
          </div>
        </details>
      </form>

      <p className="mb-4 font-bold" role="status">
        {hasMore ? t("resultsMore", { count: shown }) : t("results", { count: shown })}
      </p>
      {items.length === 0 ? (
        <div className="card flex flex-col items-start gap-4 p-6">
          <p>{t("noResults")}</p>
          <Link href={{ pathname: "/ny-annonse", query: { type: "wanted" } }} className="button button-primary">
            {t("postWanted")}
          </Link>
        </div>
      ) : (
        <div className="listing-grid">
          {items.map((l) => (
            <ListingCard key={l.id} listing={l} locale={locale} />
          ))}
        </div>
      )}

      {(page > 1 || hasMore) && (
        <nav className="mt-8 flex justify-between gap-3" aria-label={t("results", { count: shown })}>
          {page > 1 ? (
            <Link
              href={{ pathname: "/utforsk", query: withParams(sp, { side: page > 2 ? String(page - 1) : undefined }) }}
              className="button button-subtle"
              rel="prev"
            >
              {tc("previous")}
            </Link>
          ) : (
            <span />
          )}
          {hasMore && (
            <Link
              href={{ pathname: "/utforsk", query: withParams(sp, { side: String(page + 1) }) }}
              className="button button-subtle"
              rel="next"
            >
              {tc("next")}
            </Link>
          )}
        </nav>
      )}

      <p className="fine-print mt-10">
        <Link href={{ pathname: "/vilkar", hash: "rangering" }} className="text-link">
          {t("ranking")}
        </Link>
      </p>
    </div>
  );
}
