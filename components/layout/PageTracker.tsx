"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { track } from "@/lib/research";
export function PageTracker() {
  const path = usePathname();
  const last = useRef("");
  useEffect(() => {
    if (last.current !== path) {
      track("page_view", { path });
      last.current = path;
    }
  }, [path]);
  return null;
}
