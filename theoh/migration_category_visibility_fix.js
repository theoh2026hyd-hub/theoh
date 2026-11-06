require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

async function main() {
  const ref = process.env.SUPABASE_PROJECT_REF || (process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.NEXT_PUBLIC_SUPABASE_URL.replace("https://", "").split(".")[0] : "");
  const client = new Client({
    host: process.env.SUPABASE_POOLER_HOST || "aws-1-ap-northeast-2.pooler.supabase.com",
    port: 6543,
    database: "postgres",
    user: `postgres.${ref}`,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  // Keep addon taxonomy available for bowl toppings (frontend still hides them as menu tabs).
  await client.query(`
    UPDATE public.categories
    SET show_in_menu = true, show_section = false
    WHERE lower(trim(name)) IN (
      'fruits', 'nuts', 'seeds', 'oat bases', 'spreads', 'ingredients', 'bread & butter'
    );
  `);
  const { rows } = await client.query(
    "SELECT id, name, show_in_menu, show_section FROM categories ORDER BY id"
  );
  console.log(rows);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
