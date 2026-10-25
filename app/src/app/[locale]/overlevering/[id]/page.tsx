import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/i18n/format";
import { pageLocale, param } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { claimStepAction } from "@/modules/giveaways/actions";
import { getClaimForParty } from "@/modules/rentals/queries";
import { Markdown } from "@/ui/legal/Markdown";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";
import { ConfirmTransferForm } from "@/ui/rentals/ClaimForms";
import { StepForm } from "@/ui/rentals/RentalForms";

const OK_KEYS = ["claimed", "select", "decline", "withdraw", "cancel", "waiting", "transferred"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("claims");
  return { title: t("pageTitle"), robots: { index: false } };
}

/** «Gis bort»: the claim, the transfer confirmation text and both confirmations (P02-03). */
export default async function ClaimPage({ params, searchParams }: PageProps<"/[locale]/overlevering/[id]">) {
  const locale = await pageLocale(params);
  const { id } = await params;
  const actor = await requirePageUser(locale, `/overlevering/${id}`);
  const v = await getClaimForParty(actor, id);
  if (!v) notFound();
  const t = await getTranslations("claims");
  const ti = await getTranslations("inbox");
  const tc = await getTranslations("common");
  const ok = param((await searchParams).ok);
  const g = v.claim;
  const isGiver = v.role === "giver";
  const other = isGiver ? v.claimantName : v.giverName;
  const fields = { claimId: g.id, locale };
  const mine = v.acceptances.some((a) => a.userId === actor.id);
  const name = (userId: string) => (userId === g.giverId ? v.giverName : v.claimantName);

  return (
    <div className="wrap flex max-w-3xl flex-col gap-6 py-10">
      <Link href="/leieforhold" className="text-link inline-flex items-center gap-1.5">
        <ArrowLeft size={16} aria-hidden="true" />
        {t("back")}
      </Link>
      <PageHeader title={v.title} lead={t(isGiver ? "youGiveTo" : "youGetFrom", { name: other })}>
        <div className="mt-3">
          <span className="badge">{ti(`claimStatus.${g.status}`)}</span>
        </div>
      </PageHeader>

      {ok && (OK_KEYS as readonly string[]).includes(ok) && (
        <Notice tone="success" role="status">
          {t(`ok.${ok}`)}
        </Notice>
      )}

      <section className="card flex flex-col gap-4 p-6" aria-labelledby="next-step">
        <h2 id="next-step" className="text-xl">
          {t("nextStep")}
        </h2>
        {g.status === "requested" && isGiver && (
          <>
            <p>{t("next.requestedGiver")}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <StepForm action={claimStepAction} fields={{ ...fields, op: "select" }} label={t("select")} />
              <StepForm
                action={claimStepAction}
                fields={{ ...fields, op: "decline" }}
                label={t("decline")}
                className="button button-outline"
              />
            </div>
          </>
        )}
        {g.status === "requested" && !isGiver && (
          <>
            <p>{t("next.requestedClaimant")}</p>
            <StepForm
              action={claimStepAction}
              fields={{ ...fields, op: "withdraw" }}
              label={t("withdraw")}
              className="button button-outline"
            />
          </>
        )}
        {g.status === "selected" && (
          <>
            <p>{mine ? t("next.waitingOther", { name: other }) : t("next.selected")}</p>
            <StepForm
              action={claimStepAction}
              fields={{ ...fields, op: "cancel" }}
              label={t("cancel")}
              className="button button-outline"
            />
          </>
        )}
        {g.status === "transferred" && <p>{t("next.transferred")}</p>}
        {["declined", "withdrawn", "cancelled", "expired"].includes(g.status) && <p>{t("next.closed")}</p>}
        <Link href={`/meldinger/${g.conversationId}`} className="text-link">
          {t("openConversation")}
        </Link>
        <Notice tone="warning">{t("noPayment")}</Notice>
      </section>

      {v.contract && (
        <section className="flex flex-col gap-4" aria-labelledby="transfer">
          <h2 id="transfer" className="text-xl">
            {t("transferTitle")} · {v.contract.agreementNumber}
          </h2>
          {v.templateIsDraft && <Notice tone="warning">{tc("draftBanner")}</Notice>}
          <article className="prose card p-6" lang="nb">
            <Markdown source={v.contract.renderedText} locale="nb" />
          </article>
          {v.acceptances.length > 0 && (
            <ul className="flex flex-col gap-1">
              {v.acceptances.map((a) => (
                <li key={a.id}>
                  {t("confirmedBy", { name: name(a.userId), date: formatDateTime(a.acceptedAt, locale) })}
                </li>
              ))}
            </ul>
          )}
          {g.status === "selected" && !mine && v.contract.status === "pending_acceptance" && (
            <ConfirmTransferForm claimId={g.id} sha256={v.contract.renderedSha256} locale={locale} />
          )}
        </section>
      )}
    </div>
  );
}
