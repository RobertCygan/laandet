import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { mediaObjects } from "./catalog";
import { reports } from "./moderation";
import { bookings, disputes } from "./rentals";

// Phase 03: dispute case file, proposals, staff access grants, reviews and transparency figures
// (DISPUTE_POLICY.md, DATA_MODEL.md §2, PRIVACY.md, SUPPORT_AND_FUNDING.md §4). Append-only privileges and
// the review/proposal guards are in drizzle/0006_trust_rules.sql.

const ts = (name: string) => timestamp(name, { withTimezone: true });
const ore = (name: string) => bigint(name, { mode: "number" });

// ---------------------------------------------------------------- disputes

export const DISPUTE_EVENT_KINDS = [
  "statement",
  "evidence_photo",
  "reference",
  "proposal",
  "proposal_response",
  "status_change",
  "support_request",
  "support_note",
  "support_recommendation",
] as const;
export type DisputeEventKind = (typeof DISPUTE_EVENT_KINDS)[number];

/** The case file: statements, evidence, references, proposals and support notes. Append-only. */
export const disputeEvents = pgTable(
  "dispute_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputes.id),
    actorId: uuid("actor_id").references(() => users.id), // NULL = system
    kind: text("kind", { enum: DISPUTE_EVENT_KINDS }).notNull(),
    body: text("body"),
    mediaId: uuid("media_id").references(() => mediaObjects.id),
    // {"type":"condition_report","id":"…"} | {"type":"message","id":"…"} | {"type":"proposal","id":"…"}
    reference: jsonb("reference").$type<{ type: string; id: string } | null>(),
    visibility: text("visibility", { enum: ["parties", "staff_only"] })
      .notNull()
      .default("parties"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("dispute_events_dispute_idx").on(t.disputeId, t.createdAt),
    check(
      "dispute_events_kind_chk",
      sql`${t.kind} IN ('statement','evidence_photo','reference','proposal','proposal_response','status_change','support_request','support_note','support_recommendation')`,
    ),
    check("dispute_events_body_len", sql`char_length(${t.body}) <= 4000`),
    check("dispute_events_visibility_chk", sql`${t.visibility} IN ('parties','staff_only')`),
    check("dispute_events_photo_chk", sql`${t.kind} <> 'evidence_photo' OR ${t.mediaId} IS NOT NULL`),
  ],
);

export const PROPOSAL_TYPES = [
  "no_compensation",
  "repair",
  "replace_accessory",
  "partial_compensation",
  "full_compensation",
  "extra_return_time",
  "other",
] as const;
export type ProposalType = (typeof PROPOSAL_TYPES)[number];

export const disputeProposals = pgTable(
  "dispute_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputes.id),
    proposerId: uuid("proposer_id")
      .notNull()
      .references(() => users.id),
    type: text("type", { enum: PROPOSAL_TYPES }).notNull(),
    amountOre: ore("amount_ore"),
    newReturnAt: ts("new_return_at"),
    text: text("text").notNull(),
    status: text("status", { enum: ["pending", "accepted", "rejected", "withdrawn", "superseded"] })
      .notNull()
      .default("pending"),
    respondedBy: uuid("responded_by").references(() => users.id),
    respondedAt: ts("responded_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("dispute_proposals_dispute_idx").on(t.disputeId, t.createdAt),
    check(
      "dispute_proposals_type_chk",
      sql`${t.type} IN ('no_compensation','repair','replace_accessory','partial_compensation','full_compensation','extra_return_time','other')`,
    ),
    check(
      "dispute_proposals_status_chk",
      sql`${t.status} IN ('pending','accepted','rejected','withdrawn','superseded')`,
    ),
    check("dispute_proposals_text_len", sql`char_length(${t.text}) BETWEEN 1 AND 2000`),
    check("dispute_proposals_amount_chk", sql`${t.amountOre} IS NULL OR ${t.amountOre} BETWEEN 0 AND 100000000`),
    check(
      "dispute_proposals_amount_required",
      sql`${t.type} NOT IN ('partial_compensation','full_compensation') OR ${t.amountOre} IS NOT NULL`,
    ),
    check("dispute_proposals_time_required", sql`${t.type} <> 'extra_return_time' OR ${t.newReturnAt} IS NOT NULL`),
    // Nobody can accept their own proposal (DISPUTE_POLICY §2 step 3).
    check("dispute_proposals_not_own", sql`${t.respondedBy} IS NULL OR ${t.respondedBy} <> ${t.proposerId}`),
  ],
);

