import { and, desc, eq } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { legalDocumentVersions, type LegalDocKey } from "@/db/schema";

export type LegalDoc = typeof legalDocumentVersions.$inferSelect;

/** The newest loaded version of a document in a locale (null if never loaded). */
export async function currentLegalDoc(
  db: DbOrTx,
  docKey: LegalDocKey,
  locale: "nb" | "en",
): Promise<LegalDoc | null> {
  const [row] = await db
    .select()
    .from(legalDocumentVersions)
    .where(and(eq(legalDocumentVersions.docKey, docKey), eq(legalDocumentVersions.locale, locale)))
    .orderBy(desc(legalDocumentVersions.createdAt))
    .limit(1);
  return row ?? null;
}
