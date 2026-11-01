import { getTranslations } from "next-intl/server";
import { MessageCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getActor } from "@/modules/auth/actor";
import { conversationForListing, ownRentalListings } from "@/modules/messaging/queries";
import { ContactForm } from "./ContactForm";

/**
 * «Send melding» on a listing page (P02-01): sign-in link for visitors, a link to the existing
 * conversation, or the first-message form. Nothing for the owner, demo or unpublished listings.
 */
export async function ContactOwnerButton({
  listingId,
  ownerId,
  listingType,
  available,
  locale,
}: {
  listingId: string;
  ownerId: string;
  listingType: "rent_out" | "wanted" | "give_away";
  available: boolean;
  locale: "nb" | "en";
}) {
  if (!available) return null;
  const actor = await getActor();
  if (actor.kind === "user" && actor.id === ownerId) return null;
  const t = await getTranslations("inbox");
  const returnTo = `${locale === "en" ? "/en" : ""}/annonse/${listingId}`;

  if (actor.kind !== "user") {
    return (
      <Link href={{ pathname: "/logg-inn", query: { neste: returnTo } }} className="button button-outline w-full">
        <MessageCircle size={18} aria-hidden="true" />
        {t("signInToContact")}
      </Link>
    );
  }
  const existing = await conversationForListing(actor, listingId);
  if (existing) {
    return (
      <Link href={`/meldinger/${existing}`} className="button button-outline w-full">
        <MessageCircle size={18} aria-hidden="true" />
        {t("goToConversation")}
      </Link>
    );
  }
  const ownListings = listingType === "wanted" ? await ownRentalListings(actor) : null;
  return (
    <details className="rounded-lg border border-border p-4">
      <summary className="cursor-pointer font-bold">
        {listingType === "wanted" ? t("contactWanted") : t("contactTitle")}
      </summary>
      <div className="mt-3">
        <ContactForm listingId={listingId} locale={locale} ownListings={ownListings} />
      </div>
    </details>
  );
}
