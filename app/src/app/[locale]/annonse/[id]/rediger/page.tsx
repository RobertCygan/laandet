import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { pageLocale, param } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { can } from "@/modules/authz/policy";
import { getOwnListing } from "@/modules/listings/queries";
import { initialFromListing, wizardOptions } from "@/modules/listings/wizard";
import { PageHeader } from "@/ui/layout/PageHeader";
import { ListingWizard } from "@/ui/listings/ListingWizard";
import { SaveWarnings } from "@/ui/listings/SaveWarnings";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("wizard");
  return { title: t("titleEdit") };
}

export default async function EditListingPage({ params, searchParams }: PageProps<"/[locale]/annonse/[id]/rediger">) {
  const locale = await pageLocale(params);
  const { id } = await params;
  const actor = await requirePageUser(locale, `/annonse/${id}/rediger`);
  const d = await getOwnListing(actor, id);
  if (!d) notFound();
  const t = await getTranslations("wizard");
  const te = await getTranslations("errors");
  const sp = await searchParams;
  const step = Number(param(sp.steg));
  const decision = can(actor, "listing.update", {
    type: "listing",
    ownerId: d.listing.ownerId,
    status: d.listing.status,
    isDemo: d.listing.isDemo,
  });
  return (
    <div className="wrap max-w-3xl py-10">
      <PageHeader title={t("titleEdit")} />
      <div className="mb-6 flex flex-col gap-3">
        {param(sp.lagret) === "saved" && (
          <Notice tone="success" role="status">
            {t("saved")}
          </Notice>
        )}
        <SaveWarnings value={param(sp.advarsel)} />
      </div>
      {decision.allow ? (
        <div className="card p-5 sm:p-8">
          <ListingWizard
            locale={locale}
            {...await wizardOptions()}
            initial={initialFromListing(d)}
            initialStep={Number.isInteger(step) && step >= 1 && step <= 5 ? step : undefined}
          />
        </div>
      ) : (
        <Notice tone="danger">{te(decision.reason === "not_found" ? "forbidden" : decision.reason)}</Notice>
      )}
    </div>
  );
}
