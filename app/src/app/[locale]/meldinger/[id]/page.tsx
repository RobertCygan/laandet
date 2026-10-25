import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { pageLocale } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { blockAction } from "@/modules/messaging/actions";
import { getConversation } from "@/modules/messaging/queries";
import { markRead } from "@/modules/messaging/service";
import { ConfirmButton } from "@/ui/listings/ListingActions";
import { ThreadClient } from "@/ui/messaging/ThreadClient";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inbox");
  return { title: t("title"), robots: { index: false } };
}

/** One conversation, readable only by its two participants (404 for everyone else, N2). */
export default async function ConversationPage({ params }: PageProps<"/[locale]/meldinger/[id]">) {
  const locale = await pageLocale(params);
  const { id } = await params;
  const actor = await requirePageUser(locale, `/meldinger/${id}`);
  const c = await getConversation(actor, id);
  if (!c) notFound();
  await markRead(actor, c.id);
  const t = await getTranslations("inbox");

  return (
    <div className="wrap max-w-3xl py-8">
      <Link href="/meldinger" className="text-link mb-5 inline-flex items-center gap-1.5">
        <ArrowLeft size={16} aria-hidden="true" />
        {t("back")}
      </Link>
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-[clamp(24px,3.5vw,34px)] leading-tight">{c.other.name ?? t("deletedUser")}</h1>
        <p className="text-muted">
          {t("about", { title: c.listingTitle })} ·{" "}
          <Link href={`/annonse/${c.listingId}`} className="text-link">
            {t("openListing")}
          </Link>{" "}
          ·{" "}
          <Link href={`/profil/${c.other.id}`} className="text-link">
            {t("openProfile")}
          </Link>
        </p>
      </header>

      {(c.bookings.length > 0 || c.claims.length > 0) && (
        <section className="card mb-6 flex flex-col gap-2 p-4" aria-labelledby="deals-h">
          <h2 id="deals-h" className="text-base">
            {t("dealsHeading")}
          </h2>
          <ul className="flex flex-col gap-1">
            {c.bookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2">
                <span>{t("booking")}:</span>
                <span className="badge">{t(`bookingStatus.${b.status}`)}</span>
                <Link href={`/leieforhold/${b.id}`} className="text-link">
                  {t("openBooking")}
                </Link>
              </li>
            ))}
            {c.claims.map((cl) => (
              <li key={cl.id} className="flex flex-wrap items-center gap-2">
                <span>{t("claim")}:</span>
                <span className="badge">{t(`claimStatus.${cl.status}`)}</span>
                <Link href={`/overlevering/${cl.id}`} className="text-link">
                  {t("openClaim")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-6 flex flex-col gap-3">
        {c.blockedByMe && <Notice tone="warning">{t("blockedByMe")}</Notice>}
        {!c.blockedByMe && c.blockedByOther && <Notice tone="warning">{t("blockedByOther")}</Notice>}
        {(c.blockedByMe || c.blockedByOther) && c.canSend && <Notice>{t("blockedActiveDeal")}</Notice>}
      </div>

      <ThreadClient
        conversationId={c.id}
        meId={c.meId}
        initialMessages={c.messages}
        canSend={c.canSend}
        locale={locale}
      />

      <form action={blockAction} className="mt-8 flex justify-end">
        <input type="hidden" name="userId" value={c.other.id} />
        <input type="hidden" name="conversationId" value={c.id} />
        <input type="hidden" name="locale" value={locale} />
        {c.blockedByMe ? (
          <>
            <input type="hidden" name="op" value="unblock" />
            <button type="submit" className="button button-subtle button-sm">
              {t("unblock")}
            </button>
          </>
        ) : (
          <>
            <input type="hidden" name="op" value="block" />
            <ConfirmButton message={t("blockConfirm")} className="button button-ghost button-sm text-danger">
              {t("block")}
            </ConfirmButton>
          </>
        )}
      </form>
    </div>
  );
}
