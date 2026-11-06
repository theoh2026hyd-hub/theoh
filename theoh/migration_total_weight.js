/**
 * Add total_weight_g for cookie package weight (shown below price on storefront).
 * Run: node migration_total_weight.js
 */
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

async function tryConnect(config) {
  const client = new Client({
    ...config,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    console.log("CONNECTED", config.host || config.connectionString?.slice(0, 40));
    return client;
  } catch (error) {
    const msg = String(error.message || error);
    if (config.host) console.log(config.host, msg.slice(0, 120));
    try {
      await client.end();
    } catch {
      // ignore
    }
    return null;
  }
}

async function connectPg() {
  // Direct DB host (works on many Supabase projects)
  const direct = await tryConnect({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: pw,
  });
  if (direct) return direct;

  for (const region of regions) {
    for (const prefix of ["aws-0", "aws-1", "aws-2"]) {
      const host = `${prefix}-${region}.pooler.supabase.com`;
      const client = await tryConnect({
        host,
        port: 6543,
        database: "postgres",
        user: `postgres.${ref}`,
        password: pw,
      });
      if (client) return client;
    }
  }
  return null;
}

async function main() {
  if (!pw) {
    console.error("Missing SUPABASE_DB_PASSWORD in .env.local");
    process.exit(1);
  }

  const client = await connectPg();
  if (!client) {
    console.error(`No database connection for project ${ref}`);
    process.exit(1);
  }

  try {
    await client.query(`
      ALTER TABLE public.products
        ADD COLUMN IF NOT EXISTS total_weight_g DECIMAL(10, 2);
    `);
    console.log("✅ products.total_weight_g column ready on", ref);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
