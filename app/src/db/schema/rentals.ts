import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { listings, mediaObjects } from "./catalog";
import { legalDocumentVersions } from "./legal";

// Phase 02: conversations, rentals (bookings), giveaways, agreements, condition reports
// (DATA_MODEL.md §5–§6, RENTAL_AGREEMENTS.md, CONDITION_REPORTS.md). The exclusion constraint,
// the acceptance trigger and the append-only privileges are in drizzle/0004_rentals_rules.sql.

const ts = (name: string) => timestamp(name, { withTimezone: true });
const ore = (name: string) => bigint(name, { mode: "number" });
const tstzrange = customType<{ data: string }>({
  dataType() {
    return "tstzrange";
  },
});

export const HANDOVER_METHODS = ["pickup", "owner_delivery", "meet"] as const;
export type HandoverMethod = (typeof HANDOVER_METHODS)[number];

// ---------------------------------------------------------------- messaging

// One conversation per (listing, interested user). Requests and claims for that pair live in it.
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id),
    initiatorId: uuid("initiator_id")
      .notNull()
      .references(() => users.id),
    listingOwnerId: uuid("listing_owner_id")
      .notNull()
      .references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastMessageAt: ts("last_message_at").notNull().defaultNow(),
  },
  (t) => [
    unique("conversations_listing_initiator_uq").on(t.listingId, t.initiatorId),
    check("conversations_not_self", sql`${t.initiatorId} <> ${t.listingOwnerId}`),
  ],
);

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    lastReadAt: ts("last_read_at"),
    archivedAt: ts("archived_at"),
    // Email batching: at most one notice per conversation per 15 minutes (ARCHITECTURE §4.7).
    lastEmailedAt: ts("last_emailed_at"),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index("conversation_participants_user_idx").on(t.userId),
  ],
);

export const MESSAGE_KINDS = ["user", "system"] as const;

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => users.id), // NULL = system message
    kind: text("kind", { enum: MESSAGE_KINDS }).notNull().default("user"),
    body: text("body").notNull(),
    // A reply to «Ønskes leid» may point to one of the sender's own «Leies ut» listings (D-020).
    attachedListingId: uuid("attached_listing_id").references(() => listings.id),
    createdAt: ts("created_at").notNull().defaultNow(),
    redactedAt: ts("redacted_at"),
  },
  (t) => [
    index("messages_conversation_idx").on(t.conversationId, t.createdAt),
    check("messages_kind_chk", sql`${t.kind} IN ('user','system')`),
    check("messages_body_len", sql`char_length(${t.body}) BETWEEN 1 AND 4000`),
    check("messages_system_has_no_sender", sql`(${t.kind} = 'system') = (${t.senderId} IS NULL)`),
  ],
);

// ---------------------------------------------------------------- rentals

