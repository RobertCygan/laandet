import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { emailOutbox, listings, localities, userProfiles, type ListingType, type PriceUnit } from "@/db/schema";
import { env } from "@/modules/config/env";
import { formatKr, osloInputs } from "@/i18n/format";
import { queueEmail } from "@/modules/notifications/outbox";

/** The daily post covers the 24 hours before it is made (D-064). */
export const DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000;
/** The email goes out from 17:45 Oslo time, so the post is ready for about 18:00. */
export const DIGEST_SEND_AFTER = "17:45";

export type DigestItem = {
  id: string;
  type: ListingType;
  title: string;
  priceOre: number | null;
  priceUnit: PriceUnit | null;
  budgetOre: number | null;
  locality: string;
  businessName: string | null;
};

/** Public, published, real (not example) listings that were published in the window. */
export async function digestListings(until = new Date(), windowMs = DIGEST_WINDOW_MS): Promise<DigestItem[]> {
  const rows = await db
    .select({
      id: listings.id,
      type: listings.type,
      title: listings.title,
      priceOre: listings.priceOre,
      priceUnit: listings.priceUnit,
      budgetOre: listings.budgetOre,
      locality: localities.name,
      accountType: userProfiles.accountType,
      businessName: userProfiles.businessName,
    })
    .from(listings)
    .innerJoin(localities, eq(localities.id, listings.localityId))
    .innerJoin(userProfiles, eq(userProfiles.userId, listings.ownerId))
    .where(
      and(
        eq(listings.status, "published"),
        eq(listings.isDemo, false),
        isNull(listings.deletedAt),
        inArray(userProfiles.status, ["active", "restricted"]),
        gte(listings.publishedAt, new Date(until.getTime() - windowMs)),
        lte(listings.publishedAt, until),
      ),
    )
    .orderBy(desc(listings.publishedAt))
    .limit(60);
  return rows.map(({ accountType, businessName, ...r }) => ({
    ...r,
    priceOre: r.priceOre === null ? null : Number(r.priceOre),
    budgetOre: r.budgetOre === null ? null : Number(r.budgetOre),
    businessName: accountType === "business" ? businessName : null,
  }));
}

const SECTIONS: { types: ListingType[]; heading: string }[] = [
  { types: ["rent_out"], heading: "🔧 Leies ut eller lånes ut" },
  { types: ["give_away"], heading: "🎁 Gis bort" },
  { types: ["service_offer"], heading: "🌱 Tjenester som tilbys" },
  { types: ["wanted"], heading: "🙋 Ønskes leid" },
  { types: ["service_wanted"], heading: "🤝 Noen trenger hjelp" },
];
const PER: Record<string, string> = {
  hour: "time",
  day: "dag",
  weekend: "helg",
  week: "uke",
  sqm: "m²",
  job: "hele jobben",
};

function priceText(i: DigestItem): string | null {
  const kr = (ore: number) => formatKr(ore).replace(/ /g, " ");
  switch (i.type) {
    case "give_away":
      return "gratis";
    case "rent_out":
      return i.priceOre === 0
        ? "lånes ut gratis"
        : i.priceOre
          ? `${kr(i.priceOre)} / ${PER[i.priceUnit ?? "day"]}`
          : null;
    case "wanted":
      return i.budgetOre ? `budsjett ${kr(i.budgetOre)}` : null;
    default:
      if (i.priceOre === 0) return "gratis";
      if (i.priceOre && i.priceUnit)
        return i.priceUnit === "job"
          ? `${kr(i.priceOre)} for hele jobben`
          : `${kr(i.priceOre)} per ${PER[i.priceUnit]}`;
      return "pris etter avtale";
  }
}

/**
 * The Norwegian post for the Steigen groups on Facebook (D-064): plain text with a link per listing,
 * ready to paste. Only what is already public on the listing page; never names of private people.
 */
export function digestText(items: DigestItem[], date: Date, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const { date: iso } = osloInputs(date);
  const [, m, d] = iso.split("-");
  const lines: string[] = [];
  if (!items.length) {
    lines.push(`Nytt på Laandet ${d}.${m}.`, "", "Ingen nye annonser i dag – kanskje du kan legge ut den første? 😊");
  } else {
    lines.push(
      `Nytt på Laandet i dag (${d}.${m}.) – ${items.length} ${items.length === 1 ? "ny annonse" : "nye annonser"} i Steigen 💚`,
    );
    for (const s of SECTIONS) {
      const group = items.filter((i) => s.types.includes(i.type));
      if (!group.length) continue;
      lines.push("", s.heading);
      for (const i of group) {
        const extra = [i.locality, i.businessName, priceText(i)].filter(Boolean).join(" · ");
        lines.push(`• ${i.title} – ${extra}`, `  ${base}/annonse/${i.id}`);
      }
    }
  }
  lines.push(
    "",
    `Se alle annonsene: ${base}/utforsk`,
    "Har du noe å låne ut, gi bort eller en tjeneste å tilby? Legg det ut gratis på Laandet.",
  );
  return lines.join("\n");
}

/**
 * Worker job `daily_digest` (D-064): once a day from 17:45 Oslo time, emails the operator the post text
 * so it can be pasted into the Facebook groups at 18:00 (Facebook has no API for posting in groups).
 * Nothing is sent on a day without new listings. Idempotent: one email per Oslo day.
 */
export async function sendDailyDigest(
  now = new Date(),
  to = env().DIGEST_EMAIL ?? env().OPS_ALERT_EMAIL,
): Promise<number> {
  if (!to) return 0;
  const oslo = osloInputs(now);
  if (oslo.time < DIGEST_SEND_AFTER) return 0;
  // One email per Oslo day, keyed on the day in the payload (not on the clock of the insert).
  const [already] = await db
    .select({ id: emailOutbox.id })
    .from(emailOutbox)
    .where(and(eq(emailOutbox.template, "daily_digest"), sql`${emailOutbox.payload}->>'date' = ${oslo.date}`))
    .limit(1);
  if (already) return 0;
  const items = await digestListings(now);
  if (!items.length) return 0;
  await queueEmail(db, {
    toEmail: to,
    template: "daily_digest",
    locale: "nb",
    payload: { count: String(items.length), date: oslo.date, text: digestText(items, now, env().APP_URL) },
  });
  return 1;
}
