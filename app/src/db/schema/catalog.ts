import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { localities } from "./core";

const ts = (name: string) => timestamp(name, { withTimezone: true });
// Money: integer øre in a bigint column; JS side uses safe integers (DECISIONS D-009).
const ore = (name: string) => bigint(name, { mode: "number" });

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const tstzrange = customType<{ data: string }>({
  dataType() {
    return "tstzrange";
  },
});

export const LISTING_TYPES = ["rent_out", "wanted", "give_away"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const LISTING_STATUSES = [
  "draft",
  "published",
  "paused",
  "reserved",
  "given_away",
  "archived",
  "removed",
  "deleted",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const ITEM_CONDITIONS = ["new", "as_new", "good", "fair", "worn", "defective"] as const;
export type ItemCondition = (typeof ITEM_CONDITIONS)[number];

export const PRICE_UNITS = ["hour", "day", "weekend", "week"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

export const CATEGORY_POLICIES = ["allowed", "restricted", "prohibited"] as const;
export type CategoryPolicy = (typeof CATEGORY_POLICIES)[number];

export type LocalizedText = { nb: string; en: string };

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    parentId: uuid("parent_id"),
    labels: jsonb("labels").$type<LocalizedText>().notNull(),
    icon: text("icon").notNull().default("box"),
    policy: text("policy", { enum: CATEGORY_POLICIES }).notNull().default("allowed"),
    safetyNotice: jsonb("safety_notice").$type<LocalizedText | null>(),
    allowedListingTypes: text("allowed_listing_types")
      .array()
      .notNull()
      .default(sql`ARRAY['rent_out','wanted','give_away']`),
    // false = only free lending; see DECISIONS D-028
    allowPaidRental: boolean("allow_paid_rental").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check("categories_slug_chk", sql`${t.slug} ~ '^[a-z0-9-]+$'`),
    check("categories_labels_chk", sql`${t.labels} ? 'nb' AND ${t.labels} ? 'en'`),
    check("categories_policy_chk", sql`${t.policy} IN ('allowed','restricted','prohibited')`),
    check("categories_restricted_has_notice", sql`${t.policy} <> 'restricted' OR ${t.safetyNotice} IS NOT NULL`),
    check(
      "categories_types_chk",
      sql`${t.allowedListingTypes} <@ ARRAY['rent_out','wanted','give_away']`,
    ),
  ],
);

export const categorySuggestions = pgTable(
  "category_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    text: text("text").notNull(),
    status: text("status", { enum: ["new", "accepted", "rejected"] }).notNull().default("new"),
    handledBy: uuid("handled_by").references(() => users.id),
    handledAt: ts("handled_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [check("category_suggestions_len", sql`char_length(${t.text}) BETWEEN 2 AND 200`)],
);

// Admin-editable keyword hints for prohibited items (PROHIBITED_ITEMS.md §4).
export const screeningKeywords = pgTable("screening_keywords", {
  id: uuid("id").primaryKey().defaultRandom(),
  keyword: text("keyword").notNull().unique(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const MEDIA_SCOPES = ["listing", "condition", "dispute"] as const;
export type MediaScope = (typeof MEDIA_SCOPES)[number];

export const mediaObjects = pgTable(
  "media_objects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    scope: text("scope", { enum: MEDIA_SCOPES }).notNull(),
    storageKey: text("storage_key").notNull().unique(),
    thumbKey: text("thumb_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    check("media_scope_chk", sql`${t.scope} IN ('listing','condition','dispute')`),
    check("media_mime_chk", sql`${t.mimeType} = 'image/webp'`),
    check("media_bytes_chk", sql`${t.bytes} > 0 AND ${t.bytes} <= 5000000`),
    check("media_dims_chk", sql`${t.width} BETWEEN 1 AND 4000 AND ${t.height} BETWEEN 1 AND 4000`),
    check("media_sha_chk", sql`${t.sha256} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    type: text("type", { enum: LISTING_TYPES }).notNull(),
    status: text("status", { enum: LISTING_STATUSES }).notNull().default("draft"),
    isDemo: boolean("is_demo").notNull().default(false),
    title: text("title").notNull(),
    description: text("description").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    localityId: uuid("locality_id")
      .notNull()
      .references(() => localities.id),
    areaNote: text("area_note"),
    itemCondition: text("item_condition", { enum: ITEM_CONDITIONS }),
    knownDefects: text("known_defects"),
    // Leies ut
    priceOre: ore("price_ore"),
    priceUnit: text("price_unit", { enum: PRICE_UNITS }),
    declaredValueOre: ore("declared_value_ore"),
    valueCategory: text("value_category").generatedAlwaysAs(
      sql`CASE WHEN type = 'rent_out' AND declared_value_ore IS NOT NULL THEN CASE WHEN declared_value_ore <= 500000 THEN 'A' ELSE 'B' END END`,
    ),
    depositOre: ore("deposit_ore"),
    usageRestrictions: text("usage_restrictions"),
    includedAccessories: text("included_accessories").array().notNull().default(sql`'{}'::text[]`),
    operatingInstructions: text("operating_instructions"),
    restrictedAckAt: ts("restricted_ack_at"),
    // Ønskes leid
    wantedFrom: date("wanted_from"),
    wantedTo: date("wanted_to"),
    budgetOre: ore("budget_ore"),
    // Handover options
    handoverPickup: boolean("handover_pickup").notNull().default(false),
    handoverOwnerDelivery: boolean("handover_owner_delivery").notNull().default(false),
    deliveryFeeOre: ore("delivery_fee_ore"),
    deliveryRadiusKm: integer("delivery_radius_km"),
    handoverMeet: boolean("handover_meet").notNull().default(false),
    meetingAreaNote: text("meeting_area_note"),
    publishedAt: ts("published_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`setweight(to_tsvector('norwegian', coalesce(title, '')), 'A') || setweight(to_tsvector('norwegian', coalesce(description, '')), 'B') || setweight(to_tsvector('simple', coalesce(title, '')), 'C')`,
    ),
  },
  (t) => [
    index("listings_browse_idx").on(t.status, t.type, t.categoryId, t.localityId, t.publishedAt.desc()),
    index("listings_owner_idx").on(t.ownerId, t.status),
    index("listings_search_idx").using("gin", t.searchVector),
    index("listings_title_trgm_idx").using("gin", t.title.op("gin_trgm_ops")),
    check("listings_type_chk", sql`${t.type} IN ('rent_out','wanted','give_away')`),
    check(
      "listings_status_chk",
      sql`${t.status} IN ('draft','published','paused','reserved','given_away','archived','removed','deleted')`,
    ),
    check("listings_title_len", sql`char_length(${t.title}) BETWEEN 3 AND 90`),
    check(
      "listings_description_len",
      sql`char_length(${t.description}) <= 4000 AND (${t.status} = 'draft' OR char_length(${t.description}) >= 10)`,
    ),
    check("listings_area_note_len", sql`char_length(${t.areaNote}) <= 80`),
    check("listings_meeting_note_len", sql`char_length(${t.meetingAreaNote}) <= 80`),
    check("listings_defects_len", sql`char_length(${t.knownDefects}) <= 1000`),
    check("listings_restrictions_len", sql`char_length(${t.usageRestrictions}) <= 1000`),
    check("listings_instructions_len", sql`char_length(${t.operatingInstructions}) <= 2000`),
    check(
      "listings_condition_chk",
      sql`${t.itemCondition} IN ('new','as_new','good','fair','worn','defective')`,
    ),
    check("listings_price_unit_chk", sql`${t.priceUnit} IN ('hour','day','weekend','week')`),
    check(
      "listings_money_nonneg",
      sql`coalesce(${t.priceOre}, 0) >= 0 AND coalesce(${t.depositOre}, 0) >= 0 AND coalesce(${t.budgetOre}, 0) >= 0 AND coalesce(${t.deliveryFeeOre}, 0) >= 0 AND coalesce(${t.declaredValueOre}, 1) > 0`,
    ),
    check("listings_radius_chk", sql`${t.deliveryRadiusKm} BETWEEN 1 AND 300`),
    check(
      "rent_out_requires_terms",
      sql`${t.type} <> 'rent_out' OR ${t.status} = 'draft' OR (${t.priceOre} IS NOT NULL AND ${t.priceUnit} IS NOT NULL AND ${t.declaredValueOre} IS NOT NULL AND ${t.itemCondition} IS NOT NULL)`,
    ),
    check(
      "deposit_not_above_value",
      sql`${t.depositOre} IS NULL OR ${t.declaredValueOre} IS NULL OR ${t.depositOre} <= ${t.declaredValueOre}`,
    ),
    check(
      "give_away_is_free",
      sql`${t.type} <> 'give_away' OR (${t.priceOre} IS NULL AND ${t.declaredValueOre} IS NULL AND ${t.depositOre} IS NULL)`,
    ),
    check(
      "give_away_states_condition",
      sql`${t.type} <> 'give_away' OR ${t.status} = 'draft' OR (${t.knownDefects} IS NOT NULL AND ${t.itemCondition} IS NOT NULL)`,
    ),
    check(
      "wanted_has_no_item_terms",
      sql`${t.type} <> 'wanted' OR (${t.declaredValueOre} IS NULL AND ${t.depositOre} IS NULL AND ${t.priceOre} IS NULL)`,
    ),
    check(
      "wanted_dates_ordered",
      sql`${t.wantedTo} IS NULL OR ${t.wantedFrom} IS NULL OR ${t.wantedTo} >= ${t.wantedFrom}`,
    ),
    check(
      "not_wanted_fields_only_on_wanted",
      sql`${t.type} = 'wanted' OR (${t.wantedFrom} IS NULL AND ${t.wantedTo} IS NULL AND ${t.budgetOre} IS NULL)`,
    ),
    check(
      "delivery_fields_need_delivery",
      sql`${t.handoverOwnerDelivery} OR (${t.deliveryFeeOre} IS NULL AND ${t.deliveryRadiusKm} IS NULL)`,
    ),
    check(
      "published_offer_has_handover",
      sql`${t.type} = 'wanted' OR ${t.status} = 'draft' OR ${t.handoverPickup} OR ${t.handoverOwnerDelivery} OR ${t.handoverMeet}`,
    ),
    check(
      "reserved_only_for_give_away",
      sql`${t.status} NOT IN ('reserved','given_away') OR ${t.type} = 'give_away'`,
    ),
  ],
);

export const listingImages = pgTable(
  "listing_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .unique()
      .references(() => mediaObjects.id),
    sortOrder: smallint("sort_order").notNull(),
    altText: text("alt_text"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("listing_images_order_uq").on(t.listingId, t.sortOrder),
    check("listing_images_order_chk", sql`${t.sortOrder} BETWEEN 0 AND 7`),
    check("listing_images_alt_len", sql`char_length(${t.altText}) <= 150`),
  ],
);

export const listingUnavailability = pgTable(
  "listing_unavailability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    period: tstzrange("period").notNull(),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("listing_unavailability_idx").using("gist", t.listingId, t.period),
    check(
      "listing_unavailability_period_chk",
      sql`NOT isempty(${t.period}) AND lower(${t.period}) IS NOT NULL AND upper(${t.period}) IS NOT NULL`,
    ),
  ],
);

export const savedListings = pgTable(
  "saved_listings",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);