export const BOOKING_STATUSES = [
  "requested",
  "declined",
  "withdrawn",
  "expired",
  "accepted",
  "confirmed",
  "cancelled",
  "handed_over",
  "return_pending",
  "completed",
  "disputed",
  "not_returned",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// A rental request IS a booking in status 'requested' (D-013). Terms are a snapshot of the listing.
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    renterId: uuid("renter_id")
      .notNull()
      .references(() => users.id),
    status: text("status", { enum: BOOKING_STATUSES }).notNull().default("requested"),
    period: tstzrange("period").notNull(),
    valueCategory: text("value_category", { enum: ["A", "B"] }).notNull(),
    declaredValueOre: ore("declared_value_ore").notNull(),
    priceOre: ore("price_ore").notNull(),
    priceUnit: text("price_unit", { enum: ["hour", "day", "weekend", "week"] }).notNull(),
    units: integer("units").notNull(),
    totalPriceOre: ore("total_price_ore").notNull(),
    depositOre: ore("deposit_ore").notNull().default(0),
    handoverMethod: text("handover_method", { enum: HANDOVER_METHODS }).notNull(),
    returnMethod: text("return_method", { enum: HANDOVER_METHODS }).notNull(),
    deliveryFeeOre: ore("delivery_fee_ore"),
    meetingPlacePrivate: text("meeting_place_private"),
    ownerResponseDueAt: ts("owner_response_due_at").notNull(),
    agreementDueAt: ts("agreement_due_at"),
    decidedAt: ts("decided_at"),
    confirmedAt: ts("confirmed_at"),
    handedOverAt: ts("handed_over_at"),
    returnedAt: ts("returned_at"),
    completedAt: ts("completed_at"),
    cancelledAt: ts("cancelled_at"),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
    cancelReason: text("cancel_reason"),
    remindersSent: jsonb("reminders_sent").$type<string[]>().notNull().default([]),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("bookings_owner_idx").on(t.ownerId, t.status),
    index("bookings_renter_idx").on(t.renterId, t.status),
    index("bookings_listing_idx").on(t.listingId, t.status),
    check(
      "bookings_status_chk",
      sql`${t.status} IN ('requested','declined','withdrawn','expired','accepted','confirmed','cancelled','handed_over','return_pending','completed','disputed','not_returned')`,
    ),
    check(
      "bookings_period_chk",
      sql`NOT isempty(${t.period}) AND lower(${t.period}) IS NOT NULL AND upper(${t.period}) IS NOT NULL`,
    ),
    check("bookings_not_self", sql`${t.ownerId} <> ${t.renterId}`),
    check("bookings_value_category_chk", sql`${t.valueCategory} IN ('A','B')`),
    // MVP gate (D-011): category B can never be stored until a migration ships BankID + the deposit procedure.
    check("mvp_category_a_only", sql`${t.valueCategory} = 'A'`),
    check(
      "bookings_money_chk",
      sql`${t.declaredValueOre} > 0 AND ${t.priceOre} >= 0 AND ${t.totalPriceOre} >= 0 AND ${t.depositOre} >= 0 AND coalesce(${t.deliveryFeeOre}, 0) >= 0`,
    ),
    check("bookings_deposit_le_value", sql`${t.depositOre} <= ${t.declaredValueOre}`),
    check("bookings_units_chk", sql`${t.units} BETWEEN 1 AND 366`),
    check("bookings_price_unit_chk", sql`${t.priceUnit} IN ('hour','day','weekend','week')`),
    check(
      "bookings_methods_chk",
      sql`${t.handoverMethod} IN ('pickup','owner_delivery','meet') AND ${t.returnMethod} IN ('pickup','owner_delivery','meet')`,
    ),
    check("bookings_meeting_place_len", sql`char_length(${t.meetingPlacePrivate}) <= 200`),
    check("bookings_cancel_reason_len", sql`char_length(${t.cancelReason}) <= 500`),
  ],
);

// Domain history of every state change, shown to both parties. Append-only.
export const bookingEvents = pgTable(
  "booking_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    actorId: uuid("actor_id").references(() => users.id), // NULL = system (worker)
    event: text("event").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("booking_events_booking_idx").on(t.bookingId, t.createdAt)],
);

export const CLAIM_STATUSES = [
  "requested",
  "selected",
  "declined",
  "withdrawn",
  "cancelled",
  "expired",
  "transferred",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const giveawayClaims = pgTable(
  "giveaway_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id),
    giverId: uuid("giver_id")
      .notNull()
      .references(() => users.id),
    claimantId: uuid("claimant_id")
      .notNull()
      .references(() => users.id),
    status: text("status", { enum: CLAIM_STATUSES }).notNull().default("requested"),
    handoverMethod: text("handover_method", { enum: HANDOVER_METHODS }),
    selectedAt: ts("selected_at"),
    transferredAt: ts("transferred_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("giveaway_claims_listing_claimant_uq").on(t.listingId, t.claimantId),
    check("giveaway_claims_not_self", sql`${t.giverId} <> ${t.claimantId}`),
    check(
      "giveaway_claims_status_chk",
      sql`${t.status} IN ('requested','selected','declined','withdrawn','cancelled','expired','transferred')`,
    ),
    check(
      "giveaway_claims_method_chk",
      sql`${t.handoverMethod} IS NULL OR ${t.handoverMethod} IN ('pickup','owner_delivery','meet')`,
    ),
    // The giver can select only one claim at a time.
    uniqueIndex("giveaway_one_selected")
      .on(t.listingId)
      .where(sql`${t.status} IN ('selected','transferred')`),
  ],
);

// ---------------------------------------------------------------- agreements

export const agreementNumberSeq = pgSequence("agreement_number_seq");

export const CONTRACT_KINDS = ["rental_simple", "rental_extended", "giveaway_transfer"] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];

