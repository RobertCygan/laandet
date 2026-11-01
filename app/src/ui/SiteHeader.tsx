import { MapPin, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { signOutAction } from "@/modules/auth/actions";
import type { Actor } from "@/modules/authz/actor-types";
import { unreadCount } from "@/modules/messaging/queries";
import { unreadNotificationCount } from "@/modules/notifications/queries";
import { getAvatarMediaId } from "@/modules/users/service";
import { Avatar } from "./Avatar";
import { LanguageSwitch } from "./LanguageSwitch";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { InboxLink } from "./messaging/InboxLink";
import { NotificationsLink } from "./rentals/NotificationsLink";
import { UserMenu } from "./UserMenu";

export async function SiteHeader({ actor, locale }: { actor: Actor; locale: "nb" | "en" }) {
  const t = await getTranslations("nav");
  const signedIn = actor.kind === "user";
  const staff = signedIn && (actor.role === "moderator" || actor.role === "admin");

  const browseLinks = (
    <>
      <Link href="/utforsk">{t("explore")}</Link>
      <Link href="/kategorier">{t("categories")}</Link>
      <Link href={{ pathname: "/utforsk", query: { type: "wanted" } }}>{t("wanted")}</Link>
      <Link href={{ pathname: "/utforsk", query: { type: "give_away" } }}>{t("giveAway")}</Link>
      <Link href={{ pathname: "/utforsk", query: { type: "tjenester" } }}>{t("services")}</Link>
    </>
  );
  const howItWorks = <Link href="/slik-fungerer-det">{t("howItWorks")}</Link>;
  // Signed in, «Slik fungerer det» moves into the account menu so the main menu stays on one line.
  const mainLinks = signedIn ? (
    browseLinks
  ) : (
    <>
      {browseLinks}
      {howItWorks}
    </>
  );
  const [unread, avatarMediaId] = signedIn
    ? await Promise.all([
        Promise.all([unreadCount(actor), unreadNotificationCount(actor)]).then(([a, b]) => a + b),
        getAvatarMediaId(actor.id),
      ])
    : [0, null];
  const accountLinks = signedIn ? (
    <>
      {howItWorks}
      <InboxLink />
      <NotificationsLink />
      <Link href="/leieforhold">{t("rentals")}</Link>
      <Link href="/mine-annonser">{t("myListings")}</Link>
      <Link href="/konto">{t("myProfile")}</Link>
      {staff && <Link href="/admin">{t("admin")}</Link>}
      <hr className="my-1 border-border" />
      <form action={signOutAction}>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className="menu-signout">
          {t("signOut")}
        </button>
      </form>
    </>
  ) : (
    <>
      <Link href="/logg-inn">{t("signIn")}</Link>
      <Link href="/registrer">{t("createAccount")}</Link>
    </>
  );

  return (
    <header className="site-header">
      <div className="topbar">
        <div className="wrap flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={14} aria-hidden="true" />
            {t("localStart")}
          </span>
          <LanguageSwitch locale={locale} label={t("otherLanguage")} />
        </div>
      </div>
      <div className="wrap nav-shell relative">
        <Link href="/" aria-label={t("home")}>
          <Logo />
        </Link>
        <nav className="desktop-nav" aria-label={t("main")}>
          {mainLinks}
        </nav>
        <div className="flex items-center gap-2 lg:gap-4">
          {signedIn ? (
            <div className="hidden lg:block">
              <UserMenu
                name={actor.name}
                avatar={<Avatar name={actor.name} mediaId={avatarMediaId} />}
                label={t("accountMenu")}
                unreadLabel={unread > 0 ? t("unreadSomething") : undefined}
              >
                {accountLinks}
              </UserMenu>
            </div>
          ) : (
            <div className="hidden items-center gap-4 text-sm font-bold whitespace-nowrap lg:flex">{accountLinks}</div>
          )}
          <Link href="/ny-annonse" className="button button-primary button-sm">
            <Plus size={18} aria-hidden="true" />
            <span className="hidden sm:inline">{t("postListing")}</span>
            <span className="visually-hidden sm:hidden">{t("postListing")}</span>
          </Link>
          <MobileMenu openLabel={t("openMenu")} closeLabel={t("closeMenu")}>
            {mainLinks}
            <hr className="my-2 border-border" />
            {accountLinks}
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
