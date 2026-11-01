import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { localePath, pageLocale, param } from "@/i18n/page";
import { getActor } from "@/modules/auth/actor";
import { SignInForm } from "@/ui/forms/AuthForms";
import { NarrowPage, PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signInTitle") };
}

export default async function SignInPage({ params, searchParams }: PageProps<"/[locale]/logg-inn">) {
  const locale = await pageLocale(params);
  const sp = await searchParams;
  const next = param(sp.neste);
  const actor = await getActor();
  // A staff member whose session is older than 8 h is sent here to sign in again.
  if (actor.kind === "user" && !param(sp.utlopt)) redirect(localePath(locale, "/konto"));
  const t = await getTranslations("auth");
  const ta = await getTranslations("admin");
  return (
    <NarrowPage>
      <PageHeader title={t("signInTitle")} />
      {param(sp.utlopt) && (
        <div className="mb-5">
          <Notice tone="warning">{ta("sessionExpired")}</Notice>
        </div>
      )}
      <div className="card p-6">
        <SignInForm locale={locale} next={next} />
      </div>
      <div className="mt-6 flex flex-col items-center gap-2">
        <Link href="/glemt-passord" className="text-link">
          {t("forgot")}
        </Link>
        <p>
          {t("noAccount")}{" "}
          <Link href="/registrer" className="text-link">
            {t("signUpTitle")}
          </Link>
        </p>
      </div>
    </NarrowPage>
  );
}
