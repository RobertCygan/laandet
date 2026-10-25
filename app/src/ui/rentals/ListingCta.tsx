import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { PriceUnit } from "@/db/schema";
import { formatDate } from "@/i18n/format";
import type { Actor } from "@/modules/authz/actor-types";
import { claimStepAction } from "@/modules/giveaways/actions";
import { listClaimsForGiver, myClaimOn, myOpenBookingOn } from "@/modules/rentals/queries";
import { Notice } from "@/ui/Notice";
import { ClaimForm } from "./ClaimForms";
import { RequestForm, StepForm } from "./RentalForms";

type Method = "pickup" | "owner_delivery" | "meet";
export type CtaListing = {
  id: string;
  type: "rent_out" | "wanted" | "give_away";
  priceOre: number | null;
  priceUnit: PriceUnit | null;
  depositOre: number | null;
  methods: Method[];
};

/**
 * The request or claim step on a listing page (P02-02, P02-03), for someone who is not the owner.
 * Rental requests only while `rentals_open` is on; a high-value listing is never requestable.
 */
export async function ListingCta({
  actor,
  listing: l,
  locale,
  rentalsOpen,
  requestable,
}: {
  actor: Actor;
  listing: CtaListing;
  locale: "nb" | "en";
  rentalsOpen: boolean;
  requestable: boolean;
}) {
  const t = await getTranslations("detail");
  const tr = await getTranslations("rentals");
  const tg = await getTranslations("claims");
  const ti = await getTranslations("inbox");
  const returnTo = `${locale === "en" ? "/en" : ""}/annonse/${l.id}`;
  const signIn = (label: string) => (
    <Link href={{ pathname: "/logg-inn", query: { neste: returnTo } }} className="button button-primary w-full">
      {label}
    </Link>
  );

  if (l.type === "rent_out") {
    if (!rentalsOpen) {
      return (
        <div className="flex flex-col gap-2">
          <button type="button" className="button button-primary w-full" disabled aria-describedby="request-soon">
            {t("sendRequest")}
          </button>
          <Notice>
            <div id="request-soon">
              <p className="font-bold">{t("requestSoon")}</p>
              <p>{t("requestSoonText")}</p>
            </div>
          </Notice>
        </div>
      );
    }
    if (!requestable || l.priceOre === null || !l.priceUnit) return null;
    if (actor.kind !== "user") return signIn(tr("signInToRequest"));
    const open = await myOpenBookingOn(actor, l.id);
    if (open) {
      return (
        <Link href={`/leieforhold/${open.id}`} className="button button-primary w-full">
          {tr("seeYourRequest", { status: ti(`bookingStatus.${open.status}`) })}
        </Link>
      );
    }
    return (
      <details className="rounded-lg border border-border p-4" open>
        <summary className="cursor-pointer font-bold">{t("sendRequest")}</summary>
        <div className="mt-4">
          <RequestForm
            listingId={l.id}
            locale={locale}
            priceOre={l.priceOre}
            priceUnit={l.priceUnit}
            depositOre={l.depositOre ?? 0}
            methods={l.methods}
          />
        </div>
      </details>
    );
  }

  if (l.type === "give_away") {
    if (actor.kind !== "user") return signIn(tg("signInToClaim"));
    const mine = await myClaimOn(actor, l.id);
    if (mine) {
      return (
        <Link href={`/overlevering/${mine.id}`} className="button button-primary w-full">
          {tg("seeYourClaim", { status: ti(`claimStatus.${mine.status}`) })}
        </Link>
      );
    }
    return (
      <details className="rounded-lg border border-border p-4" open>
        <summary className="cursor-pointer font-bold">{tg("claim")}</summary>
        <div className="mt-4">
          <ClaimForm listingId={l.id} locale={locale} methods={l.methods} />
        </div>
      </details>
    );
  }
  return null;
}

/** The giver's list of claims on their own «Gis bort» listing, with «Velg» and «Avslå». */
export async function GiverClaims({
  actor,
  listingId,
  locale,
}: {
  actor: Actor;
  listingId: string;
  locale: "nb" | "en";
}) {
  const claims = await listClaimsForGiver(actor, listingId);
  const t = await getTranslations("claims");
  const ti = await getTranslations("inbox");
  const tr = await getTranslations("rentals");
  const selected = claims.some((c) => c.status === "selected" || c.status === "transferred");
  return (
    <section className="card flex flex-col gap-3 p-6" aria-labelledby="claims">
      <h2 id="claims" className="text-xl">
        {t("giverTitle")}
      </h2>
      {claims.length === 0 ? (
        <p>{t("giverEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {claims.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 border-b border-border pb-3 last:border-0">
              <p>
                <strong>{c.name}</strong> · {formatDate(c.createdAt)} · {ti(`claimStatus.${c.status}`)}
                {c.handoverMethod ? ` · ${tr(`method.${c.handoverMethod}`)}` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/overlevering/${c.id}`} className="button button-subtle button-sm">
                  {t("open")}
                </Link>
                {c.status === "requested" && !selected && (
                  <StepForm
                    action={claimStepAction}
                    fields={{ claimId: c.id, op: "select", locale }}
                    label={t("select")}
                    className="button button-primary button-sm"
                  />
                )}
                {c.status === "requested" && (
                  <StepForm
                    action={claimStepAction}
                    fields={{ claimId: c.id, op: "decline", locale, back: "listing", listingId }}
                    label={t("decline")}
                    className="button button-outline button-sm"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
