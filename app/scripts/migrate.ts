/**
 * Apply SQL migrations in ./drizzle with the migration role (DATABASE_MIGRATION_URL).
 * Usage: npm run db:migrate
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_MIGRATION_URL;
  if (!url) throw new Error("DATABASE_MIGRATION_URL is not set");
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: "./drizzle" });
    console.log("Migrations applied.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
