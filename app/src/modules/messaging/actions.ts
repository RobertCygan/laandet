"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { localePath } from "@/i18n/page";
import { getActor } from "@/modules/auth/actor";
import { formToObject, runAction, type ActionState } from "@/modules/server/action";
import { getConversation, pollConversation, type ThreadMessage } from "./queries";
import { blockUser, markRead, messageSchema, sendMessage, unblockUser } from "./service";

export type SentMessage = { conversationId: string; message: ThreadMessage | null };

/**
 * Send from a thread (returns the new message so the page can append it) or from a listing page
 * (opens the conversation).
 */
export async function sendMessageAction(
  _prev: ActionState<SentMessage>,
  form: FormData,
): Promise<ActionState<SentMessage>> {
  const raw = formToObject(form);
  const locale = raw.locale === "en" ? "en" : "nb";
  const result = await runAction(async () => {
    const actor = await getActor();
    const sent = await sendMessage(actor, messageSchema.parse(raw));
    const thread = raw.from === "thread" ? await pollConversation(actor, sent.conversationId, raw.after ?? "") : null;
    return { conversationId: sent.conversationId, message: thread?.find((m) => m.id === sent.messageId) ?? null };
  }, raw);
  if (result.status === "ok" && result.data && raw.from !== "thread") {
    redirect(localePath(locale, `/meldinger/${result.data.conversationId}`));
  }
  return result;
}

const pollSchema = z.object({ conversationId: z.uuid(), after: z.string().max(40) });

/** Called every 20 s by an open thread; also marks the thread as read. */
export async function pollMessagesAction(conversationId: string, after: string): Promise<ThreadMessage[]> {
  const input = pollSchema.safeParse({ conversationId, after });
  if (!input.success) return [];
  const actor = await getActor();
  const fresh = await pollConversation(actor, input.data.conversationId, input.data.after);
  if (!fresh) return [];
  if (fresh.length) await markRead(actor, input.data.conversationId);
  return fresh;
}

const blockFormSchema = z.object({
  userId: z.uuid(),
  conversationId: z.uuid(),
  op: z.enum(["block", "unblock"]),
  locale: z.enum(["nb", "en"]).default("nb"),
});

export async function blockAction(form: FormData): Promise<void> {
  const { userId, conversationId, op, locale } = blockFormSchema.parse(formToObject(form));
  const actor = await getActor();
  // Only from a thread the actor takes part in.
  if (!(await getConversation(actor, conversationId))) redirect(localePath(locale, "/meldinger"));
  if (op === "block") await blockUser(actor, { userId });
  else await unblockUser(actor, { userId });
  revalidatePath("/[locale]", "layout");
  // Back to the thread: it shows the block and lets the actor undo it.
  redirect(localePath(locale, `/meldinger/${conversationId}`));
}
