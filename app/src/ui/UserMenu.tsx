"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The signed-in person's menu in the header: name and avatar on the button, account links in a panel.
 * Escape and a click outside close it; focus returns to the button.
 */
export function UserMenu({
  name,
  avatar,
  label,
  unreadLabel,
  children,
}: {
  name: string;
  /** The avatar to show (an image or the initial). */
  avatar: ReactNode;
  /** Accessible name of the button, e.g. «Kontomeny». */
  label: string;
  /** Set when there is something unread; read out by screen readers next to the label. */
  unreadLabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={root} className="user-menu">
      <button
        ref={button}
        type="button"
        className="user-menu-button"
        aria-expanded={open}
        aria-controls="user-menu-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="user-menu-avatar-wrap">
          {avatar}
          {unreadLabel && <span className="user-menu-dot" aria-hidden="true" />}
        </span>
        <span className="user-menu-name">{name}</span>
        <ChevronDown size={16} aria-hidden="true" />
        <span className="visually-hidden">
          {label}
          {unreadLabel ? ` (${unreadLabel})` : ""}
        </span>
      </button>
      {open && (
        <div
          id="user-menu-panel"
          className="user-menu-panel"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          <nav aria-label={label} className="flex flex-col">
            {children}
          </nav>
        </div>
      )}
    </div>
  );
}
