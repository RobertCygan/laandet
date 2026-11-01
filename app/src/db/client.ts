import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/modules/config/env";
import * as schema from "./schema";

// Runtime connection (role laandet_app). Shared across hot reloads in dev.
const globalForDb = globalThis as typeof globalThis & { __laandetPool?: Pool };

function pool(): Pool {
  globalForDb.__laandetPool ??= new Pool({
    connectionString: env().DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return globalForDb.__laandetPool;
}

export const db = drizzle({ client: pool(), schema, casing: "snake_case" });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;
