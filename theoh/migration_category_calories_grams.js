/**
 * Per-category Calories / Grams display flags.
 * Run: node migration_category_calories_grams.js
 */
require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

const pw = process.env.SUPABASE_DB_PASSWORD;
const ref = process.env.SUPABASE_PROJECT_REF || (process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.NEXT_PUBLIC_SUPABASE_URL.replace("https://", "").split(".")[0] : "");

async function main() {
  const client = new Client({
    host: "aws-1-ap-northeast-2.pooler.supabase.com",
    port: 6543,
    database: "postgres",
    user: `postgres.${ref}`,
    password: pw,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  await client.query(`
    ALTER TABLE public.categories
      ADD COLUMN IF NOT EXISTS show_calories boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS show_grams boolean NOT NULL DEFAULT true;
  `);

  // Ensure Cookies + Bread categories show grams/calories by default
  await client.query(`
    UPDATE public.categories
    SET show_calories = true, show_grams = true
    WHERE lower(name) LIKE '%cookie%'
       OR lower(name) LIKE '%bread%';
  `);

  await client.query("NOTIFY pgrst, 'reload schema'");

  const { rows } = await client.query(`
    SELECT id, name, show_calories, show_grams
    FROM public.categories
    ORDER BY id
  `);
  console.log(JSON.stringify(rows, null, 2));
  await client.end();
  console.log("✅ Category calories/grams columns ready");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
