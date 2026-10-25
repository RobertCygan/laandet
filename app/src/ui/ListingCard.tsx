import { MapPin, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CategoryIcon } from "./Icon";
import { formatKr } from "@/i18n/format";
import type { ListingSummary } from "@/modules/listings/queries";

export async function ListingCard({ listing, locale }: { listing: ListingSummary; locale: "nb" | "en" }) {
  const t = await getTranslations("listing");
  const imageAlt = listing.imageAlt || listing.title;
  return (
    <article className="listing-card">
      <div className="listing-image">
        {listing.thumbId ? (
          // eslint-disable-next-line @next/next/no-img-element -- served by our authorised /media route
          <img src={`/media/${listing.thumbId}/thumb`} alt={imageAlt} loading="lazy" width={480} height={360} />
        ) : (
          <div className="flex h-full items-center justify-center bg-secondary text-primary/70">
            <CategoryIcon name={listing.categoryIcon} size={48} />
            <span className="visually-hidden">{t("noImage")}</span>
          </div>
        )}
        <div className="badges">
          {listing.isDemo && <span className="badge badge-demo">{t("demoBadge")}</span>}
          {listing.type === "wanted" && <span className="badge">{t("type.wanted")}</span>}
          {listing.type === "give_away" && <span className="badge badge-private">{t("type.give_away")}</span>}
          {listing.handoverOwnerDelivery && (
            <span className="badge badge-delivery">
              <Truck size={13} aria-hidden="true" />
              {t("canDeliver")}
            </span>
          )}
        </div>
      </div>
      <div className="listing-content">
        <span className="category-label">{listing.categoryLabels[locale]}</span>
        <h3>
          <Link href={`/annonse/${listing.id}`} className="after:absolute after:inset-0">
            {listing.title}
          </Link>
        </h3>
        <span className="listing-location">
          <MapPin size={14} aria-hidden="true" />
          {listing.localityName}, Steigen
        </span>
        <div className="listing-bottom">
          <span className="price">
            {listing.type === "rent_out" && listing.priceOre !== null && listing.priceOre > 0 && (
              <>
                <strong>{formatKr(listing.priceOre)}</strong>
                <span>/ {t(`unit.${listing.priceUnit ?? "day"}`)}</span>
              </>
            )}
            {listing.type === "rent_out" && listing.priceOre === 0 && <strong>{t("freeLoan")}</strong>}
            {listing.type === "give_away" && <strong>{t("free")}</strong>}
            {listing.type === "wanted" && (
              <span>{listing.budgetOre ? t("budget", { amount: formatKr(listing.budgetOre) }) : t("budgetOpen")}</span>
            )}
          </span>
        </div>
      </div>
    </article>
  );
}
