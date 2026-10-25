import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Notice } from "@/ui/Notice";

/** Warnings after saving a listing (`?advarsel=contact,keywords`). */
export async function SaveWarnings({ value }: { value?: string }) {
  if (!value) return null;
  const t = await getTranslations("wizard");
  const tc = await getTranslations("categoriesPage");
  const list = value.split(",");
  return (
    <>
      {list.includes("contact") && <Notice tone="warning">{t("warnContact")}</Notice>}
      {list.includes("keywords") && (
        <Notice tone="warning">
          <p>{t("warnKeywords")}</p>
          <Link href="/retningslinjer/forbudte-gjenstander" className="text-link">
            {tc("rulesLink")}
          </Link>
        </Notice>
      )}
    </>
  );
}
