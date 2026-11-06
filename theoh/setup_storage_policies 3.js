require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

const ref = process.env.SUPABASE_PROJECT_REF || (process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.NEXT_PUBLIC_SUPABASE_URL.replace("https://", "").split(".")[0] : "");
const pw = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD || "");

if (!ref || !process.env.SUPABASE_DB_PASSWORD) {
  console.error("Missing SUPABASE_PROJECT_REF / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_DB_PASSWORD");
  process.exit(1);
}

(async () => {
  const host = process.env.SUPABASE_POOLER_HOST || "aws-1-ap-northeast-2.pooler.supabase.com";
  const c = new Client({
    connectionString: `postgresql://postgres.${ref}:${pw}@${host}:6543/postgres`,
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();
  await c.query(`
    DO $$ BEGIN
      CREATE POLICY "Public read product images"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'product-images');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await c.query(`
    DO $$ BEGIN
      CREATE POLICY "Authenticated upload product images"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'product-images');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await c.query(`
    DO $$ BEGIN
      CREATE POLICY "Authenticated update product images"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'product-images');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  console.log("storage policies ok");
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
