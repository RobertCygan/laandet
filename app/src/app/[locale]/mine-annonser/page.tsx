import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/i18n/format";
import { pageLocale } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { changeStatusAction } from "@/modules/listings/actions";
import { listOwnListings, listSavedListings } from "@/modules/listings/queries";
import { PageHeader } from "@/ui/layout/PageHeader";
import { ConfirmButton } from "@/ui/listings/ListingActions";
import { ListingCard } from "@/ui/ListingCard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("myListings");
  return { title: t("title") };
}

export default async function MyListingsPage({ params }: PageProps<"/[locale]/mine-annonser">) {
  const locale = await pageLocale(params);
  const actor = await requirePageUser(locale, "/mine-annonser");
  const [own, saved] = await Promise.all([listOwnListings(actor), listSavedListings(actor)]);
  const t = await getTranslations("myListings");
  const tl = await getTranslations("listing");
  const tc = await getTranslations("common");

  const op = (id: string, value: "pause" | "resume" | "archive", label: string) => (
    <form action={changeStatusAction}>
      <input type="hidden" name="listingId" value={id} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="op" value={value} />
      <button type="submit" className="button button-subtle button-sm">
        {label}
      </button>
    </form>
  );

  return (
    <div className="wrap py-10">
      <PageHeader title={t("title")}>
        <Link href="/ny-annonse" className="button button-primary mt-4">
          <Plus size={18} aria-hidden="true" />
          {t("create")}
        </Link>
      </PageHeader>

      {own.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {own.map((l) => (
            <li key={l.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="h-20 w-28 shrink-0 overflow-hidden rounded-md bg-secondary">
                {l.thumbId && (
                  // eslint-disable-next-line @next/next/no-img-element -- authorised media route
                  <img
                    src={`/media/${l.thumbId}/thumb`}
                    alt=""
                    width={480}
                    height={360}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/annonse/${l.id}`} className="text-link font-bold">
                  {l.title}
                </Link>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span className="badge">{tl(`type.${l.type}`)}</span>
                  <span
                    className={`badge ${l.status === "removed" ? "badge-danger" : l.status === "published" ? "" : "badge-warning"}`}
                  >
                    {tl(`status.${l.status}`)}
                  </span>
                  <span>{t("updated", { date: formatDate(l.updatedAt) })}</span>
                </p>
                {l.status === "removed" && <p className="mt-1 text-sm">{t("removedInfo")}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {l.status !== "removed" && (
                  <Link href={`/annonse/${l.id}/rediger`} className="button button-outline button-sm">
                    {tc("edit")}
                  </Link>
                )}
                {l.status === "published" && op(l.id, "pause", tc("pause"))}
                {l.status === "paused" && op(l.id, "resume", tc("resume"))}
                {["draft", "published", "paused"].includes(l.status) && op(l.id, "archive", tc("archive"))}
                <form action={changeStatusAction}>
                  <input type="hidden" name="listingId" value={l.id} />
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="op" value="delete" />
                  <ConfirmButton message={t("confirmDelete")} className="button button-ghost button-sm text-danger">
                    {tc("delete")}
                  </ConfirmButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-12" aria-labelledby="saved-h">
        <h2 id="saved-h" className="mb-5 text-2xl">
          {t("saved")}
        </h2>
        {saved.length === 0 ? (
          <p>{t("savedEmpty")}</p>
        ) : (
          <div className="listing-grid">
            {saved.map((l) => (
              <ListingCard key={l.id} listing={l} locale={locale} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
