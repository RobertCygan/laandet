import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { requireStaffPage } from "@/modules/auth/guards";
import { env } from "@/modules/config/env";
import { digestListings, digestText } from "@/modules/digest/daily";
import { AdminNav } from "@/ui/admin/AdminNav";
import { CopyText } from "@/ui/admin/CopyText";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("digest");
  return { title: t("title"), robots: { index: false } };
}

/** Today's new listings as a ready post for the Steigen groups on Facebook (D-064), for all staff. */
export default async function AdminDigestPage({ params }: PageProps<"/[locale]/admin/dagens">) {
  const locale = await pageLocale(params);
  await requireStaffPage(locale);
  const now = new Date();
  const items = await digestListings(now);
  const text = digestText(items, now, env().APP_URL);
  const t = await getTranslations("digest");
  const e = env();
  const mailTo = e.DIGEST_EMAIL ?? e.OPS_ALERT_EMAIL;
  return (
    <div className="wrap max-w-3xl py-10">
      <PageHeader title={t("title")} lead={t("lead")} />
      <AdminNav current="digest" />
      <div className="flex flex-col gap-6">
        <p>{t("count", { count: items.length })}</p>
        <CopyText text={text} label={t("textLabel")} copyLabel={t("copy")} copiedLabel={t("copied")} />
        <Notice>{mailTo ? t("emailOn", { email: mailTo }) : t("emailOff")}</Notice>
        <p className="fine-print">{t("whyManual")}</p>
      </div>
    </div>
  );
}
