import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { can } from "@/modules/authz/policy";
import { getOwnListing } from "@/modules/listings/queries";
import { initialFromListing, wizardOptions } from "@/modules/listings/wizard";
import { PageHeader } from "@/ui/layout/PageHeader";
import { ListingWizard } from "@/ui/listings/ListingWizard";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("wizard");
  return { title: t("titleEdit") };
}

export default async function EditListingPage({ params }: PageProps<"/[locale]/annonse/[id]/rediger">) {
  const locale = await pageLocale(params);
  const { id } = await params;
  const actor = await requirePageUser(locale, `/annonse/${id}/rediger`);
  const d = await getOwnListing(actor, id);
  if (!d) notFound();
  const t = await getTranslations("wizard");
  const te = await getTranslations("errors");
  const decision = can(actor, "listing.update", { type: "listing", ownerId: d.listing.ownerId, status: d.listing.status, isDemo: d.listing.isDemo });
  return (
    <div className="wrap max-w-3xl py-10">
      <PageHeader title={t("titleEdit")} />
      {decision.allow ? (
        <div className="card p-5 sm:p-8">
          <ListingWizard locale={locale} {...await wizardOptions()} initial={initialFromListing(d)} />
        </div>
      ) : (
        <Notice tone="danger">{te(decision.reason === "not_found" ? "forbidden" : decision.reason)}</Notice>
      )}
    </div>
  );
}
