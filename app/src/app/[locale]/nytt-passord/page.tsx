import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pageLocale, param } from "@/i18n/page";
import { ResetPasswordForm } from "@/ui/forms/AuthForms";
import { NarrowPage, PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("resetTitle"), referrer: "no-referrer" };
}

export default async function ResetPasswordPage({ params, searchParams }: PageProps<"/[locale]/nytt-passord">) {
  await pageLocale(params);
  const sp = await searchParams;
  // Better Auth redirects here with ?token=… (or ?error=INVALID_TOKEN for an expired link).
  const token = param(sp.token);
  const t = await getTranslations("auth");
  const te = await getTranslations("errors");
  return (
    <NarrowPage>
      <PageHeader title={t("resetTitle")} />
      {token && !param(sp.error) ? (
        <div className="card p-6">
          <ResetPasswordForm token={token} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Notice tone="danger">{te("reset_link_invalid")}</Notice>
          <Link href="/glemt-passord" className="text-link">
            {t("forgotTitle")}
          </Link>
        </div>
      )}
    </NarrowPage>
  );
}
