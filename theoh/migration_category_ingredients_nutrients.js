/**
 * Per-category Ingredients / Nutrients display flags.
 * Run: node migration_category_ingredients_nutrients.js
 * Prefer applying via Supabase migration in production.
 */
require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

const pw = process.env.SUPABASE_DB_PASSWORD;
const ref = process.env.SUPABASE_PROJECT_REF || (process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.NEXT_PUBLIC_SUPABASE_URL.replace("https://", "").split(".")[0] : "");

async function main() {
  if (!pw) {
    console.error("SUPABASE_DB_PASSWORD missing in .env.local");
    process.exit(1);
  }

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
      ADD COLUMN IF NOT EXISTS show_ingredients boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS show_nutrients boolean NOT NULL DEFAULT true;
  `);

  await client.query(`
    UPDATE public.categories
    SET show_ingredients = true, show_nutrients = true
    WHERE show_ingredients IS DISTINCT FROM true
       OR show_nutrients IS DISTINCT FROM true;
  `);

  await client.query("NOTIFY pgrst, 'reload schema'");

  const { rows } = await client.query(`
    SELECT id, name, show_ingredients, show_nutrients
    FROM public.categories
    ORDER BY id
  `);
  console.log(JSON.stringify(rows, null, 2));
  await client.end();
  console.log("✅ Category ingredients/nutrients columns ready");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
