import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const REPORT_TARGETS = ["listing", "user", "message", "review", "dispute"] as const;
export const REPORT_REASONS = [
  "prohibited_item",
  "fraud_or_scam",
  "misleading",
  "harassment",
  "spam",
  "illegal_content",
  "privacy",
  "unsafe",
  "fake_review",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // NULL = automatic (keyword screening) or deleted reporter
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    isAutomatic: boolean("is_automatic").notNull().default(false),
    targetType: text("target_type", { enum: REPORT_TARGETS }).notNull(),
    targetId: uuid("target_id").notNull(),
    reason: text("reason", { enum: REPORT_REASONS }).notNull(),
    details: text("details"),
    attachedMessageIds: uuid("attached_message_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    status: text("status", { enum: ["open", "in_review", "actioned", "dismissed"] })
      .notNull()
      .default("open"),
    handledBy: uuid("handled_by").references(() => users.id),
    handledAt: ts("handled_at"),
    decisionNote: text("decision_note"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("reports_open_idx").on(t.status, t.createdAt),
    check("reports_details_len", sql`char_length(${t.details}) <= 2000`),
    check("reports_decision_len", sql`char_length(${t.decisionNote}) <= 2000`),
  ],
);

export const MODERATION_ACTIONS = [
  "listing_hidden",
  "listing_restored",
  "user_warned",
  "user_restricted",
  "user_suspended",
  "user_reinstated",
  "review_removed",
  "review_restored",
  "message_redacted",
] as const;

export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    targetType: text("target_type", { enum: ["listing", "user", "message", "review"] }).notNull(),
    targetId: uuid("target_id").notNull(),
    action: text("action", { enum: MODERATION_ACTIONS }).notNull(),
    reasonCode: text("reason_code").notNull(),
    statementOfReasons: text("statement_of_reasons").notNull(),
    reportId: uuid("report_id").references(() => reports.id),
    expiresAt: ts("expires_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("moderation_actions_target_idx").on(t.targetType, t.targetId),
    check("moderation_statement_len", sql`char_length(${t.statementOfReasons}) BETWEEN 10 AND 4000`),
  ],
);

export const appeals = pgTable(
  "appeals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moderationActionId: uuid("moderation_action_id")
      .notNull()
      .references(() => moderationActions.id),
    appellantId: uuid("appellant_id")
      .notNull()
      .references(() => users.id),
    text: text("text").notNull(),
    status: text("status", { enum: ["open", "upheld", "reversed"] })
      .notNull()
      .default("open"),
    decidedBy: uuid("decided_by").references(() => users.id),
    decisionText: text("decision_text"),
    decidedBySameStaff: boolean("decided_by_same_staff"),
    createdAt: ts("created_at").notNull().defaultNow(),
    decidedAt: ts("decided_at"),
  },
  (t) => [
    unique("appeals_once_uq").on(t.moderationActionId, t.appellantId),
    check("appeals_text_len", sql`char_length(${t.text}) BETWEEN 10 AND 4000`),
    check("appeals_decision_len", sql`char_length(${t.decisionText}) <= 4000`),
  ],
);
