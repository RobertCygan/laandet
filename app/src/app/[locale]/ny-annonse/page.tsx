import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale, param } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { can } from "@/modules/authz/policy";
import { flagEnabled } from "@/modules/flags/flags";
import { emptyInitial, wizardOptions } from "@/modules/listings/wizard";
import { ResendVerificationForm } from "@/ui/forms/AuthForms";
import { PageHeader } from "@/ui/layout/PageHeader";
import { ListingWizard } from "@/ui/listings/ListingWizard";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("wizard");
  return { title: t("titleNew") };
}

const TYPES = ["rent_out", "wanted", "give_away"] as const;

export default async function NewListingPage({ params, searchParams }: PageProps<"/[locale]/ny-annonse">) {
  const locale = await pageLocale(params);
  const actor = await requirePageUser(locale, "/ny-annonse");
  const t = await getTranslations("wizard");
  const ta = await getTranslations("auth");
  const te = await getTranslations("errors");
  const typeParam = param((await searchParams).type);
  const type = TYPES.find((x) => x === typeParam);
  const decision = can(actor, "listing.create");
  const open = await flagEnabled("listings_open");

  let blocker = null;
  if (!decision.allow && decision.reason === "email_unverified") {
    blocker = (
      <div className="flex flex-col gap-4">
        <Notice tone="warning">{ta("unverifiedBanner")}</Notice>
        <ResendVerificationForm locale={locale} email={actor.email} />
      </div>
    );
  } else if (!decision.allow) {
    blocker = <Notice tone="danger">{te(decision.reason)}</Notice>;
  } else if (!open) {
    blocker = <Notice tone="warning">{te("feature_disabled")}</Notice>;
  }

  return (
    <div className="wrap max-w-3xl py-10">
      <PageHeader title={t("titleNew")} lead={t("lead")} />
      {blocker ?? (
        <div className="card p-5 sm:p-8">
          <ListingWizard locale={locale} {...await wizardOptions()} initial={emptyInitial(type)} />
        </div>
      )}
    </div>
  );
}
