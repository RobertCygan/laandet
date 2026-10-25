import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/i18n/format";
import { pageLocale } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { listInbox } from "@/modules/messaging/queries";
import { PageHeader } from "@/ui/layout/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inbox");
  return { title: t("title"), robots: { index: false } };
}

/** Inbox (P02-01): newest activity first, with an unread marker. */
export default async function InboxPage({ params }: PageProps<"/[locale]/meldinger">) {
  const locale = await pageLocale(params);
  const actor = await requirePageUser(locale, "/meldinger");
  const items = await listInbox(actor);
  const t = await getTranslations("inbox");

  return (
    <div className="wrap max-w-3xl py-10">
      <PageHeader title={t("title")} lead={t("lead")} />
      {items.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((c) => {
            const lastText = !c.last
              ? ""
              : c.last.kind === "system"
                ? t.has(`system.${c.last.body}`)
                  ? t(`system.${c.last.body}` as "system.unknown")
                  : t("lastSystem")
                : `${c.last.fromMe ? `${t("you")}: ` : ""}${c.last.body}`;
            return (
              <li key={c.id}>
                <Link
                  href={`/meldinger/${c.id}`}
                  className={`card flex flex-col gap-1 p-4 hover:border-primary ${c.unread ? "border-primary" : ""}`}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{c.otherName ?? t("deletedUser")}</strong>
                    <span className="text-xs text-muted">{formatDateTime(c.lastMessageAt, locale)}</span>
                  </span>
                  <span className="text-sm text-muted">{t("about", { title: c.listingTitle })}</span>
                  <span className="flex items-center gap-2 text-sm">
                    {c.unread && <span className="badge badge-warning">{t("unread")}</span>}
                    <span className="line-clamp-1 break-all">{lastText}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
