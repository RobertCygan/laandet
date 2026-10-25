import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Bookmark, BookmarkCheck, MapPin, Truck, Users, Package } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatIsoDate, formatKr, formatMonthYear } from "@/i18n/format";
import { pageLocale, param } from "@/i18n/page";
import { getActor } from "@/modules/auth/actor";
import { flagEnabled } from "@/modules/flags/flags";
import { toggleSaveAction } from "@/modules/listings/actions";
import { getListingForViewer, isSaved } from "@/modules/listings/queries";
import { classifyValue } from "@/modules/listings/rules";
import { latestDecisionForOwnListing } from "@/modules/moderation/service";
import { CategoryIcon } from "@/ui/Icon";
import { ReportForm } from "@/ui/listings/ListingActions";
import { ReportSignedOut } from "@/ui/listings/ReportSignedOut";
import { SaveWarnings } from "@/ui/listings/SaveWarnings";
import { ContactOwnerButton } from "@/ui/messaging/ContactOwnerButton";
import { Notice } from "@/ui/Notice";

export async function generateMetadata({ params }: PageProps<"/[locale]/annonse/[id]">): Promise<Metadata> {
  const { id } = await params;
  const d = await getListingForViewer(await getActor(), id);
  if (!d) return {};
  return {
    title: d.listing.title,
    robots: d.listing.isDemo || d.listing.status !== "published" ? { index: false } : undefined,
  };
}

