import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const LEGAL_DOC_KEYS = [
  "terms",
  "privacy",
  "cookies",
  "rental_simple",
  "rental_extended",
  "giveaway_transfer",
  "dispute_guidelines",
  "prohibited_items",
  "safe_rental",
  "support_page",
] as const;
export type LegalDocKey = (typeof LEGAL_DOC_KEYS)[number];

const ts = (name: string) => timestamp(name, { withTimezone: true });

// Loaded from laandet/legal/** at deploy by the owner role (runtime role: SELECT only).
export const legalDocumentVersions = pgTable(
  "legal_document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    docKey: text("doc_key", { enum: LEGAL_DOC_KEYS }).notNull(),
    locale: text("locale", { enum: ["nb", "en"] }).notNull(),
    version: text("version").notNull(),
    isAuthoritative: boolean("is_authoritative").notNull(),
    isDraft: boolean("is_draft").notNull().default(true),
    materialChange: boolean("material_change").notNull().default(false),
    contentMd: text("content_md").notNull(),
    contentSha256: text("content_sha256").notNull(),
    publishedAt: ts("published_at"),
    effectiveAt: ts("effective_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("legal_doc_version_uq").on(t.docKey, t.locale, t.version, t.contentSha256),
    check("legal_sha_chk", sql`${t.contentSha256} ~ '^[0-9a-f]{64}$'`),
    check("legal_authoritative_chk", sql`${t.isAuthoritative} = (${t.locale} = 'nb')`),
  ],
);

// Append-only (runtime role: SELECT, INSERT only).
export const legalAcceptances = pgTable(
  "legal_acceptances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentVersionId: uuid("document_version_id")
      .notNull()
      .references(() => legalDocumentVersions.id),
    acceptedAt: ts("accepted_at").notNull().defaultNow(),
  },
  (t) => [unique("legal_acceptance_uq").on(t.userId, t.documentVersionId)],
);
