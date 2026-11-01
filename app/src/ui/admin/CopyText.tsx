"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** A read-only text with a «Kopier» button (the daily Facebook post, D-064). */
export function CopyText({
  text,
  label,
  copyLabel,
  copiedLabel,
}: {
  text: string;
  label: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <label className="field">
        {label}
        <textarea
          readOnly
          value={text}
          rows={Math.min(28, text.split("\n").length + 2)}
          className="font-mono text-sm"
          onFocus={(e) => e.currentTarget.select()}
        />
      </label>
      <button
        type="button"
        className="button button-primary self-start"
        onClick={() => {
          navigator.clipboard?.writeText(text).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
        {copied ? copiedLabel : copyLabel}
      </button>
      <span role="status" className="visually-hidden">
        {copied ? copiedLabel : ""}
      </span>
    </div>
  );
}
