import { ArrowRight, Search } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";
import { flagEnabled } from "@/modules/flags/flags";
import { latestListings, listCategories, listLocalities } from "@/modules/listings/queries";
import { CategoryIcon } from "@/ui/Icon";
import { ListingCard } from "@/ui/ListingCard";
import { Notice } from "@/ui/Notice";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : "nb";
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const [rent, wanted, give, cats, locs, rentalsOpen] = await Promise.all([
    latestListings("rent_out", 8),
    latestListings("wanted", 4),
    latestListings("give_away", 4),
    listCategories(),
    listLocalities(),
    flagEnabled("rentals_open"),
  ]);
  const anyDemo = [...rent, ...wanted, ...give].some((l) => l.isDemo);
  const prefix = locale === "en" ? "/en" : "";

  return (
    <>
      <section className="wrap grid items-center gap-8 pt-10 pb-8 lg:grid-cols-2">
        <div>
          <p className="pill mb-5 uppercase tracking-wider">{t("eyebrow")}</p>
          <h1 className="text-[clamp(34px,5vw,56px)] leading-[1.15] tracking-tight">
            {t("titleLine1")}
            <br />
            <span className="text-primary">{t("titleLine2")}</span>
          </h1>
          <p className="mt-5 max-w-xl text-base">{t("lead")}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/utforsk" className="button button-primary">
              {t("ctaFind")}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/ny-annonse" className="button button-subtle">
              {t("ctaOffer")}
            </Link>
          </div>
        </div>
        <figure className="relative m-0 overflow-hidden rounded-[12px_70px_12px_12px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- static illustration, fixed size */}
          <img src="/images/hero.webp" alt={t("heroAlt")} width={1200} height={950} className="h-auto w-full object-cover" />
          <figcaption className="absolute right-3 bottom-2 rounded bg-black/45 px-2 py-0.5 text-xs text-white">
            {t("heroCaption")}
          </figcaption>
        </figure>
      </section>

      <section className="wrap pb-6" aria-label={t("searchLabel")}>
        <form action={`${prefix}/utforsk`} method="get" className="card flex flex-col gap-3 p-3 md:flex-row md:items-end">
          <label className="field flex-1">
            {t("searchLabel")}
            <input name="q" type="search" placeholder={t("searchPlaceholder")} maxLength={100} />
          </label>
          <label className="field md:w-64">
            {t("areaLabel")}
            <select name="sted" defaultValue="">
              <option value="">{t("allSteigen")}</option>
              {locs.map((l) => (
                <option key={l.id} value={l.slug}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="button button-primary">
            <Search size={18} aria-hidden="true" />
            {t("searchButton")}
          </button>
        </form>
        {!rentalsOpen && (
          <div className="mt-4">
            <Notice tone="info">{t("rentalsSoon")}</Notice>
          </div>
        )}
      </section>

      <Section title={t("rentHeading")} href={{ pathname: "/utforsk", query: { type: "rent_out" } }} linkLabel={t("seeAll")}>
        {rent.length ? (
          <div className="listing-grid">
            {rent.map((l) => (
              <ListingCard key={l.id} listing={l} locale={locale} />
            ))}
          </div>
        ) : (
          <p>{t("emptyRent")}</p>
        )}
      </Section>

      <section className="bg-surface py-12">
        <div className="wrap">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2>{t("categoriesHeading")}</h2>
            <Link href="/kategorier" className="text-link">
              {t("allCategories")} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="category-grid">
            {cats
              .filter((c) => !c.parentId)
              .slice(0, 6)
              .map((c) => (
                <Link key={c.id} href={{ pathname: "/utforsk", query: { kategori: c.slug } }} className="category-card">
                  <span className="category-icon">
                    <CategoryIcon name={c.icon} />
                  </span>
                  {c.labels[locale]}
                </Link>
              ))}
          </div>
        </div>
      </section>

      {wanted.length > 0 && (
        <Section title={t("wantedHeading")} href={{ pathname: "/utforsk", query: { type: "wanted" } }} linkLabel={t("seeAll")}>
          <div className="listing-grid">
            {wanted.map((l) => (
              <ListingCard key={l.id} listing={l} locale={locale} />
            ))}
          </div>
        </Section>
      )}

      {give.length > 0 && (
        <Section title={t("giveHeading")} href={{ pathname: "/utforsk", query: { type: "give_away" } }} linkLabel={t("seeAll")}>
          <div className="listing-grid">
            {give.map((l) => (
              <ListingCard key={l.id} listing={l} locale={locale} />
            ))}
          </div>
        </Section>
      )}

      <section className="wrap section">
        <h2 className="mb-6">{t("howHeading")}</h2>
        <ol className="grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {[t("howStep1"), t("howStep2"), t("howStep3"), t("howStep4")].map((s, i) => (
            <li key={i} className="card p-5">
              <span className="text-sm font-extrabold text-primary">0{i + 1}</span>
              <p className="mt-2 text-text">{s}</p>
            </li>
          ))}
        </ol>
        {anyDemo && <p className="fine-print mt-6">{t("examplesNote")}</p>}
      </section>
    </>
  );
}

function Section({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: { pathname: "/utforsk"; query: Record<string, string> };
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="wrap section">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2>{title}</h2>
        <Link href={href} className="text-link">
          {linkLabel} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {children}
    </section>
  );
}
