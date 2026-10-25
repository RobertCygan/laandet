import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getActor } from "@/modules/auth/actor";
import { unreadCount } from "@/modules/messaging/queries";

/** «Meldinger» in the header, with the number of unread conversations. */
export async function InboxLink() {
  const actor = await getActor();
  if (actor.kind !== "user") return null;
  const [t, n] = await Promise.all([getTranslations("inbox"), unreadCount(actor)]);
  return (
    <Link href="/meldinger" className="inline-flex items-center gap-1.5">
      {t("navLink")}
      {n > 0 && (
        <>
          <span className="badge badge-warning" aria-hidden="true">
            {n}
          </span>
          <span className="visually-hidden">({t("unreadCount", { count: n })})</span>
        </>
      )}
    </Link>
  );
}
