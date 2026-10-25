import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getActor } from "@/modules/auth/actor";

export type AdminSection =
  | "dashboard"
  | "reports"
  | "appeals"
  | "disputes"
  | "categories"
  | "localities"
  | "flags"
  | "legal"
  | "security"
  | "metrics"
  | "transparency";

/** Sections every staff member sees; the rest are for admins (AUTH_MODEL §4). */
const STAFF: readonly AdminSection[] = ["dashboard", "reports", "appeals", "disputes", "categories", "metrics"];
const HREF: Record<AdminSection, string> = {
  dashboard: "/admin",
  reports: "/admin/rapporter",
  appeals: "/admin/klager",
  disputes: "/admin/saker",
  categories: "/admin/kategorier",
  localities: "/admin/steder",
  flags: "/admin/flagg",
  legal: "/admin/juridisk",
  security: "/admin/sikkerhet",
  metrics: "/admin/tall",
  transparency: "/admin/apenhet",
};

export async function AdminNav({ current }: { current: AdminSection }) {
  const [t, actor] = await Promise.all([getTranslations("admin"), getActor()]);
  const isAdmin = actor.kind === "user" && actor.role === "admin";
  const sections = (Object.keys(HREF) as AdminSection[]).filter((s) => isAdmin || STAFF.includes(s));
  return (
    <nav aria-label={t("title")} className="mb-8 flex flex-wrap gap-2">
      {sections.map((key) => (
        <Link
          key={key}
          href={HREF[key]}
          className={`button button-sm ${current === key ? "button-primary" : "button-subtle"}`}
          aria-current={current === key ? "page" : undefined}
        >
          {t(`nav.${key}`)}
        </Link>
      ))}
    </nav>
  );
}
