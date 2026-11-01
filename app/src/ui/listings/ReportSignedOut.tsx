import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { env } from "@/modules/config/env";

/** Visitors without an account can report by email (P01-12 §2, L-01). */
export async function ReportSignedOut({ returnTo }: { returnTo: string }) {
  const t = await getTranslations("report");
  const tn = await getTranslations("nav");
  const tf = await getTranslations("footer");
  const email = env().OPERATOR_EMAIL;
  return (
    <div className="flex flex-col gap-3">
      <p>{t("signInFirst")}</p>
      <div className="flex flex-wrap gap-3">
        <Link href={{ pathname: "/logg-inn", query: { neste: returnTo } }} className="button button-outline button-sm">
          {tn("signIn")}
        </Link>
        {email ? (
          <a href={`mailto:${email}`} className="text-link self-center">
            {email}
          </a>
        ) : (
          <Link href="/kontakt" className="text-link self-center">
            {tf("contact")}
          </Link>
        )}
      </div>
    </div>
  );
}
