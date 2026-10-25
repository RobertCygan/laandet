import { eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/db/client";
import { featureFlags } from "@/db/schema";

/** Feature flags (ARCHITECTURE.md §4.10). Defaults apply until seeded/changed by an admin. */
export const FLAG_DEFAULTS = {
  show_demo_listings: { enabled: true, description: "Vis eksempelannonser (merket «Eksempel»)" },
  high_value_preview: { enabled: false, description: "Vis gjenstander over 5 000 kr som forhåndsvisning uten utleie" },
  extended_agreements: {
    enabled: false,
    description: "Åpne utleie over 5 000 kr (krever BankID og depositumsordning)",
  },
  rentals_open: { enabled: false, description: "Åpne forespørsler og leieavtaler for «Leies ut»" },
  registrations_open: { enabled: true, description: "Tillat nye registreringer" },
  listings_open: { enabled: true, description: "Tillat nye annonser" },
  captcha_turnstile: { enabled: false, description: "CAPTCHA ved registrering" },
  passkeys: { enabled: false, description: "Innlogging med passnøkkel" },
} as const;

export type FlagKey = keyof typeof FLAG_DEFAULTS;

export async function isFlagEnabled(conn: DbOrTx, key: FlagKey): Promise<boolean> {
  const [row] = await conn
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(eq(featureFlags.key, key));
  return row?.enabled ?? FLAG_DEFAULTS[key].enabled;
}

/** For pages: the flag via the shared connection (pages never import the database directly). */
export function flagEnabled(key: FlagKey): Promise<boolean> {
  return isFlagEnabled(db, key);
}
