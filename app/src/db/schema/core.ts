import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const ACCOUNT_STATUSES = [
  "active",
  "restricted",
  "suspended",
  "deletion_pending",
  "deleted",
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ROLES = ["user", "moderator", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const LOCALES = ["nb", "en"] as const;

export const localities = pgTable(
  "localities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    municipality: text("municipality").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [check("localities_slug_chk", sql`${t.slug} ~ '^[a-z0-9-]+$'`)],
);

export const userProfiles = pgTable(
  "user_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    localityId: uuid("locality_id").references(() => localities.id),
    bio: text("bio"),
    locale: text("locale", { enum: LOCALES }).notNull().default("nb"),
    role: text("role", { enum: ROLES }).notNull().default("user"),
    status: text("status", { enum: ACCOUNT_STATUSES }).notNull().default("active"),
    statusReasonCode: text("status_reason_code"),
    statusChangedAt: ts("status_changed_at"),
    // Sign-up self-declarations (never displayed as "verified")
    age18ConfirmedAt: ts("age_18_confirmed_at").notNull(),
    privateUseConfirmedAt: ts("private_use_confirmed_at").notNull(),
    emailNotifications: boolean("email_notifications").notNull().default(true),
    deletionRequestedAt: ts("deletion_requested_at"),
    deletedAt: ts("deleted_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check("user_profiles_bio_len", sql`char_length(${t.bio}) <= 500`),
    check("user_profiles_locale_chk", sql`${t.locale} IN ('nb','en')`),
    check("user_profiles_role_chk", sql`${t.role} IN ('user','moderator','admin')`),
    check(
      "user_profiles_status_chk",
      sql`${t.status} IN ('active','restricted','suspended','deletion_pending','deleted')`,
    ),
  ],
);

export const identityVerifications = pgTable(
  "identity_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["email", "bankid", "manual_staff"] }).notNull(),
    level: text("level", { enum: ["basic", "strong"] }).notNull(),
    status: text("status", {
      enum: ["pending", "verified", "failed", "revoked", "expired"],
    }).notNull(),
    providerSubjectHash: text("provider_subject_hash"),
    verifiedAt: ts("verified_at"),
    expiresAt: ts("expires_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("identity_provider_chk", sql`${t.provider} IN ('email','bankid','manual_staff')`),
    check("identity_level_chk", sql`${t.level} IN ('basic','strong')`),
    check(
      "identity_status_chk",
      sql`${t.status} IN ('pending','verified','failed','revoked','expired')`,
    ),
    check("identity_email_is_basic", sql`${t.level} = 'basic' OR ${t.provider} <> 'email'`),
    uniqueIndex("identity_unique_subject")
      .on(t.provider, t.providerSubjectHash)
      .where(sql`status = 'verified' AND provider_subject_hash IS NOT NULL`),
  ],
);

export const userBlocks = pgTable(
  "user_blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    check("user_blocks_not_self", sql`${t.blockerId} <> ${t.blockedId}`),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    // ids and short labels only, never message text
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    readAt: ts("read_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt, t.createdAt.desc())],
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    toUserId: uuid("to_user_id").references(() => users.id, { onDelete: "set null" }),
    toEmail: text("to_email").notNull(),
    template: text("template").notNull(),
    locale: text("locale", { enum: LOCALES }).notNull(),
    payload: jsonb("payload").$type<Record<string, string>>().notNull().default({}),
    status: text("status", { enum: ["pending", "sending", "sent", "failed"] })
      .notNull()
      .default("pending"),
    attempts: smallint("attempts").notNull().default(0),
    nextAttemptAt: ts("next_attempt_at").notNull().defaultNow(),
    lastError: text("last_error"),
    createdAt: ts("created_at").notNull().defaultNow(),
    sentAt: ts("sent_at"),
  },
  (t) => [
    index("email_outbox_due_idx").on(t.status, t.nextAttemptAt),
    check("email_outbox_status_chk", sql`${t.status} IN ('pending','sending','sent','failed')`),
  ],
);

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull(),
  description: text("description").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const appRateLimits = pgTable("app_rate_limits", {
  bucket: text("bucket").primaryKey(),
  count: integer("count").notNull(),
  windowEnd: ts("window_end").notNull(),
});

export const workerHeartbeats = pgTable("worker_heartbeats", {
  job: text("job").primaryKey(),
  lastRunAt: ts("last_run_at").notNull(),
  lastOkAt: ts("last_ok_at"),
  lastError: text("last_error"),
});

// Append-only security and admin log (runtime role: SELECT, INSERT only).
export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    occurredAt: ts("occurred_at").notNull().defaultNow(),
    actorId: uuid("actor_id"), // no FK: survives user deletion
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: uuid("target_id"),
    reason: text("reason"),
    requestId: text("request_id"),
    ipHash: text("ip_hash"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    index("audit_events_target_idx").on(t.targetType, t.targetId),
    index("audit_events_actor_idx").on(t.actorId, t.occurredAt),
  ],
);
