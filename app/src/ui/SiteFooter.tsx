import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { FeedbackLink } from "./feedback/FeedbackLink";
import { Logo } from "./Logo";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <Logo />
          <p className="mt-4 text-sm">{t("tagline")}</p>
          <p className="mt-3 text-sm">{t("localStart")}</p>
        </div>
        <div>
          <h3>{t("aboutHeading")}</h3>
          <Link href="/om">{t("about")}</Link>
          <Link href="/slik-fungerer-det">{t("howItWorks")}</Link>
          <Link href="/trygghet">{t("safety")}</Link>
          <Link href="/stott-laandet">{t("support")}</Link>
          <Link href="/apenhet">{t("transparency")}</Link>
          <Link href="/kontakt">{t("contact")}</Link>
          <FeedbackLink label={t("feedback")} />
        </div>
        <div>
          <h3>{t("rulesHeading")}</h3>
          <Link href="/vilkar">{t("terms")}</Link>
          <Link href="/personvern">{t("privacy")}</Link>
          <Link href="/informasjonskapsler">{t("cookies")}</Link>
          <Link href="/retningslinjer/forbudte-gjenstander">{t("prohibited")}</Link>
          <Link href="/retningslinjer/trygg-utleie">{t("safeRental")}</Link>
          <Link href="/retningslinjer/tvister">{t("disputes")}</Link>
        </div>
        <div>
          <h3>{t("rankingHeading")}</h3>
          <p className="text-sm">{t("rankingText")}</p>
          <Link href="/vilkar#rangering">{t("rankingLink")}</Link>
        </div>
      </div>
      <div className="wrap footer-bottom">
        <span>© {year} Laandet · G-PSI.ai</span>
        <span>{t("pilotNote")}</span>
      </div>
    </footer>
  );
}
