import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatMonthYear } from "@/i18n/format";
import { pageLocale } from "@/i18n/page";
import { getActor } from "@/modules/auth/actor";
import { getPublicProfile } from "@/modules/users/service";
import { ReportForm } from "@/ui/listings/ListingActions";

export async function generateMetadata({ params }: PageProps<"/[locale]/profil/[id]">): Promise<Metadata> {
  const { id } = await params;
  const p = await getPublicProfile(id);
  return p ? { title: p.name, robots: { index: false } } : {};
}

export default async function ProfilePage({ params }: PageProps<"/[locale]/profil/[id]">) {
  const locale = await pageLocale(params);
  const { id } = await params;
  const [p, actor] = await Promise.all([getPublicProfile(id), getActor()]);
  if (!p) notFound();
  const t = await getTranslations("profile");
  const tl = await getTranslations("listing");
  const tr = await getTranslations("report");
  const isNew = Date.now() - p.createdAt.getTime() < 30 * 24 * 60 * 60 * 1000;
  const self = actor.kind === "user" && actor.id === p.id;

  return (
    <div className="wrap max-w-3xl py-10">
      <header className="card mb-8 flex flex-col gap-3 p-6">
        <h1 className="text-[clamp(28px,4vw,40px)] leading-tight">{p.name}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>{t("memberSince", { date: formatMonthYear(p.createdAt, locale) })}</span>
          {isNew && <span className="badge">{t("newMember")}</span>}
          {p.localityName && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} aria-hidden="true" />
              {p.localityName}, Steigen
            </span>
          )}
        </p>
        {p.bio && <p className="whitespace-pre-line">{p.bio}</p>}
        <p className="fine-print">{t("notVerified")}</p>
      </header>

      <section aria-labelledby="active-h">
        <h2 id="active-h" className="mb-4 text-2xl">
          {t("activeListings")}
        </h2>
        {p.activeListings.length === 0 ? (
          <p>{t("noListings")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {p.activeListings.map((l) => (
              <li key={l.id} className="card flex flex-wrap items-center justify-between gap-2 p-4">
                <Link href={`/annonse/${l.id}`} className="text-link font-bold">
                  {l.title}
                </Link>
                <span className="flex gap-2">
                  {l.isDemo && <span className="badge badge-demo">{tl("demoBadge")}</span>}
                  <span className="badge">{tl(`type.${l.type}`)}</span>
                  <span className="text-sm text-muted">{l.labels[locale]}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!self && (
        <details className="card mt-10 p-6">
          <summary className="cursor-pointer font-bold">{t("report")}</summary>
          <div className="mt-4">{actor.kind === "user" ? <ReportForm targetType="user" targetId={p.id} /> : <p>{tr("signInFirst")}</p>}</div>
        </details>
      )}
    </div>
  );
}
