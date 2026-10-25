import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function AdminNav({ current }: { current: "dashboard" | "reports" | "appeals" }) {
  const t = await getTranslations("admin");
  const items = [
    ["dashboard", "/admin", t("title")],
    ["reports", "/admin/rapporter", t("reports")],
    ["appeals", "/admin/klager", t("appeals")],
  ] as const;
  return (
    <nav aria-label={t("title")} className="mb-8 flex flex-wrap gap-2">
      {items.map(([key, href, label]) => (
        <Link
          key={key}
          href={href}
          className={`button button-sm ${current === key ? "button-primary" : "button-subtle"}`}
          aria-current={current === key ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
