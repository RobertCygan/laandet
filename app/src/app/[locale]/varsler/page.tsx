import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/i18n/format";
import { pageLocale } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { listNotifications, markAllNotificationsRead } from "@/modules/notifications/queries";
import { PageHeader } from "@/ui/layout/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notificationsPage");
  return { title: t("title"), robots: { index: false } };
}

/** «Varsler» (P02-06): newest first, each with a link to the right page. Opening the page marks them read. */
export default async function NotificationsPage({ params }: PageProps<"/[locale]/varsler">) {
  const locale = await pageLocale(params);
  const actor = await requirePageUser(locale, "/varsler");
  const items = await listNotifications(actor);
  await markAllNotificationsRead(actor);
  const t = await getTranslations("notificationsPage");

  return (
    <div className="wrap flex max-w-3xl flex-col gap-6 py-10">
      <PageHeader title={t("title")} lead={t("lead")} />
      {items.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                href={n.path}
                className={`card flex flex-col gap-1 p-4 no-underline hover:shadow-md ${n.readAt ? "" : "border-l-4 border-l-primary"}`}
              >
                <span>
                  {!n.readAt && <span className="visually-hidden">{t("unread")}: </span>}
                  {t(`kind.${n.kind}`, { title: n.title })}
                </span>
                <span className="text-sm text-muted">{formatDateTime(n.createdAt, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
