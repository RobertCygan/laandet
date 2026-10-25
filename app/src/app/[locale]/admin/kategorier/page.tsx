import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale, param } from "@/i18n/page";
import { listCategoriesForAdmin } from "@/modules/admin/catalog";
import { requireStaffPage } from "@/modules/auth/guards";
import { can } from "@/modules/authz/policy";
import { AdminNav } from "@/ui/admin/AdminNav";
import { CategoryForm, CategoryPolicyForm } from "@/ui/admin/PanelForms";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminPanel");
  return { title: t("categoriesTitle"), robots: { index: false } };
}

/** Categories (P03-04): moderators change the policy only; admins edit everything but the slug. */
export default async function AdminCategoriesPage({ params, searchParams }: PageProps<"/[locale]/admin/kategorier">) {
  const locale = await pageLocale(params);
  const actor = await requireStaffPage(locale);
  const saved = param((await searchParams).lagret) === "1";
  const rows = await listCategoriesForAdmin(actor);
  const isAdmin = can(actor, "category.manage").allow;
  const t = await getTranslations("adminPanel");
  const tl = await getTranslations("listing");
  return (
    <div className="wrap py-10">
      <PageHeader
        title={t("categoriesTitle")}
        lead={isAdmin ? t("categoriesLeadAdmin") : t("categoriesLeadModerator")}
      />
      <AdminNav current="categories" />
      {saved && (
        <div className="mb-6">
          <Notice tone="success" role="status">
            {t("saved")}
          </Notice>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {rows.map((c) => (
          <li key={c.id} className="card flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg">{c.labels[locale]}</h2>
              <span className="text-sm text-muted">{c.slug}</span>
              <span
                className={`badge ${c.policy === "prohibited" ? "badge-danger" : c.policy === "restricted" ? "badge-warning" : ""}`}
              >
                {t(`policyValue.${c.policy}`)}
              </span>
              {!c.active && <span className="badge">{t("inactive")}</span>}
              {!c.allowPaidRental && <span className="badge">{t("freeOnly")}</span>}
            </div>
            <p className="text-sm">
              {t("publishedListings", { count: c.publishedListings })} ·{" "}
              {c.allowedListingTypes.map((ty) => tl(`type.${ty}`)).join(", ")}
            </p>
            {c.policy === "prohibited" && c.publishedListings > 0 && (
              <Notice tone="warning">{t("prohibitedHasListings", { count: c.publishedListings })}</Notice>
            )}
            <details>
              <summary className="cursor-pointer font-bold">{t("edit")}</summary>
              <div className="mt-3">
                {isAdmin ? (
                  <CategoryForm
                    locale={locale}
                    c={{
                      id: c.id,
                      labelNb: c.labels.nb,
                      labelEn: c.labels.en,
                      safetyNb: c.safetyNotice?.nb ?? "",
                      safetyEn: c.safetyNotice?.en ?? "",
                      policy: c.policy,
                      types: c.allowedListingTypes,
                      allowPaidRental: c.allowPaidRental,
                      active: c.active,
                      sortOrder: c.sortOrder,
                    }}
                  />
                ) : (
                  <CategoryPolicyForm categoryId={c.id} policy={c.policy} locale={locale} />
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
