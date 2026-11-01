import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pageLocale } from "@/i18n/page";
import { listCategories } from "@/modules/listings/queries";
import { CategoryIcon } from "@/ui/Icon";
import { PageHeader } from "@/ui/layout/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("categoriesPage");
  return { title: t("title") };
}

export default async function CategoriesPage({ params }: PageProps<"/[locale]/kategorier">) {
  const locale = await pageLocale(params);
  const t = await getTranslations("categoriesPage");
  const cats = await listCategories();
  return (
    <div className="wrap py-10">
      <PageHeader title={t("title")} lead={t("lead")} />
      <ul className="category-grid">
        {cats.map((c) => (
          <li key={c.id}>
            <Link href={{ pathname: "/utforsk", query: { kategori: c.slug } }} className="category-card h-full">
              <span className="category-icon">
                <CategoryIcon name={c.icon} />
              </span>
              <span className="flex flex-col items-center gap-1 text-center">
                <strong>{c.labels[locale]}</strong>
                {c.policy === "restricted" && <span className="badge badge-warning w-fit">{t("restricted")}</span>}
                {!c.allowPaidRental && <span className="badge w-fit">{t("freeOnly")}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8">
        <Link href="/retningslinjer/forbudte-gjenstander" className="text-link">
          {t("rulesLink")}
        </Link>
      </p>
    </div>
  );
}
