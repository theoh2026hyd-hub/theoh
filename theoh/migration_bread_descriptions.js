/**
 * Bread items: remove "toasted", append "with butter and banana".
 * Run: node migration_bread_descriptions.js
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or service/anon key in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

function rewriteBreadDescription(description = "") {
  const raw = String(description || "");
  const metaMatch = raw.match(/(\s*\|\|[\s\S]*)$/);
  const meta = metaMatch ? metaMatch[1] : "";
  let clean = metaMatch ? raw.slice(0, metaMatch.index).trim() : raw.trim();

  // Remove toasted wording (keep surrounding punctuation tidy)
  clean = clean
    .replace(/\bsliced\s+and\s+toasted\b/gi, "sliced")
    .replace(/\band\s+toasted\b/gi, "")
    .replace(/\btoasted\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/\.\s*\./g, ".")
    .replace(/\s+\./g, ".")
    .trim()
    .replace(/,$/, "");

  if (!/\bwith\s+butter\s+and\s+banana\b/i.test(clean)) {
    if (clean.endsWith(".")) {
      clean = `${clean.slice(0, -1)}, with butter and banana.`;
    } else if (clean) {
      clean = `${clean}, with butter and banana.`;
    } else {
      clean = "With butter and banana.";
    }
  }

  return `${clean}${meta}`.trim();
}

async function main() {
  const { data: categories, error: catError } = await supabase
    .from("categories")
    .select("id, name");
  if (catError) throw catError;

  const breadCategoryIds = (categories || [])
    .filter((c) => {
      const n = String(c.name || "").toLowerCase();
      return n.includes("bread");
    })
    .map((c) => c.id);

  console.log("Bread categories:", breadCategoryIds);

  let query = supabase.from("products").select("id, name, description, category_id");
  if (breadCategoryIds.length > 0) {
    query = query.in("category_id", breadCategoryIds);
  } else {
    query = query.ilike("name", "%bread%");
  }

  const { data: products, error } = await query;
  if (error) throw error;

  const targets = (products || []).filter((p) => {
    const name = String(p.name || "").toLowerCase();
    return name.includes("bread") || breadCategoryIds.includes(p.category_id);
  });

  if (targets.length === 0) {
    console.log("No bread products found.");
    return;
  }

  for (const product of targets) {
    const next = rewriteBreadDescription(product.description);
    if (next === product.description) {
      console.log(`Skip (already ok): ${product.name}`);
      continue;
    }
    const { error: updateError } = await supabase
      .from("products")
      .update({ description: next })
      .eq("id", product.id);
    if (updateError) throw updateError;
    console.log(`Updated ${product.name}`);
    console.log(`  from: ${product.description}`);
    console.log(`  to:   ${next}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
