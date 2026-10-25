import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatDateTime, formatKr } from "@/i18n/format";
import { pageLocale, param } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { englishAgreementText, getBookingForParty } from "@/modules/rentals/queries";
import { Markdown } from "@/ui/legal/Markdown";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";
import { AcceptAgreementForm } from "@/ui/rentals/RentalForms";

const OK_KEYS = ["waiting", "confirmed", "revised"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agreement");
  return { title: t("title"), robots: { index: false } };
}

/** The rental agreement (P02-04): the stored text, never re-rendered; accepted against its hash. */
export default async function AgreementPage({ params, searchParams }: PageProps<"/[locale]/leieforhold/[id]/avtale">) {
  const locale = await pageLocale(params);
  const { id } = await params;
  const actor = await requirePageUser(locale, `/leieforhold/${id}/avtale`);
  const v = await getBookingForParty(actor, id);
  if (!v || !v.contracts.length) notFound();
  const t = await getTranslations("agreement");
  const tr = await getTranslations("rentals");
  const tc = await getTranslations("common");
  const ok = param((await searchParams).ok);
  const b = v.booking;
  const c = v.contract ?? v.contracts[0]!;
  const mine = v.acceptances.some((a) => a.userId === actor.id);
  const canAccept = c.status === "pending_acceptance" && b.status === "accepted" && !mine;
  const name = (userId: string) => (userId === b.ownerId ? v.ownerName : v.renterName);
  // English readers also get an informational rendering of the same terms (the Norwegian text applies).
  const english = locale === "en" ? await englishAgreementText(c) : null;

  return (
    <div className="wrap flex max-w-3xl flex-col gap-6 py-10">
      <Link href={`/leieforhold/${b.id}`} className="text-link inline-flex items-center gap-1.5">
        <ArrowLeft size={16} aria-hidden="true" />
        {tr("bookingTitle")}
      </Link>
      <PageHeader title={t("title")} lead={`${v.title} · ${c.agreementNumber}`} />

      {ok && (OK_KEYS as readonly string[]).includes(ok) && (
        <Notice tone="success" role="status">
          {t(`ok.${ok}`)}
        </Notice>
      )}
      {v.templateIsDraft && (
        <Notice tone="warning" role="status">
          {tc("draftBanner")}
        </Notice>
      )}
      {c.status === "superseded" || c.status === "void" ? (
        <Notice tone="warning">{t(`state.${c.status}`)}</Notice>
      ) : null}

      <section className="card flex flex-col gap-3 p-6" aria-labelledby="short">
        <h2 id="short" className="text-xl">
          {t("short")}
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-6">
          <li>{t("shortParties", { owner: v.ownerName, renter: v.renterName })}</li>
          <li>
            {formatDateTime(v.start, locale)} – {formatDateTime(v.end, locale)}
          </li>
          <li>{b.priceOre === 0 ? tr("freeLoan") : t("shortPrice", { total: formatKr(b.totalPriceOre) })}</li>
          <li>{b.depositOre ? t("shortDeposit", { amount: formatKr(b.depositOre) }) : tr("noDeposit")}</li>
          <li>{t("shortCondition")}</li>
          <li>{t("shortLaw")}</li>
        </ul>
        <Notice tone="warning">{tr("paymentWarning")}</Notice>
      </section>

      <article className="prose card p-6" lang="nb" aria-label={t("textLabel")}>
        <Markdown source={c.renderedText} locale="nb" />
      </article>
      <p className="fine-print break-all">
        {t("hash")}: <code>{c.renderedSha256}</code>
      </p>

      <section className="flex flex-col gap-3" aria-labelledby="acceptances">
        <h2 id="acceptances" className="text-xl">
          {t("acceptances")}
        </h2>
        {v.contract && v.acceptances.length ? (
          <ul className="flex flex-col gap-1">
            {v.acceptances.map((a) => (
              <li key={a.id}>
                {t("acceptedBy", { name: name(a.userId), date: formatDateTime(a.acceptedAt, locale) })}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("noneYet")}</p>
        )}
        {c.status === "pending_acceptance" && b.agreementDueAt && (
          <p className="text-sm">{t("deadline", { due: formatDateTime(b.agreementDueAt, locale) })}</p>
        )}
        {canAccept && <AcceptAgreementForm bookingId={b.id} sha256={c.renderedSha256} locale={locale} />}
        {mine && c.status === "pending_acceptance" && <p>{t("waitingOther")}</p>}
      </section>

      {english && (
        <details className="card p-6">
          <summary className="cursor-pointer font-bold">{t("englishVersion")}</summary>
          <Notice>{tc("translationBanner")}</Notice>
          <article className="prose mt-4" lang="en">
            <Markdown source={english} locale="en" />
          </article>
        </details>
      )}

      {v.contracts.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl">{t("revisions")}</h2>
          <ul>
            {v.contracts.map((r) => (
              <li key={r.id}>
                {r.agreementNumber} · {t(`state.${r.status}`)} · {formatDateTime(r.createdAt, locale)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
