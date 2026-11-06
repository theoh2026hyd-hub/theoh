/**
 * Add cookie nutrition columns and seed Chocolate Chip / Cherry Oats Crunch / Nutty Pecan.
 * Run: node migration_cookie_nutrition.js
 */
require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");

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

const COOKIE_NUTRITION = [
  {
    match: /chocolate\s*chip/i,
    serving_size: 2,
    serving_weight_g: 40,
    fats: 14,
    protein: 4,
    saturated_fat: 4.6,
    carbohydrates: 28,
    sugar: 8,
    dietary_fibre: 3,
    sodium_mg: 82,
    ingredients:
      "Bittersweet chocolate chips, Cocoa butter, Cocoa powder, Molasses, Unsalted butter, Organic brown sugar, Oat flour, Brown rice flour, Tapioca flour, Corn starch, Vanilla extract, Xanthan gum, Baking soda, Sea salt.",
  },
  {
    match: /cherry\s*oats\s*crunch/i,
    serving_size: 2,
    serving_weight_g: 40,
    fats: 12,
    protein: 4,
    saturated_fat: 4.1,
    carbohydrates: 23,
    sugar: 8,
    dietary_fibre: 3,
    sodium_mg: 88,
    ingredients:
      "Rolled oats, Montmorency tart cherries, Unsalted butter, Organic brown sugar, white chocolate, Oat flour, Tapioca flour, Cornstarch, Brown rice flour, Xanthan gum, Baking soda, Vanilla extract, Sea salt.",
  },
  {
    match: /nutty\s*pecan/i,
    serving_size: 2,
    serving_weight_g: 40,
    fats: 11,
    protein: 3,
    saturated_fat: 4.2,
    carbohydrates: 22,
    sugar: 8,
    dietary_fibre: 2,
    sodium_mg: 90,
    ingredients:
      "Molasses, Unsalted butter, Olive oil, Organic brown sugar, Oat flour, Brown rice flour, Rolled Oats, Corn flakes, Corn flour, Pear juice, Concentrate, Pecans, Unsweetened coconut, Tapioca flour, Corn starch, Vanilla extract, Baking soda, Xanthan gum, sea salt.",
  },
  {
    match: /berries\s*walnut\s*oats\s*crunch/i,
    serving_size: 2,
    serving_weight_g: 40,
    fats: 12,
    protein: 4,
    saturated_fat: 4.1,
    carbohydrates: 23,
    sugar: 8,
    dietary_fibre: 3,
    sodium_mg: 88,
    ingredients:
      "Molasses, Organic brown sugar, Unsalted butter, Dried cranberries, Walnuts, Rolled oats, Oat flour, Unsweetened coconut, Tapioca flour, Brown rice flour, Cornstarch, Vanilla extract, Xanthan gum, Baking soda, Sea salt.",
  },
];

async function connectPg() {
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
        return client;
      } catch (error) {
        const msg = String(error.message);
        if (!msg.includes("ENOTFOUND") && !msg.includes("timeout")) {
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
  return null;
}

async function main() {
  const client = await connectPg();
  if (!client) {
    console.error("No pooler connection found");
    process.exit(1);
  }

  try {
    await client.query(`
      ALTER TABLE public.products
        ADD COLUMN IF NOT EXISTS serving_size DECIMAL(10, 2),
        ADD COLUMN IF NOT EXISTS serving_weight_g DECIMAL(10, 2),
        ADD COLUMN IF NOT EXISTS saturated_fat DECIMAL(10, 2),
        ADD COLUMN IF NOT EXISTS sugar DECIMAL(10, 2),
        ADD COLUMN IF NOT EXISTS dietary_fibre DECIMAL(10, 2),
        ADD COLUMN IF NOT EXISTS sodium_mg DECIMAL(10, 2);
    `);
    console.log("✅ Cookie nutrition columns ready");
  } finally {
    await client.end();
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: cats, error: catError } = await supabase
    .from("categories")
    .select("id, name")
    .ilike("name", "%cookie%");
  if (catError) throw catError;

  const cookieCatIds = (cats || []).map((c) => c.id);
  let query = supabase.from("products").select("id, name, category_id");
  if (cookieCatIds.length) {
    query = query.in("category_id", cookieCatIds);
  }
  const { data: products, error: prodError } = await query;
  if (prodError) throw prodError;

  console.log(`Found ${(products || []).length} cookie products`);

  for (const product of products || []) {
    const spec = COOKIE_NUTRITION.find((entry) => entry.match.test(product.name));
    if (!spec) {
      console.log(`⏭ Skip (no seed match): ${product.name}`);
      continue;
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({
        serving_size: spec.serving_size,
        serving_weight_g: spec.serving_weight_g,
        fats: spec.fats,
        protein: spec.protein,
        saturated_fat: spec.saturated_fat,
        carbohydrates: spec.carbohydrates,
        sugar: spec.sugar,
        dietary_fibre: spec.dietary_fibre,
        sodium_mg: spec.sodium_mg,
        ingredients: spec.ingredients,
      })
      .eq("id", product.id);

    if (updateError) {
      console.error(`❌ ${product.name}:`, updateError.message);
    } else {
      console.log(`✅ Updated ${product.name} (id ${product.id})`);
    }
  }

  console.log("\n🎉 Cookie nutrition migration complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
