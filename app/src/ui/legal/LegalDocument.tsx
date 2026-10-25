import { getTranslations } from "next-intl/server";
import type { LegalDocKey } from "@/db/schema";
import { formatDate } from "@/i18n/format";
import { LEGAL_ROUTES, stripLegalMarkup } from "@/modules/legal/content";
import { getLegalDoc } from "@/modules/legal/repo";
import { Notice } from "@/ui/Notice";
import { Markdown } from "./Markdown";

/**
 * A legal document as loaded into the database (P01-12). Norwegian is authoritative; English
 * is an informational translation. Drafts are always labelled as not legally reviewed.
 */
export async function LegalDocument({
  docKey,
  locale,
  transform,
}: {
  docKey: LegalDocKey;
  locale: "nb" | "en";
  transform?: (md: string) => string;
}) {
  const t = await getTranslations("legalPage");
  const tc = await getTranslations("common");
  const doc = (await getLegalDoc(docKey, locale)) ?? (locale === "en" ? await getLegalDoc(docKey, "nb") : null);
  if (!doc) {
    return (
      <div className="wrap max-w-3xl py-10">
        <Notice>{t("missing")}</Notice>
      </div>
    );
  }
  const body = stripLegalMarkup(doc.contentMd);
  return (
    <div className="wrap max-w-3xl py-10">
      <div className="mb-6 flex flex-col gap-3">
        {doc.isDraft && (
          <Notice tone="warning" role="status">
            {tc("draftBanner")}
          </Notice>
        )}
        {doc.locale !== "nb" && (
          <Notice>
            <p>{tc("translationBanner")}</p>
            <a href={LEGAL_ROUTES[docKey]} hrefLang="nb" className="text-link">
              {t("norwegianVersion")}
            </a>
          </Notice>
        )}
      </div>
      <article className="prose">
        <Markdown source={transform ? transform(body) : body} locale={locale} />
      </article>
      <p className="fine-print mt-10">
        {t("version", { version: doc.version })} · {t("updated", { date: formatDate(doc.effectiveAt ?? doc.createdAt) })}
      </p>
    </div>
  );
}
