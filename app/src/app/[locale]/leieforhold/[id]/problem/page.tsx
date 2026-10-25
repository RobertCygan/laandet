import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { localePath, pageLocale } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { openDisputeIdForBooking } from "@/modules/disputes/queries";
import { REPORTABLE_BOOKING_STATUSES } from "@/modules/disputes/rules";
import { getBookingForParty } from "@/modules/rentals/queries";
import { OpenDisputeForm } from "@/ui/disputes/DisputeForms";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("disputes");
  return { title: t("reportTitle"), robots: { index: false } };
}

/** «Meld fra om et problem» (P03-01 step 1). An open case on the booking is shown instead of a new form. */
export default async function ReportProblemPage({ params }: PageProps<"/[locale]/leieforhold/[id]/problem">) {
  const locale = await pageLocale(params);
  const { id } = await params;
  const actor = await requirePageUser(locale, `/leieforhold/${id}/problem`);
  const v = await getBookingForParty(actor, id);
  if (!v) notFound();
  const open = await openDisputeIdForBooking(v.booking.id);
  if (open) redirect(localePath(locale, `/saker/${open}`));
  const t = await getTranslations("disputes");
  const tr = await getTranslations("rentals");
  const available = REPORTABLE_BOOKING_STATUSES.includes(v.booking.status);

  return (
    <div className="wrap flex max-w-2xl flex-col gap-6 py-10">
      <Link href={`/leieforhold/${v.booking.id}`} className="text-link inline-flex items-center gap-1.5">
        <ArrowLeft size={16} aria-hidden="true" />
        {tr("bookingTitle")}
      </Link>
      <PageHeader title={t("reportTitle")} lead={v.title} />
      <Notice>
        <p>{t("principles")}</p>
      </Notice>
      {available ? (
        <section className="card p-6">
          <OpenDisputeForm bookingId={v.booking.id} locale={locale} />
        </section>
      ) : (
        <Notice tone="warning">{t("notAvailable")}</Notice>
      )}
    </div>
  );
}
