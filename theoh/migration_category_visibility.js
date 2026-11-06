require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

const pw = process.env.SUPABASE_DB_PASSWORD;
const ref = process.env.SUPABASE_PROJECT_REF || (process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.NEXT_PUBLIC_SUPABASE_URL.replace("https://", "").split(".")[0] : "");
const regions = [
  "ap-northeast-2",
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "eu-west-3",
  "sa-east-1",
  "ca-central-1",
];

async function main() {
  for (const region of regions) {
    for (const prefix of ["aws-0", "aws-1", "aws-2"]) {
      const host = `${prefix}-${region}.pooler.supabase.com`;
      const client = new Client({
        host,
        port: 6543,
        database: "postgres",
        user: `postgres.${ref}`,
        password: pw,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
      });
      try {
        await client.connect();
        console.log("CONNECTED", host);
        await client.query(`
          ALTER TABLE public.categories
            ADD COLUMN IF NOT EXISTS show_in_menu boolean NOT NULL DEFAULT true;
        `);
        await client.query(`
          ALTER TABLE public.categories
            ADD COLUMN IF NOT EXISTS show_section boolean NOT NULL DEFAULT false;
        `);
        await client.query(`
          UPDATE public.categories
          SET show_in_menu = false, show_section = false
          WHERE lower(trim(name)) IN (
            'fruits', 'nuts', 'seeds', 'oat bases', 'spreads', 'ingredients', 'bread & butter'
          );
        `);
        const { rows } = await client.query(
          "SELECT id, name, show_in_menu, show_section FROM categories ORDER BY id"
        );
        console.log(rows);
        await client.end();
        return;
      } catch (error) {
        const msg = String(error.message);
        if (msg.includes("password authentication failed")) {
          console.log("FOUND region (bad password):", host);
        } else if (!msg.includes("ENOTFOUND") && !msg.includes("timeout")) {
          console.log(host, msg.slice(0, 120));
        }
        try {
          await client.end();
        } catch {
          // ignore
        }
      }
    }
  }
  console.error("No pooler connection found");
  process.exit(1);
}

main();
