/**
 * Idempotent seed: localities, categories, feature flags, screening keywords.
 *   npm run db:seed            reference data only
 *   npm run db:seed -- --demo  also the labelled example listings from the prototype
 * Uses the migration role (DATABASE_MIGRATION_URL).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { CATEGORIES, LOCALITIES, SCREENING_KEYWORDS } from "../src/db/seed-data";
import { FLAG_DEFAULTS } from "../src/modules/flags/flags";
import { processImage } from "../src/modules/media/process";
import { mediaStore } from "../src/modules/media/store";

const url = process.env.DATABASE_MIGRATION_URL;
if (!url) throw new Error("DATABASE_MIGRATION_URL is not set");
const pool = new Pool({ connectionString: url, max: 2 });
const db = drizzle({ client: pool, schema, casing: "snake_case" });

async function seedReferenceData() {
  for (const [i, l] of LOCALITIES.entries()) {
    await db
      .insert(schema.localities)
      .values({ slug: l.slug, name: l.name, municipality: "Steigen", sortOrder: i })
      .onConflictDoUpdate({ target: schema.localities.slug, set: { name: l.name, sortOrder: i } });
  }
  for (const [i, c] of CATEGORIES.entries()) {
    const parentId = c.parent
      ? (await db.select({ id: schema.categories.id }).from(schema.categories).where(eq(schema.categories.slug, c.parent)))[0]?.id ?? null
      : null;
    const values = {
      slug: c.slug,
      parentId,
      labels: c.labels,
      icon: c.icon,
      policy: c.policy,
      safetyNotice: c.safetyNotice ?? null,
      allowPaidRental: c.allowPaidRental ?? true,
      sortOrder: i,
    };
    // Only insert: admins may have changed policy or labels since the first seed.
    await db.insert(schema.categories).values(values).onConflictDoNothing({ target: schema.categories.slug });
  }
  for (const [key, def] of Object.entries(FLAG_DEFAULTS)) {
    await db
      .insert(schema.featureFlags)
      .values({ key, enabled: def.enabled, description: def.description })
      .onConflictDoNothing({ target: schema.featureFlags.key });
  }
  for (const keyword of SCREENING_KEYWORDS) {
    await db.insert(schema.screeningKeywords).values({ keyword }).onConflictDoNothing();
  }
  console.log(`Seeded ${LOCALITIES.length} localities, ${CATEGORIES.length} categories, flags and keywords.`);
}

type DemoRental = {
  id: string;
  title: string;
  category: string;
  locality: string;
  priceOre: { hour: number | null; day: number | null; weekend: number | null; week: number | null };
  ownerDelivery: boolean;
  deliveryFeeOre: number | null;
  description: string;
  included: string[];
  image: string;
};
type DemoWanted = {
  id: string;
  title: string;
  category: string;
  locality: string;
  description: string;
  budgetMaxOre: number | null;
};

// Prototype category → seeded category (PROHIBITED_ITEMS.md §2, §5).
const CATEGORY_MAP: Record<string, string> = {
  hoytrykksspyler: "rengjoring",
  tepperenser: "rengjoring",
  motorsag: "motoriserte-redskaper",
  vedkloyver: "motoriserte-redskaper",
  borhammer: "verktoy",
  takboks: "transporttilbehor",
  rullestillas: "stiger-stillas",
  kajakk: "padling",
  sup: "padling",
  slalam: "vinter",
  snofreser: "motoriserte-redskaper",
  hekksaks: "hage",
  gressklipper: "hage",
  partytelt: "fest",
  projektor: "elektronikk",
  gassgrill: "grill-gass",
  "takboks-vinter": "transporttilbehor",
  "tepperenser-lordag": "rengjoring",
  "stillas-3": "stiger-stillas",
  "kajakker-besok": "padling",
};
// Declared values (kr) chosen so every demo stays in category A (≤ 5 000 kr).
const DECLARED_KR: Record<string, number> = {
  hoytrykksspyler: 3500, tepperenser: 3000, motorsag: 4500, vedkloyver: 4000, borhammer: 2500,
  takboks: 4000, rullestillas: 4800, kajakk: 4500, sup: 3500, slalam: 3000, snofreser: 4900,
  hekksaks: 2000, gressklipper: 3000, partytelt: 2500, projektor: 4000, gassgrill: 4000,
};
const DEPOSIT_KR: Record<string, number> = { motorsag: 1000, rullestillas: 1000, projektor: 1000, snofreser: 1000 };
// Not seeded: trailers (paid rental paused, real values > 5 000 kr) and the prohibited mini-excavator.
const SKIP = new Set(["biltilhenger", "varetilhenger", "minigraver"]);

async function seedDemo() {
  const demoEmail = "demo@laandet.invalid";
  let [demo] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, demoEmail));
  if (!demo) {
    // No credential account: this user can never sign in.
    [demo] = await db
      .insert(schema.users)
      .values({ name: "Eksempelbruker", email: demoEmail, emailVerified: true })
      .returning({ id: schema.users.id });
    const now = new Date();
    await db.insert(schema.userProfiles).values({
      userId: demo!.id,
      age18ConfirmedAt: now,
      privateUseConfirmedAt: now,
      emailNotifications: false,
    });
  }
  const existing = await db.execute<{ c: number }>(sql`SELECT count(*)::int AS c FROM listings WHERE is_demo`);
  if (Number(existing.rows[0]?.c ?? 0) > 0) {
    console.log("Demo listings already present; skipping.");
    return;
  }
  const content = JSON.parse(await readFile(path.resolve("seed/demo-content.json"), "utf8")) as {
    rental: DemoRental[];
    wanted: DemoWanted[];
  };
  const cats = new Map((await db.select().from(schema.categories)).map((c) => [c.slug, c]));
  const locs = new Map((await db.select().from(schema.localities)).map((l) => [l.name, l]));
  const store = mediaStore();
  let count = 0;

  for (const r of content.rental) {
    if (SKIP.has(r.id)) continue;
    const cat = cats.get(CATEGORY_MAP[r.id] ?? "annet")!;
    const loc = locs.get(r.locality) ?? locs.get("Leinesfjord")!;
    const unit = r.priceOre.day != null ? "day" : r.priceOre.weekend != null ? "weekend" : "week";
    const paid = cat.allowPaidRental ? (r.priceOre[unit] ?? 0) : 0;
    const now = new Date();
    const [listing] = await db
      .insert(schema.listings)
      .values({
        ownerId: demo!.id,
        type: "rent_out",
        status: "published",
        isDemo: true,
        title: r.title,
        description: r.description,
        categoryId: cat.id,
        localityId: loc.id,
        itemCondition: "good",
        priceOre: paid,
        priceUnit: unit,
        declaredValueOre: (DECLARED_KR[r.id] ?? 3000) * 100,
        depositOre: DEPOSIT_KR[r.id] ? DEPOSIT_KR[r.id]! * 100 : null,
        includedAccessories: r.included,
        restrictedAckAt: cat.policy === "restricted" ? now : null,
        handoverPickup: true,
        handoverOwnerDelivery: r.ownerDelivery,
        deliveryFeeOre: r.ownerDelivery ? r.deliveryFeeOre : null,
        publishedAt: now,
      })
      .returning({ id: schema.listings.id });
    const image = await readFile(path.resolve("seed/demo-images", path.basename(r.image)));
    const processed = await processImage(image);
    const [media] = await db
      .insert(schema.mediaObjects)
      .values({
        uploadedBy: demo!.id,
        scope: "listing",
        storageKey: "pending",
        thumbKey: `pending-${listing!.id}`,
        mimeType: "image/webp",
        bytes: processed.display.byteLength,
        width: processed.width,
        height: processed.height,
        sha256: processed.sha256,
      })
      .returning({ id: schema.mediaObjects.id });
    const storageKey = `listing/${media!.id}.webp`;
    const thumbKey = `listing/${media!.id}-thumb.webp`;
    await store.put(storageKey, processed.display);
    await store.put(thumbKey, processed.thumb);
    await db.update(schema.mediaObjects).set({ storageKey, thumbKey }).where(eq(schema.mediaObjects.id, media!.id));
    await db.insert(schema.listingImages).values({
      listingId: listing!.id,
      mediaId: media!.id,
      sortOrder: 0,
      altText: `Eksempelbilde (KI-generert): ${r.title}`,
    });
    count++;
  }
  for (const w of content.wanted) {
    if (SKIP.has(w.id)) continue;
    const cat = cats.get(CATEGORY_MAP[w.id] ?? "annet")!;
    const loc = locs.get(w.locality) ?? locs.get("Leinesfjord")!;
    await db.insert(schema.listings).values({
      ownerId: demo!.id,
      type: "wanted",
      status: "published",
      isDemo: true,
      title: w.title,
      description: w.description,
      categoryId: cat.id,
      localityId: loc.id,
      budgetOre: w.budgetMaxOre,
      handoverPickup: true,
      publishedAt: new Date(),
    });
    count++;
  }
  console.log(`Seeded ${count} demo listings (all labelled «Eksempel»).`);
}

async function main() {
  await seedReferenceData();
  if (process.argv.includes("--demo")) await seedDemo();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
