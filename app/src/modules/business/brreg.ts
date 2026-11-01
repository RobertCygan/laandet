import { env } from "@/modules/config/env";

/** The public Enhetsregisteret API (open data, no key). */
export const DEFAULT_BRREG_API_URL = "https://data.brreg.no/enhetsregisteret/api";
const TIMEOUT_MS = 6000;

/** Spaces and dots are allowed when typing («912 345 678»); stored as 9 digits. */
export function normaliseOrgNumber(raw: string): string {
  return raw.replace(/[\s.]/g, "");
}

/** Org numbers are 9 digits with a modulus-11 check digit (weights 3 2 7 6 5 4 3 2). */
export function isValidOrgNumber(orgNumber: string): boolean {
  if (!/^[89]\d{8}$/.test(orgNumber)) return false;
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(orgNumber[i]), 0);
  const rest = sum % 11;
  const check = rest === 0 ? 0 : 11 - rest;
  return check !== 10 && check === Number(orgNumber[8]);
}

export type BrregResult =
  | { ok: true; name: string }
  | { ok: false; reason: "org_number_invalid" | "org_not_found" | "org_not_active" | "brreg_unavailable" };

type Enhet = {
  organisasjonsnummer?: string;
  navn?: string;
  konkurs?: boolean;
  underAvvikling?: boolean;
  underTvangsavviklingEllerTvangsopplosning?: boolean;
  slettedato?: string;
};

/**
 * Looks the org number up in Enhetsregisteret (D-063). Only the registered name is kept.
 * Bankrupt, dissolving or deleted entities are refused; a network problem is reported as
 * such, so the person can try again later.
 */
export async function lookupOrganisation(orgNumber: string, apiUrl?: string): Promise<BrregResult> {
  if (!isValidOrgNumber(orgNumber)) return { ok: false, reason: "org_number_invalid" };
  const base = (apiUrl ?? env().BRREG_API_URL ?? DEFAULT_BRREG_API_URL).replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/enheter/${orgNumber}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "brreg_unavailable" };
  }
  if (res.status === 404) return { ok: false, reason: "org_not_found" };
  if (res.status === 410) return { ok: false, reason: "org_not_active" }; // deleted from the register
  if (!res.ok) return { ok: false, reason: "brreg_unavailable" };
  let body: Enhet;
  try {
    body = (await res.json()) as Enhet;
  } catch {
    return { ok: false, reason: "brreg_unavailable" };
  }
  if (body.organisasjonsnummer !== orgNumber || !body.navn) return { ok: false, reason: "brreg_unavailable" };
  if (body.konkurs || body.underAvvikling || body.underTvangsavviklingEllerTvangsopplosning || body.slettedato) {
    return { ok: false, reason: "org_not_active" };
  }
  return { ok: true, name: body.navn.trim().slice(0, 200) };
}
