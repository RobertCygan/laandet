import { MapPin, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Actor } from "@/modules/authz/actor-types";
import { LanguageSwitch } from "./LanguageSwitch";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { InboxLink } from "./messaging/InboxLink";
import { NotificationsLink } from "./rentals/NotificationsLink";

export async function SiteHeader({ actor, locale }: { actor: Actor; locale: "nb" | "en" }) {
  const t = await getTranslations("nav");
  const signedIn = actor.kind === "user";
  const staff = signedIn && (actor.role === "moderator" || actor.role === "admin");

  const mainLinks = (
    <>
      <Link href="/utforsk">{t("explore")}</Link>
      <Link href="/kategorier">{t("categories")}</Link>
      <Link href={{ pathname: "/utforsk", query: { type: "wanted" } }}>{t("wanted")}</Link>
      <Link href={{ pathname: "/utforsk", query: { type: "give_away" } }}>{t("giveAway")}</Link>
      <Link href="/slik-fungerer-det">{t("howItWorks")}</Link>
    </>
  );
  const accountLinks = signedIn ? (
    <>
      <InboxLink />
      <NotificationsLink />
      <Link href="/leieforhold">{t("rentals")}</Link>
      <Link href="/mine-annonser">{t("myListings")}</Link>
      <Link href="/konto">{t("myProfile")}</Link>
      {staff && <Link href="/admin">{t("admin")}</Link>}
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
          <div className="hidden items-center gap-4 text-sm font-bold lg:flex">{accountLinks}</div>
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