/** Time-boxed, justified staff access to private material. Every use is audited. Append-only. */
export const supportAccessGrants = pgTable(
  "support_access_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => users.id),
    scope: text("scope", { enum: ["report_messages", "dispute", "condition_report"] }).notNull(),
    targetId: uuid("target_id").notNull(),
    reason: text("reason").notNull(),
    reportId: uuid("report_id").references(() => reports.id),
    disputeId: uuid("dispute_id").references(() => disputes.id),
    grantedAt: ts("granted_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [
    index("support_access_grants_lookup_idx").on(t.staffId, t.scope, t.targetId, t.expiresAt),
    check("support_access_grants_scope_chk", sql`${t.scope} IN ('report_messages','dispute','condition_report')`),
    check("support_access_grants_reason_len", sql`char_length(${t.reason}) BETWEEN 10 AND 500`),
    check("support_access_grants_link_chk", sql`${t.reportId} IS NOT NULL OR ${t.disputeId} IS NOT NULL`),
    check(
      "support_access_grants_window_chk",
      sql`${t.expiresAt} > ${t.grantedAt} AND ${t.expiresAt} <= ${t.grantedAt} + interval '30 days'`,
    ),
  ],
);

// ---------------------------------------------------------------- reviews

/** Two-sided, double-blind reviews of completed rentals (D-014): `sealed` until both wrote or the window ends. */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => users.id),
    authorRole: text("author_role", { enum: ["owner", "renter"] }).notNull(),
    ratingCommunication: smallint("rating_communication").notNull(),
    ratingPunctuality: smallint("rating_punctuality").notNull(),
    ratingAccuracy: smallint("rating_accuracy"), // renter → accuracy of the listing
    ratingItemCondition: smallint("rating_item_condition").notNull(),
    ratingAgreement: smallint("rating_agreement").notNull(),
    comment: text("comment"),
    status: text("status", { enum: ["sealed", "published", "removed"] })
      .notNull()
      .default("sealed"),
    createdAt: ts("created_at").notNull().defaultNow(),
    publishedAt: ts("published_at"),
  },
  (t) => [
    unique("reviews_booking_author_uq").on(t.bookingId, t.authorId),
    index("reviews_subject_idx").on(t.subjectId, t.status),
    check("reviews_not_self", sql`${t.authorId} <> ${t.subjectId}`),
    check("reviews_role_chk", sql`${t.authorRole} IN ('owner','renter')`),
    check("reviews_status_chk", sql`${t.status} IN ('sealed','published','removed')`),
    check(
      "reviews_ratings_chk",
      sql`${t.ratingCommunication} BETWEEN 1 AND 5 AND ${t.ratingPunctuality} BETWEEN 1 AND 5 AND ${t.ratingItemCondition} BETWEEN 1 AND 5 AND ${t.ratingAgreement} BETWEEN 1 AND 5 AND (${t.ratingAccuracy} IS NULL OR ${t.ratingAccuracy} BETWEEN 1 AND 5)`,
    ),
    check("reviews_accuracy_role", sql`(${t.authorRole} = 'renter') = (${t.ratingAccuracy} IS NOT NULL)`),
    check("reviews_comment_len", sql`char_length(${t.comment}) <= 1000`),
  ],
);

// ---------------------------------------------------------------- transparency («Åpenhet»)

/** Real monthly figures entered by the owner from invoices and payout statements. Never estimates. */
export const transparencyMonths = pgTable(
  "transparency_months",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    month: date("month").notNull().unique(), // first day of the month
    costTotalOre: ore("cost_total_ore").notNull(),
    costServerOre: ore("cost_server_ore"),
    costBackupOre: ore("cost_backup_ore"),
    costEmailOre: ore("cost_email_ore"),
    costDomainOre: ore("cost_domain_ore"),
    costOtherOre: ore("cost_other_ore"),
    supportReceivedOre: ore("support_received_ore"), // after fees; NULL = no campaign yet
    note: text("note"), // public
    sourceNote: text("source_note"), // internal: invoice numbers and payout references
    enteredBy: uuid("entered_by")
      .notNull()
      .references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check("transparency_month_first_day", sql`extract(day from ${t.month}) = 1`),
    check(
      "transparency_amounts_chk",
      sql`${t.costTotalOre} >= 0 AND coalesce(${t.costServerOre}, 0) >= 0 AND coalesce(${t.costBackupOre}, 0) >= 0 AND coalesce(${t.costEmailOre}, 0) >= 0 AND coalesce(${t.costDomainOre}, 0) >= 0 AND coalesce(${t.costOtherOre}, 0) >= 0 AND coalesce(${t.supportReceivedOre}, 0) >= 0`,
    ),
    check(
      "transparency_parts_le_total",
      sql`coalesce(${t.costServerOre}, 0) + coalesce(${t.costBackupOre}, 0) + coalesce(${t.costEmailOre}, 0) + coalesce(${t.costDomainOre}, 0) + coalesce(${t.costOtherOre}, 0) <= ${t.costTotalOre}`,
    ),
    check("transparency_note_len", sql`char_length(${t.note}) <= 500`),
    check("transparency_source_len", sql`char_length(${t.sourceNote}) <= 500`),
  ],
);