// Rendered agreement / transfer-confirmation snapshots. The runtime role may update only
// status and superseded_at (column privileges in 0004).
export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind", { enum: CONTRACT_KINDS }).notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id),
    giveawayClaimId: uuid("giveaway_claim_id").references(() => giveawayClaims.id),
    templateVersionId: uuid("template_version_id")
      .notNull()
      .references(() => legalDocumentVersions.id),
    agreementNumber: text("agreement_number").notNull().unique(),
    revision: integer("revision").notNull().default(1),
    terms: jsonb("terms").$type<Record<string, unknown>>().notNull(),
    renderedText: text("rendered_text").notNull(),
    renderedSha256: text("rendered_sha256").notNull(),
    status: text("status", { enum: ["pending_acceptance", "accepted", "superseded", "void"] })
      .notNull()
      .default("pending_acceptance"),
    createdAt: ts("created_at").notNull().defaultNow(),
    supersededAt: ts("superseded_at"),
  },
  (t) => [
    check("contracts_kind_chk", sql`${t.kind} IN ('rental_simple','rental_extended','giveaway_transfer')`),
    check("contracts_revision_chk", sql`${t.revision} >= 1`),
    check("contracts_sha_chk", sql`${t.renderedSha256} ~ '^[0-9a-f]{64}$'`),
    check("contracts_status_chk", sql`${t.status} IN ('pending_acceptance','accepted','superseded','void')`),
    check("contracts_one_parent", sql`(${t.bookingId} IS NULL) <> (${t.giveawayClaimId} IS NULL)`),
    check("contracts_giveaway_kind", sql`(${t.kind} = 'giveaway_transfer') = (${t.giveawayClaimId} IS NOT NULL)`),
    uniqueIndex("contracts_booking_revision_uq")
      .on(t.bookingId, t.revision)
      .where(sql`${t.bookingId} IS NOT NULL`),
    uniqueIndex("contracts_one_live_per_booking")
      .on(t.bookingId)
      .where(sql`${t.bookingId} IS NOT NULL AND ${t.status} IN ('pending_acceptance','accepted')`),
    uniqueIndex("contracts_one_live_per_claim")
      .on(t.giveawayClaimId)
      .where(sql`${t.giveawayClaimId} IS NOT NULL AND ${t.status} IN ('pending_acceptance','accepted')`),
  ],
);

export const PARTY_ROLES = ["owner", "renter", "giver", "recipient"] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];

// Each party's acceptance of one exact text (hash). Append-only; a trigger re-checks hash and party.
export const contractAcceptances = pgTable(
  "contract_acceptances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    partyRole: text("party_role", { enum: PARTY_ROLES }).notNull(),
    acceptedSha256: text("accepted_sha256").notNull(),
    acceptedAt: ts("accepted_at").notNull().defaultNow(),
  },
  (t) => [
    unique("contract_acceptances_user_uq").on(t.contractId, t.userId),
    unique("contract_acceptances_role_uq").on(t.contractId, t.partyRole),
    check("contract_acceptances_role_chk", sql`${t.partyRole} IN ('owner','renter','giver','recipient')`),
  ],
);

// ---------------------------------------------------------------- condition reports

export const REPORT_PHASES = ["handover", "return"] as const;
export type ReportPhase = (typeof REPORT_PHASES)[number];
export const RETURN_OUTCOMES = [
  "returned_ok",
  "returned_normal_wear",
  "returned_with_deviation",
  "return_disputed",
  "not_returned",
] as const;
export type ReturnOutcome = (typeof RETURN_OUTCOMES)[number];

