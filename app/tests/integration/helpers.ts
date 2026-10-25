import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { testUser, type UserActor } from "@/modules/authz/actor-types";
import type { ListingDraft } from "@/modules/listings/rules";
import { TEST_DB_OWNER_URL } from "./env";

/** Owner-role connection for fixtures and assertions (the app itself uses the restricted role). */
const ownerPool = new Pool({ connectionString: TEST_DB_OWNER_URL, max: 2 });
export const owner = drizzle({ client: ownerPool, schema, casing: "snake_case" });
export const closeOwner = () => ownerPool.end();

// Everything users create; reference data (localities, categories, flags, keywords, legal texts) stays.
const MUTABLE_TABLES = [
  "sessions",
  "accounts",
  "verifications",
  "two_factors",
  "rate_limits",
  "user_profiles",
  "identity_verifications",
  "user_blocks",
  "notifications",
  "email_outbox",
  "app_rate_limits",
  "worker_heartbeats",
  "audit_events",
  "legal_acceptances",
  "category_suggestions",
  "media_objects",
  "listings",
  "listing_images",
  "listing_unavailability",
  "saved_listings",
  "reports",
  "moderation_actions",
  "appeals",
  // Phase 02
  "conversations",
  "conversation_participants",
  "messages",
  "bookings",
  "booking_events",
  "giveaway_claims",
  "contracts",
  "contract_acceptances",
  "condition_reports",
  "condition_entries",
  "condition_photos",
  "condition_confirmations",
  "disputes",
];

export async function resetDb(): Promise<void> {
  // No CASCADE: it would also empty reference tables that point at users (flags, keywords).
  await owner.execute(sql.raw(`TRUNCATE ${MUTABLE_TABLES.join(", ")} RESTART IDENTITY`));
  await owner.execute(sql`UPDATE feature_flags SET updated_by = NULL WHERE updated_by IS NOT NULL`);
  await owner.execute(sql`UPDATE screening_keywords SET created_by = NULL WHERE created_by IS NOT NULL`);
  await owner.execute(sql`DELETE FROM users`);
}

type UserOpts = Partial<
  Pick<UserActor, "role" | "status" | "emailVerified" | "staff2fa" | "isNewAccount" | "locale">
> & { name?: string };

/** Insert a user + profile directly and return the matching actor (no session needed for service tests). */
export async function createUser(opts: UserOpts = {}): Promise<UserActor> {
  const id = randomUUID();
  const email = `u-${id.slice(0, 8)}@example.test`;
  const name = opts.name ?? `Bruker ${id.slice(0, 4)}`;
  const createdAt = opts.isNewAccount ? new Date() : new Date(Date.now() - 30 * 24 * 3600 * 1000);
  await owner.insert(schema.users).values({
    id,
    name,
    email,
    emailVerified: opts.emailVerified ?? true,
    twoFactorEnabled: opts.staff2fa ?? false,
    createdAt,
  });
  await owner.insert(schema.userProfiles).values({
    userId: id,
    role: opts.role ?? "user",
    status: opts.status ?? "active",
    locale: opts.locale ?? "nb",
    age18ConfirmedAt: createdAt,
    privateUseConfirmedAt: createdAt,
  });
  return testUser({
    id,
    email,
    name,
    role: opts.role ?? "user",
    status: opts.status ?? "active",
    emailVerified: opts.emailVerified ?? true,
    staff2fa: opts.staff2fa ?? false,
    isNewAccount: opts.isNewAccount ?? false,
    locale: opts.locale ?? "nb",
  });
}

export async function categoryId(slug: string): Promise<string> {
  const [c] = await owner
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(eq(schema.categories.slug, slug));
  if (!c) throw new Error(`category ${slug} missing`);
  return c.id;
}

export async function localityId(slug = "nordfold"): Promise<string> {
  const [l] = await owner
    .select({ id: schema.localities.id })
    .from(schema.localities)
    .where(eq(schema.localities.slug, slug));
  if (!l) throw new Error(`locality ${slug} missing`);
  return l.id;
}

/** A complete, publishable «Leies ut» draft (category «verktoy»). */
export async function rentalDraft(overrides: Partial<ListingDraft> = {}): Promise<ListingDraft> {
  return {
    type: "rent_out",
    title: "Slagdrill med koffert",
    description: "Kraftig slagdrill med bor og koffert. Passer til mur og betong.",
    categoryId: await categoryId("verktoy"),
    localityId: await localityId(),
    areaNote: null,
    itemCondition: "good",
    knownDefects: "Ingen kjente feil",
    priceOre: 15000,
    priceUnit: "day",
    declaredValueOre: 300000,
    depositOre: 50000,
    usageRestrictions: null,
    includedAccessories: ["Koffert"],
    operatingInstructions: null,
    wantedFrom: null,
    wantedTo: null,
    budgetOre: null,
    handoverPickup: true,
    handoverOwnerDelivery: false,
    deliveryFeeOre: null,
    deliveryRadiusKm: null,
    handoverMeet: false,
    meetingAreaNote: null,
    restrictedAck: false,
    imageCount: 0,
    ...overrides,
  };
}
