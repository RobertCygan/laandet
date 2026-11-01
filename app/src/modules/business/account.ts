import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userProfiles } from "@/db/schema";
import { AppError } from "@/modules/errors";

/**
 * Renting and giving away stay between private people (D-063): a business account may post and
 * answer services and send messages, but not request rentals or claim give-aways.
 */
export async function assertPrivateAccount(userId: string): Promise<void> {
  const [p] = await db
    .select({ t: userProfiles.accountType })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId));
  if (p?.t === "business") throw new AppError("forbidden", "business_private_only");
}