export const conditionReports = pgTable(
  "condition_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    phase: text("phase", { enum: REPORT_PHASES }).notNull(),
    status: text("status", { enum: ["open", "agreed", "contested", "lapsed"] })
      .notNull()
      .default("open"),
    returnOutcome: text("return_outcome", { enum: RETURN_OUTCOMES }),
    actualReturnedAt: ts("actual_returned_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    closedAt: ts("closed_at"),
  },
  (t) => [
    unique("condition_reports_booking_phase_uq").on(t.bookingId, t.phase),
    check("condition_reports_phase_chk", sql`${t.phase} IN ('handover','return')`),
    check("condition_reports_status_chk", sql`${t.status} IN ('open','agreed','contested','lapsed')`),
    check(
      "condition_reports_outcome_chk",
      sql`${t.returnOutcome} IS NULL OR ${t.returnOutcome} IN ('returned_ok','returned_normal_wear','returned_with_deviation','return_disputed','not_returned')`,
    ),
    check(
      "condition_reports_return_fields",
      sql`${t.phase} = 'return' OR (${t.returnOutcome} IS NULL AND ${t.actualReturnedAt} IS NULL)`,
    ),
  ],
);

export const ITEM_CONDITION_VALUES = ["new", "as_new", "good", "fair", "worn", "defective"] as const;
export const FUNCTIONAL_STATUSES = ["works", "works_with_remarks", "not_working", "not_tested"] as const;
export type FunctionalStatus = (typeof FUNCTIONAL_STATUSES)[number];
export const CLEANLINESS = ["clean", "acceptable", "needs_cleaning"] as const;

// Each party's own observations. Never updated; a correction supersedes the author's own entry. Append-only.
export const conditionEntries = pgTable(
  "condition_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => conditionReports.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    authorRole: text("author_role", { enum: ["owner", "renter"] }).notNull(),
    seq: integer("seq").notNull(),
    supersedesEntryId: uuid("supersedes_entry_id"),
    overallCondition: text("overall_condition", { enum: ITEM_CONDITION_VALUES }),
    functionalStatus: text("functional_status", { enum: FUNCTIONAL_STATUSES }),
    existingDamage: text("existing_damage"),
    newDamage: text("new_damage"),
    accessories: jsonb("accessories").$type<{ name: string; present: boolean }[]>().notNull().default([]),
    fuelOrBattery: text("fuel_or_battery"),
    cleanliness: text("cleanliness", { enum: CLEANLINESS }),
    serialOrIdentifier: text("serial_or_identifier"),
    // Return entries only: the author's proposed outcome (CONDITION_REPORTS §5).
    proposedOutcome: text("proposed_outcome", { enum: RETURN_OUTCOMES }),
    notes: text("notes"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("condition_entries_report_seq_uq").on(t.reportId, t.seq),
    check("condition_entries_role_chk", sql`${t.authorRole} IN ('owner','renter')`),
    check("condition_entries_seq_chk", sql`${t.seq} >= 1`),
    check(
      "condition_entries_condition_chk",
      sql`${t.overallCondition} IS NULL OR ${t.overallCondition} IN ('new','as_new','good','fair','worn','defective')`,
    ),
    check(
      "condition_entries_functional_chk",
      sql`${t.functionalStatus} IS NULL OR ${t.functionalStatus} IN ('works','works_with_remarks','not_working','not_tested')`,
    ),
    check(
      "condition_entries_cleanliness_chk",
      sql`${t.cleanliness} IS NULL OR ${t.cleanliness} IN ('clean','acceptable','needs_cleaning')`,
    ),
    check(
      "condition_entries_text_len",
      sql`coalesce(char_length(${t.existingDamage}), 0) <= 2000 AND coalesce(char_length(${t.newDamage}), 0) <= 2000 AND coalesce(char_length(${t.notes}), 0) <= 2000 AND coalesce(char_length(${t.fuelOrBattery}), 0) <= 100 AND coalesce(char_length(${t.serialOrIdentifier}), 0) <= 100`,
    ),
  ],
);

