"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/i18n/format";
import { pollMessagesAction, sendMessageAction } from "@/modules/messaging/actions";
import type { ThreadMessage } from "@/modules/messaging/queries";
import { MESSAGE_MAX_LENGTH, paymentWarning } from "@/modules/messaging/rules";
import { idle } from "@/modules/server/action";
import { FieldError } from "@/ui/forms/FormMessages";
import { ReportForm } from "@/ui/listings/ListingActions";
import { Notice } from "@/ui/Notice";
import { MessagingFormError } from "./MessagingFormError";

const POLL_MS = 20_000;

function merge(current: ThreadMessage[], incoming: ThreadMessage[]): ThreadMessage[] {
  if (!incoming.length) return current;
  const seen = new Set(current.map((m) => m.id));
  const added = incoming.filter((m) => !seen.has(m.id));
  return added.length ? [...current, ...added] : current;
}

/**
 * An open conversation: messages as plain React text (no Markdown, no links made from text),
 * new messages every 20 s while the tab is visible, and the reply form.
 */
export function ThreadClient({
  conversationId,
  meId,
  initialMessages,
  canSend,
  locale,
}: {
  conversationId: string;
  meId: string;
  initialMessages: ThreadMessage[];
  canSend: boolean;
  locale: "nb" | "en";
}) {
  const t = useTranslations("inbox");
  const [msgs, setMsgs] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [state, dispatch, pending] = useActionState(sendMessageAction, idle);
  const listRef = useRef<HTMLOListElement>(null);
  const lastIso = msgs.at(-1)?.createdAt ?? new Date(0).toISOString();

  // After a successful send: show the message at once and clear the field (adjusting state during render).
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "ok") {
      setDraft("");
      if (state.data?.message) setMsgs((m) => merge(m, [state.data!.message!]));
    }
  }

  useEffect(() => {
    let stopped = false;
    const poll = () => {
      if (document.visibilityState !== "visible") return;
      void pollMessagesAction(conversationId, lastIso).then((fresh) => {
        if (!stopped && fresh.length) setMsgs((m) => merge(m, fresh));
      });
    };
    const timer = window.setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [conversationId, lastIso]);

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [msgs.length]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  }

  return (
    <div className="flex flex-col gap-4">
      {msgs.length === 0 ? (
        <p className="text-muted">{t("noMessages")}</p>
      ) : (
        <ol ref={listRef} className="flex flex-col gap-3" aria-live="polite">
          {msgs.map((m) => {
            const mine = m.senderId === meId;
            if (m.kind === "system") {
              const key = `system.${m.body}`;
              return (
                <li key={m.id} className="text-center text-sm text-muted">
                  <span>{t.has(key) ? t(key as "system.unknown") : t("system.unknown")}</span>{" "}
                  <time dateTime={m.createdAt}>{formatDateTime(new Date(m.createdAt), locale)}</time>
                </li>
              );
            }
            return (
              <li key={m.id} className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2 ${mine ? "bg-primary text-white" : "border border-border bg-elevated"}`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  {m.attachedListing && (
                    <p className="mt-2 text-sm">
                      {t("attachedListing")}:{" "}
                      <Link
                        href={`/annonse/${m.attachedListing.id}`}
                        className={mine ? "font-bold underline" : "text-link"}
                      >
                        {m.attachedListing.title}
                      </Link>
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted">
                  {mine ? `${t("you")} · ` : ""}
                  <time dateTime={m.createdAt}>{formatDateTime(new Date(m.createdAt), locale)}</time>
                </span>
                {!mine && m.warning && (
                  <div className="max-w-[85%] text-sm">
                    <Notice tone="warning">{t("paymentWarningReader")}</Notice>
                  </div>
                )}
                {!mine && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted">{t("report")}</summary>
                    <div className="mt-2 max-w-md">
                      <ReportForm targetType="message" targetId={m.id} />
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {canSend && (
        <form onSubmit={onSubmit} method="post" className="card flex flex-col gap-3 p-4">
          <MessagingFormError state={state} />
          <input type="hidden" name="conversationId" value={conversationId} />
          <input type="hidden" name="from" value="thread" />
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="after" value={lastIso} />
          <label className="field">
            {t("writeLabel")}
            <span className="field-hint">{t("writeHint")}</span>
            <textarea
              name="body"
              rows={3}
              maxLength={MESSAGE_MAX_LENGTH}
              required
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <FieldError state={state} name="body" />
          </label>
          {paymentWarning(draft) && <Notice tone="warning">{t("paymentWarningSender")}</Notice>}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted">{t("pollNote")}</span>
            <button type="submit" className="button button-primary" disabled={pending || !draft.trim()}>
              {pending ? t("sending") : t("send")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
