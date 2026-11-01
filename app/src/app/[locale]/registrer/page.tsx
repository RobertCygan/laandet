import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { localePath, pageLocale } from "@/i18n/page";
import { getActor } from "@/modules/auth/actor";
import { listLocalities } from "@/modules/listings/queries";
import { SignUpForm } from "@/ui/forms/AuthForms";
import { NarrowPage, PageHeader } from "@/ui/layout/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signUpTitle") };
}

export default async function SignUpPage({ params }: PageProps<"/[locale]/registrer">) {
  const locale = await pageLocale(params);
  if ((await getActor()).kind === "user") redirect(localePath(locale, "/konto"));
  const t = await getTranslations("auth");
  const localities = await listLocalities();
  return (
    <NarrowPage>
      <PageHeader title={t("signUpTitle")} lead={t("signUpLead")} />
      <div className="card p-6">
        <SignUpForm
          locale={locale}
          localities={localities.map((l) => ({ slug: l.slug, name: l.name }))}
          // eslint-disable-next-line react-hooks/purity -- render time is the point (bot fill-time check)
          startedAt={Date.now()}
        />
      </div>
      <p className="mt-6 text-center">
        {t("haveAccount")}{" "}
        <Link href="/logg-inn" className="text-link">
          {t("signInTitle")}
        </Link>
      </p>
    </NarrowPage>
  );
}
