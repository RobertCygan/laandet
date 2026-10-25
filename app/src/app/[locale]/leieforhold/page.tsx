import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDate, formatDateTime, formatKr } from "@/i18n/format";
import { pageLocale } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { listMyDisputes } from "@/modules/disputes/queries";
import { listMyBookings, type MyBooking } from "@/modules/rentals/queries";
import { PageHeader } from "@/ui/layout/PageHeader";
import { StatusBadge } from "@/ui/rentals/StatusBadge";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rentals");
  return { title: t("myTitle"), robots: { index: false } };
}

export default async function MyRentalsPage({ params }: PageProps<"/[locale]/leieforhold">) {
  const locale = await pageLocale(params);
  const actor = await requirePageUser(locale, "/leieforhold");
  const [data, cases] = await Promise.all([listMyBookings(actor).then((d) => d!), listMyDisputes(actor)]);
  const td = await getTranslations("disputes");
  const t = await getTranslations("rentals");
  const tg = await getTranslations("claims");
  const ti = await getTranslations("inbox");

  const group = (title: string, rows: MyBooking[]) =>
    rows.length > 0 && (
      <section className="flex flex-col gap-3">
        <h2 className="text-xl">{title}</h2>
        <ul className="flex flex-col gap-3">
          {rows.map((b) => (
            <li key={b.id}>
              <Link href={`/leieforhold/${b.id}`} className="card flex flex-col gap-1 p-4 no-underline hover:shadow-md">
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="text-lg">{b.title}</strong>
                  <StatusBadge status={b.status} />
                </span>
                <span className="text-sm text-muted">
                  {t(b.role === "owner" ? "youLendTo" : "youRentFrom", { name: b.otherName })}
                </span>
                <span className="text-sm">
                  {formatDateTime(b.start, locale)} – {formatDateTime(b.end, locale)}
                  {b.totalPriceOre > 0 ? ` · ${formatKr(b.totalPriceOre)}` : ` · ${t("freeLoan")}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );

  const empty =
    !data.active.length && !data.requests.length && !data.finished.length && !data.claims.length && !cases.length;
  return (
    <div className="wrap flex max-w-3xl flex-col gap-8 py-10">
      <PageHeader title={t("myTitle")} lead={t("myLead")} />
      {empty && (
        <p>
          {t("empty")}{" "}
          <Link href="/utforsk" className="text-link">
            {t("explore")}
          </Link>
        </p>
      )}
      {group(t("groupActive"), data.active)}
      {group(t("groupRequests"), data.requests)}
      {data.claims.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl">{tg("groupTitle")}</h2>
          <ul className="flex flex-col gap-3">
            {data.claims.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/overlevering/${g.id}`}
                  className="card flex flex-col gap-1 p-4 no-underline hover:shadow-md"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="text-lg">{g.title}</strong>
                    <span className="badge">{ti(`claimStatus.${g.status}`)}</span>
                  </span>
                  <span className="text-sm text-muted">
                    {tg(g.role === "giver" ? "youGiveTo" : "youGetFrom", { name: g.otherName })} ·{" "}
                    {formatDate(g.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {cases.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl">{td("myCases")}</h2>
          <ul className="flex flex-col gap-3">
            {cases.map((c) => (
              <li key={c.id}>
                <Link href={`/saker/${c.id}`} className="card flex flex-col gap-1 p-4 no-underline hover:shadow-md">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="text-lg">{c.title}</strong>
                    <span className="badge">{td(`status.${c.status}`)}</span>
                  </span>
                  <span className="text-sm text-muted">
                    {td(`categories.${c.category}`)} · {formatDate(c.openedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {group(t("groupFinished"), data.finished)}
    </div>
  );
}
