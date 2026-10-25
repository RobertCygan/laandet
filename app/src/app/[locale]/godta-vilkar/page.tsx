import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { localePath, pageLocale, param } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { pendingAcceptances } from "@/modules/legal/acceptance";
import { LEGAL_ROUTES } from "@/modules/legal/content";
import { AcceptTermsForm } from "@/ui/forms/AcceptTermsForm";
import { NarrowPage, PageHeader } from "@/ui/layout/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legalPage");
  return { title: t("acceptTitle"), robots: { index: false } };
}

/** Re-acceptance after a material change to the terms or privacy notice (P01-11 §6). */
export default async function AcceptTermsPage({ params, searchParams }: PageProps<"/[locale]/godta-vilkar">) {
  const locale = await pageLocale(params);
  const actor = await requirePageUser(locale, "/godta-vilkar");
  const next = param((await searchParams).neste);
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  const pending = await pendingAcceptances(actor);
  if (!pending.length) redirect(safeNext ?? localePath(locale, "/konto"));
  const t = await getTranslations("legalPage");
  const tf = await getTranslations("footer");
  return (
    <NarrowPage>
      <PageHeader title={t("acceptTitle")} lead={t("acceptLead")} />
      <ul className="mb-6 flex flex-col gap-2">
        {pending.map((d) => (
          <li key={d.id}>
            <Link href={LEGAL_ROUTES[d.docKey]} className="text-link" target="_blank">
              {d.docKey === "terms" ? tf("terms") : tf("privacy")}
            </Link>{" "}
            <span className="text-sm text-muted">({t("version", { version: d.version })})</span>
          </li>
        ))}
      </ul>
      <div className="card p-6">
        <AcceptTermsForm locale={locale} next={safeNext} />
      </div>
    </NarrowPage>
  );
}
