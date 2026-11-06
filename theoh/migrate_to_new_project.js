/**
 * Migrate THE_OH schema + data into the Supabase project from .env.local
 *
 * Needs either:
 *   SUPABASE_DB_PASSWORD=...   (Project Settings > Database > Database password)
 * or
 *   DATABASE_URL=postgresql://postgres.[ref]:[password]@...
 *
 * Usage: node migrate_to_new_project.js
 */
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const NEW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;

if (!NEW_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const ref = NEW_URL.replace("https://", "").split(".")[0];
const dumpDir = path.join(__dirname, "migration_dump");

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dumpDir, name), "utf8"));
}

async function connectPg(pg) {
  if (!DB_PASSWORD && !DATABASE_URL) {
    throw new Error(
      "Add SUPABASE_DB_PASSWORD to .env.local (Dashboard > Project Settings > Database > Database password), then re-run."
    );
  }

  const candidates = [];
  if (DATABASE_URL) candidates.push(DATABASE_URL);

  const password = encodeURIComponent(DB_PASSWORD || "");
  const regions = [
    "ap-northeast-2",
    "ap-south-1",
    "ap-southeast-1",
    "ap-northeast-1",
    "us-east-1",
    "us-west-1",
    "eu-west-1",
    "eu-central-1",
    "ap-southeast-2"
  ];
  for (const prefix of ["aws-1", "aws-0", "aws-2"]) {
    for (const region of regions) {
      candidates.push(
        `postgresql://postgres.${ref}:${password}@${prefix}-${region}.pooler.supabase.com:6543/postgres`
      );
      candidates.push(
        `postgresql://postgres.${ref}:${password}@${prefix}-${region}.pooler.supabase.com:5432/postgres`
      );
    }
  }

  let lastError = null;
  for (const connectionString of candidates) {
    const client = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000
    });
    try {
      await client.connect();
      console.log("Connected via", connectionString.replace(password, "***").split("@")[1]);
      return client;
    } catch (err) {
      lastError = err;
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
  }
  throw new Error(
    `Could not connect to Postgres. Last error: ${lastError?.message || lastError}`
  );
}

async function runSchemaWithPg() {
  let pg;
  try {
    pg = require("pg");
  } catch {
    console.log("Installing pg...");
    require("child_process").execSync("npm install pg --no-save", { stdio: "inherit" });
    pg = require("pg");
  }

  const client = await connectPg(pg);
  const schemaSql = fs.readFileSync(path.join(dumpDir, "01_schema.sql"), "utf8");
  console.log("Creating tables on new project...");
  await client.query(schemaSql);
  await client.end();
  console.log("Schema created.");
  return pg;
}

async function upsert(supabase, table, rows, options = {}) {
  if (!rows?.length) {
    console.log(`  ${table}: 0 rows`);
    return;
  }
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, options);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length} rows`);
}

async function resetSequences(pg) {
  const client = await connectPg(pg);
  await client.query(`
    SELECT setval(pg_get_serial_sequence('categories','id'), COALESCE((SELECT MAX(id) FROM categories), 1));
    SELECT setval(pg_get_serial_sequence('products','id'), COALESCE((SELECT MAX(id) FROM products), 1));
    SELECT setval(pg_get_serial_sequence('product_addons','id'), COALESCE((SELECT MAX(id) FROM product_addons), 1));
    SELECT setval(pg_get_serial_sequence('order_items','id'), COALESCE((SELECT MAX(id) FROM order_items), 1));
    SELECT setval(pg_get_serial_sequence('admin_order_logs','id'), COALESCE((SELECT MAX(id) FROM admin_order_logs), 1));
    SELECT setval(pg_get_serial_sequence('contact_submissions','id'), COALESCE((SELECT MAX(id) FROM contact_submissions), 1));
  `);
  await client.end();
  console.log("Sequences updated.");
}

async function main() {
  console.log("Target:", NEW_URL);

  let pg;
  try {
    pg = require("pg");
  } catch {
    console.log("Installing pg...");
    require("child_process").execSync("npm install pg --no-save", { stdio: "inherit" });
    pg = require("pg");
  }

  const client = await connectPg(pg);
  const fullSqlPath = path.join(dumpDir, "FULL_MIGRATION.sql");
  if (!fs.existsSync(fullSqlPath)) {
    require("child_process").execSync("node generate_full_migration_sql.js", {
      stdio: "inherit",
      cwd: __dirname
    });
  }
  const fullSql = fs.readFileSync(fullSqlPath, "utf8");
  console.log("Applying full schema + data SQL...");
  await client.query(fullSql);
  try {
    await client.query("NOTIFY pgrst, 'reload schema'");
  } catch {
    /* ignore */
  }
  await client.end();
  console.log("SQL applied.");

  // Give PostgREST a moment to refresh
  await new Promise((r) => setTimeout(r, 2500));

  const supabase = createClient(NEW_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const counts = {};
  for (const table of [
    "categories",
    "products",
    "product_addons",
    "settings",
    "coupons",
    "coin_wallet",
    "orders",
    "order_items",
    "admin_order_logs",
    "user_details",
    "upcoming_items",
    "contact_submissions"
  ]) {
    let lastErr = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      if (!error) {
        counts[table] = count;
        lastErr = null;
        break;
      }
      lastErr = error.message;
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (lastErr) counts[table] = `ERR ${lastErr}`;
  }

  // Also verify via pg in case REST cache is slow
  const verifyClient = await connectPg(pg);
  const pgCounts = {};
  for (const table of Object.keys(counts)) {
    const { rows } = await verifyClient.query(`SELECT count(*)::int AS n FROM ${table}`);
    pgCounts[table] = rows[0].n;
  }
  await verifyClient.end();

  console.log("\nPostgres counts:", pgCounts);
  console.log("API counts:", counts);
  console.log("\nMigration complete.");
}

main().catch((err) => {
  console.error("\nMigration failed:", err.message);
  process.exit(1);
});