export const conditionPhotos = pgTable(
  "condition_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => conditionEntries.id),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => mediaObjects.id)
      .unique(),
    caption: text("caption"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [check("condition_photos_caption_len", sql`char_length(${t.caption}) <= 150`)],
);

// A confirmation is valid only for the entries that existed when it was made. Append-only.
export const conditionConfirmations = pgTable(
  "condition_confirmations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => conditionReports.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    partyRole: text("party_role", { enum: ["owner", "renter"] }).notNull(),
    decision: text("decision", { enum: ["confirm", "contest"] }).notNull(),
    checklist: jsonb("checklist").$type<Record<string, boolean>>().notNull().default({}),
    comment: text("comment"),
    latestEntrySeq: integer("latest_entry_seq").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("condition_confirmations_report_idx").on(t.reportId, t.createdAt),
    check("condition_confirmations_role_chk", sql`${t.partyRole} IN ('owner','renter')`),
    check("condition_confirmations_decision_chk", sql`${t.decision} IN ('confirm','contest')`),
    check("condition_confirmations_comment_len", sql`char_length(${t.comment}) <= 2000`),
  ],
);

// ---------------------------------------------------------------- disputes (opened in Phase 02, handled in P03-01)

export const DISPUTE_CATEGORIES = [
  "damaged",
  "not_returned",
  "not_as_described",
  "missing_accessories",
  "late_return",
  "payment_disagreement",
  "deposit_disagreement",
  "unsafe_equipment",
  "other",
] as const;

export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    openedBy: uuid("opened_by")
      .notNull()
      .references(() => users.id),
    respondentId: uuid("respondent_id")
      .notNull()
      .references(() => users.id),
    category: text("category", { enum: DISPUTE_CATEGORIES }).notNull(),
    status: text("status", {
      enum: [
        "awaiting_response",
        "in_negotiation",
        "support_review",
        "awaiting_documentation",
        "resolved_by_agreement",
        "withdrawn",
        "closed_without_agreement",
        "referred_to_insurer",
        "referred_to_authority",
      ],
    })
      .notNull()
      .default("awaiting_response"),
    summary: text("summary").notNull(),
    responseDueAt: ts("response_due_at").notNull(),
    escalatedAt: ts("escalated_at"),
    escalatedBy: uuid("escalated_by").references(() => users.id),
    assignedModeratorId: uuid("assigned_moderator_id").references(() => users.id),
    openedAt: ts("opened_at").notNull().defaultNow(),
    closedAt: ts("closed_at"),
    closureNote: text("closure_note"),
    // Opened after the recommended Laandet deadline: still accepted, but marked (DISPUTE_POLICY §3).
    reportedLate: boolean("reported_late").notNull().default(false),
    reopenedAt: ts("reopened_at"),
  },
  (t) => [
    check("disputes_not_self", sql`${t.openedBy} <> ${t.respondentId}`),
    check("disputes_summary_len", sql`char_length(${t.summary}) BETWEEN 10 AND 4000`),
    check("disputes_closure_note_len", sql`char_length(${t.closureNote}) <= 4000`),
    check(
      "disputes_category_chk",
      sql`${t.category} IN ('damaged','not_returned','not_as_described','missing_accessories','late_return','payment_disagreement','deposit_disagreement','unsafe_equipment','other')`,
    ),
    check(
      "disputes_status_chk",
      sql`${t.status} IN ('awaiting_response','in_negotiation','support_review','awaiting_documentation','resolved_by_agreement','withdrawn','closed_without_agreement','referred_to_insurer','referred_to_authority')`,
    ),
    // One open case per booking at a time.
    uniqueIndex("disputes_one_open_per_booking")
      .on(t.bookingId)
      .where(sql`${t.status} IN ('awaiting_response','in_negotiation','support_review','awaiting_documentation')`),
  ],
);
