import { STORAGE_KEYS } from "./config";
import type {
  ResearchEvent,
  ResearchEventName,
  ResearchResponse,
} from "@/types";
export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("laanndet:storage"));
    return true;
  } catch {
    return false;
  }
}
export function track(
  name: ResearchEventName,
  data: ResearchEvent["data"] = {},
) {
  if (
    typeof window === "undefined" ||
    readLocal<boolean>(STORAGE_KEYS.tracking, true) === false
  )
    return;
  const events = readLocal<ResearchEvent[]>(STORAGE_KEYS.events, []);
  writeLocal(
    STORAGE_KEYS.events,
    [
      ...events,
      {
        id: crypto.randomUUID(),
        name,
        createdAt: new Date().toISOString(),
        data,
      },
    ].slice(-1500),
  );
}
export function saveSurvey(
  response: Omit<ResearchResponse, "id" | "createdAt">,
): boolean {
  const ok = writeLocal(STORAGE_KEYS.surveys, [
    ...readLocal<ResearchResponse[]>(STORAGE_KEYS.surveys, []),
    {
      ...response,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    },
  ]);
  if (ok)
    track("survey_completed", {
      purpose: response.purpose,
      delivery: response.delivery,
      distance: response.distance,
    });
  return ok;
}
export function saveInterest(contact: string, source: string): boolean {
  const ok = writeLocal(STORAGE_KEYS.interests, [
    ...readLocal<{ contact: string; source: string; createdAt: string }[]>(
      STORAGE_KEYS.interests,
      [],
    ),
    { contact, source, createdAt: new Date().toISOString() },
  ]);
  if (ok) track("launch_interest", { source });
  return ok;
}
export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
export function clearResearch() {
  Object.values(STORAGE_KEYS).forEach((k) => window.localStorage.removeItem(k));
  window.dispatchEvent(new Event("laanndet:storage"));
}
export function isContact(value: string) {
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ||
    /^\+?[\d\s()-]{8,18}$/.test(value.trim())
  );
}
