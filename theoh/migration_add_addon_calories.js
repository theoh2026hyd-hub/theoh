const ADDON_CALORIES_PER_100G = {
  Apple: 52,
  Banana: 89,
  Blackberry: 43,
  "Dragon Fruit": 60,
  Grapes: 69,
  "Mango (Seasonal)": 60,
  Muskmelon: 34,
  Mulberries: 43,
  Pomegranate: 83,
  Raspberries: 52,
  Strawberries: 32,
  "All Mix Nuts": 580,
  Almonds: 579,
  "Black Raisins": 299,
  Cashews: 553,
  Cranberries: 308,
  Dates: 282,
  "Green Raisins": 299,
  Hazelnuts: 628,
  Peanuts: 567,
  Walnuts: 654,
  "Chia Seeds": 486,
  "Pumpkin Seeds": 559,
  "Sunflower Seeds": 584,
  "Watermelon Seeds": 557,
};

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ALTER_SQL = `
ALTER TABLE product_addons ADD COLUMN IF NOT EXISTS calories DECIMAL(10, 2);
`;

async function ensureCaloriesColumn() {
  const { data, error } = await supabase
    .from("product_addons")
    .select("id, name, price, calories")
    .limit(1);

  if (error && error.message.includes("calories")) {
    console.log("\n❌ The calories column does NOT exist yet in product_addons.");
    console.log("Please run the following SQL in your Supabase SQL Editor:\n");
    console.log("------------------------------------------------------------");
    console.log(ALTER_SQL.trim());
    console.log("------------------------------------------------------------");
    console.log("\nAfter running the SQL above, re-run: node migration_add_addon_calories.js");
    return false;
  }

  if (error) {
    throw error;
  }

  console.log("✅ calories column exists on product_addons.");
  return true;
}

async function populateAddonCalories() {
  const { data: addons, error } = await supabase
    .from("product_addons")
    .select("id, name, price, calories")
    .order("id", { ascending: true });

  if (error) throw error;

  console.log(`Found ${addons.length} add-on rows. Updating calories per 100g...\n`);

  let updated = 0;
  let skipped = 0;

  for (const addon of addons) {
    const calories = ADDON_CALORIES_PER_100G[addon.name] ?? lookupByCaseInsensitive(addon.name);

    if (calories == null) {
      console.warn(`⚠️  No calorie reference for "${addon.name}" (id ${addon.id}) — skipped`);
      skipped += 1;
      continue;
    }

    if (parseFloat(addon.calories) === calories) {
      console.log(`• ${addon.name}: already ${calories} kcal/100g`);
      continue;
    }

    const { error: updateError } = await supabase
      .from("product_addons")
      .update({ calories })
      .eq("id", addon.id);

    if (updateError) {
      console.error(`❌ Failed to update ${addon.name} (id ${addon.id}):`, updateError.message);
    } else {
      console.log(`✅ ${addon.name} → ${calories} kcal/100g (+₹${parseFloat(addon.price).toFixed(2)})`);
      updated += 1;
    }
  }

  console.log(`\n🎉 Done. Updated ${updated} row(s), skipped ${skipped}.`);
}

function lookupByCaseInsensitive(name) {
  const trimmed = String(name || "").trim().toLowerCase();
  const match = Object.entries(ADDON_CALORIES_PER_100G).find(
    ([key]) => key.toLowerCase() === trimmed
  );
  return match ? match[1] : null;
}

async function run() {
  try {
    const ready = await ensureCaloriesColumn();
    if (!ready) return;
    await populateAddonCalories();
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

run();