export default async function ListingPage({ params, searchParams }: PageProps<"/[locale]/annonse/[id]">) {
  const locale = await pageLocale(params);
  const { id } = await params;
  const sp = await searchParams;
  const actor = await getActor();
  const d = await getListingForViewer(actor, id);
  if (!d) notFound();
  const l = d.listing;
  const isOwner = actor.kind === "user" && actor.id === l.ownerId;
  const [saved, rentalsOpen, decisionId] = await Promise.all([
    isSaved(actor, l.id),
    flagEnabled("rentals_open"),
    isOwner && l.status === "removed" ? latestDecisionForOwnListing(actor, l.id) : Promise.resolve(null),
  ]);
  const t = await getTranslations("detail");
  const tl = await getTranslations("listing");
  const tw = await getTranslations("wizard");
  const tc = await getTranslations("common");
  const lagret = param(sp.lagret);
  const unit = tl(`unit.${l.priceUnit ?? "day"}`);
  const highValue =
    l.type === "rent_out" && l.declaredValueOre !== null && classifyValue(Number(l.declaredValueOre)) === "B";
  const [main, ...rest] = d.images;

  return (
    <div className="wrap py-8">
      <Link href="/utforsk" className="text-link mb-6 inline-flex items-center gap-1.5">
        <ArrowLeft size={16} aria-hidden="true" />
        {t("back")}
      </Link>

      <div className="mb-6 flex flex-col gap-3">
        {lagret && lagret in { saved: 1, published: 1, updated: 1 } && (
          <Notice tone="success" role="status">
            {tw(lagret as "saved" | "published" | "updated")}
          </Notice>
        )}
        <SaveWarnings value={param(sp.advarsel)} />
        {l.isDemo && <Notice tone="warning">{t("demoNotice")}</Notice>}
        {l.status === "removed" && isOwner && (
          <Notice tone="danger">
            <p>{t("removedNotice")}</p>
            {decisionId && (
              <Link href={`/moderering/${decisionId}`} className="text-link">
                {t("seeDecision")}
              </Link>
            )}
          </Notice>
        )}
        {l.status !== "published" && l.status !== "removed" && (
          <Notice>{t("notPublished", { status: tl(`status.${l.status}`) })}</Notice>
        )}
        {isOwner && (
          <Notice>
            <p>
              {t("ownerView")}{" "}
              {l.status !== "removed" && !l.isDemo && (
                <Link href={`/annonse/${l.id}/rediger`} className="text-link">
                  {tc("edit")}
                </Link>
              )}
            </p>
          </Notice>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <section aria-label={t("images")}>
            {main ? (
              <a
                href={`/media/${main.mediaId}/display`}
                target="_blank"
                rel="noopener"
                aria-label={t("openImage", { n: 1 })}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- authorised media route */}
                <img
                  src={`/media/${main.mediaId}/display`}
                  alt={main.altText || l.title}
                  width={1600}
                  height={1200}
                  className="aspect-[4/3] w-full rounded-xl object-cover"
                />
              </a>
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-secondary text-primary/70">
                <CategoryIcon name="package" size={72} />
                <span className="visually-hidden">{tl("noImage")}</span>
              </div>
            )}
            {rest.length > 0 && (
              <ul className="mt-3 grid grid-cols-4 gap-2">
                {rest.map((img, i) => (
                  <li key={img.mediaId}>
                    <a
                      href={`/media/${img.mediaId}/display`}
                      target="_blank"
                      rel="noopener"
                      aria-label={t("openImage", { n: i + 2 })}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- authorised media route */}
                      <img
                        src={`/media/${img.mediaId}/thumb`}
                        alt={img.altText || ""}
                        width={480}
                        height={360}
                        className="aspect-[4/3] w-full rounded-md object-cover"
                        loading="lazy"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-xl">{t("aboutItem")}</h2>
            <p className="whitespace-pre-line">{l.description}</p>
            {l.type !== "wanted" && l.itemCondition && (
              <p>
                <strong>{t("condition")}:</strong> {tl(`condition.${l.itemCondition}`)}
              </p>
            )}
            {l.knownDefects && (
              <div>
                <h3 className="text-base">{t("knownDefects")}</h3>
                <p className="whitespace-pre-line">{l.knownDefects}</p>
              </div>
            )}
            {l.includedAccessories.length > 0 && (
              <div>
                <h3 className="text-base">{t("included")}</h3>
                <ul className="list-disc pl-6">
                  {l.includedAccessories.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            {l.usageRestrictions && (
              <div>
                <h3 className="text-base">{t("usage")}</h3>
                <p className="whitespace-pre-line">{l.usageRestrictions}</p>
              </div>
            )}
            {l.operatingInstructions && (
              <div>
                <h3 className="text-base">{t("instructions")}</h3>
                <p className="whitespace-pre-line">{l.operatingInstructions}</p>
              </div>
            )}
            {d.category.policy === "restricted" && d.category.safetyNotice && (
              <Notice tone="warning">
                <p className="font-bold">{t("safety")}</p>
                <p>{d.category.safetyNotice[locale]}</p>
              </Notice>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-5">
          <div className="card flex flex-col gap-4 p-6">
            <div className="flex flex-wrap gap-2">
              {l.isDemo && <span className="badge badge-demo">{tl("demoBadge")}</span>}
              <span className="badge">{tl(`type.${l.type}`)}</span>
              <span className="badge badge-private">{tl("privateBadge")}</span>
            </div>
            <p className="category-label">{d.category.labels[locale]}</p>
            <h1 className="text-[clamp(26px,3.5vw,36px)] leading-tight">{l.title}</h1>
            <p className="listing-location">
              <MapPin size={16} aria-hidden="true" />
              {d.locality.name}, Steigen
              {l.areaNote ? ` · ${l.areaNote}` : ""} ({tl("approxArea")})
            </p>

            {l.type === "rent_out" && (
              <div className="flex flex-col gap-1">
                <p className="price text-2xl">
                  {l.priceOre === 0 ? (
                    <strong>{tl("freeLoan")}</strong>
                  ) : (
                    <>
                      <strong>{formatKr(l.priceOre ?? 0)}</strong> <span>{t("perUnit", { unit })}</span>
                    </>
                  )}
                </p>
                <p>
                  {t("deposit")}: {l.depositOre ? formatKr(l.depositOre) : t("noDeposit")}
                </p>
                {l.depositOre ? <p className="fine-print">{t("depositNote")}</p> : null}
              </div>
            )}
            {l.type === "give_away" && (
              <p className="price text-2xl">
                <strong>{tl("free")}</strong>
              </p>
            )}
            {l.type === "wanted" && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="font-bold">{t("wantedPeriod")}</dt>
                <dd>
                  {l.wantedFrom || l.wantedTo
                    ? `${l.wantedFrom ? formatIsoDate(l.wantedFrom) : "…"} – ${l.wantedTo ? formatIsoDate(l.wantedTo) : "…"}`
                    : t("flexible")}
                </dd>
                <dt className="font-bold">{t("wantedBudget")}</dt>
                <dd>{l.budgetOre ? formatKr(l.budgetOre) : tl("budgetOpen")}</dd>
              </dl>
            )}

            <div>
              <h2 className="mb-2 text-base">{t("handover")}</h2>
              <ul className="flex flex-col gap-1.5">
                {l.handoverPickup && (
                  <li className="flex items-center gap-2">
                    <Package size={16} aria-hidden="true" />
                    {t("pickup")}
                  </li>
                )}
                {l.handoverOwnerDelivery && (
                  <li className="flex items-center gap-2">
                    <Truck size={16} aria-hidden="true" />
                    {t("ownerDelivery")}
                    {l.deliveryFeeOre ? `, ${t("deliveryFee", { amount: formatKr(l.deliveryFeeOre) })}` : ""}
                    {l.deliveryRadiusKm ? `, ${t("deliveryRadius", { km: l.deliveryRadiusKm })}` : ""}
                  </li>
                )}
                {l.handoverMeet && (
                  <li className="flex items-center gap-2">
                    <Users size={16} aria-hidden="true" />
                    {t("meet")}
                    {l.meetingAreaNote ? ` (${l.meetingAreaNote})` : ""}
                  </li>
                )}
              </ul>
              <p className="fine-print mt-2">{t("exactPlaceNote")}</p>
            </div>

            {l.type === "rent_out" && highValue && <Notice tone="warning">{t("highValueNotice")}</Notice>}
            {l.type === "rent_out" && !d.category.allowPaidRental && <Notice>{t("freeLoanNotice")}</Notice>}
            {!l.isDemo && !isOwner && l.status === "published" && (
              <div className="flex flex-col gap-2">
                {l.type === "rent_out" && !rentalsOpen && (
                  <button
                    type="button"
                    className="button button-primary w-full"
                    disabled
                    aria-describedby="request-soon"
                  >
                    {t("sendRequest")}
                  </button>
                )}
                <Notice>
                  <div id="request-soon">
                    {l.type === "rent_out" && !rentalsOpen ? (
                      <>
                        <p className="font-bold">{t("requestSoon")}</p>
                        <p>{t("requestSoonText")}</p>
                      </>
                    ) : (
                      <p>{t("contactSoon")}</p>
                    )}
                  </div>
                </Notice>
              </div>
            )}

            {!isOwner && l.status === "published" && (
              <form action={toggleSaveAction}>
                <input type="hidden" name="listingId" value={l.id} />
                <input type="hidden" name="locale" value={locale} />
                <button
                  type="submit"
                  className={`button w-full ${saved ? "button-subtle" : "button-outline"}`}
                  aria-pressed={saved}
                >
                  {saved ? <BookmarkCheck size={18} aria-hidden="true" /> : <Bookmark size={18} aria-hidden="true" />}
                  {saved ? t("saved") : t("save")}
                </button>
              </form>
            )}
            <ContactOwnerButton
              listingId={l.id}
              ownerId={l.ownerId}
              listingType={l.type}
              available={l.status === "published" && !l.isDemo}
              locale={locale}
            />
          </div>

          <div className="card flex flex-col gap-2 p-6">
            <h2 className="text-base">{t("owner")}</h2>
            <Link href={`/profil/${d.owner.id}`} className="text-link text-lg">
              {d.owner.name}
            </Link>
            <p className="text-sm text-muted">
              {t("memberSince", { date: formatMonthYear(d.owner.createdAt, locale) })}
            </p>
            <p className="fine-print">{t("privateNote")}</p>
          </div>

          <Notice tone="warning">{t("paymentWarning")}</Notice>

          {!isOwner && (
            <details className="card p-6">
              <summary className="cursor-pointer font-bold">{t("report")}</summary>
              <div className="mt-4">
                {actor.kind === "user" ? (
                  <ReportForm targetType="listing" targetId={l.id} />
                ) : (
                  <ReportSignedOut returnTo={`${locale === "en" ? "/en" : ""}/annonse/${l.id}`} />
                )}
              </div>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}
