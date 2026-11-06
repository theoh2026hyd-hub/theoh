const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const INGREDIENTS_BY_NAME = {
  "All Mix Oats (Fruits & Nuts)":
    "Rolled oats, Seasonal fresh fruits, Almonds, Walnuts, Cashews, Chia seeds, Almond milk",
  "Fruit Oats":
    "Rolled oats, Apple, Banana, Grapes, Mixed berries, Almond milk",
  "High Protein Oats Chocolate":
    "Rolled oats, Whey protein, Dark chocolate chips, Banana, Almond milk, Cocoa",
  Muesli:
    "Toasted muesli, Almond milk, Raisins, Pumpkin seeds, Sunflower seeds",
  "Plain Oats (Soaked/Boiled)":
    "Premium rolled oats, Water, Pinch of salt",
  "Brown Bread":
    "Whole wheat flour, Rolled oats, Yeast, Olive oil, Sea salt",
  "Multi Grain Bread":
    "Whole grains, Rolled oats, Seeds mix, Yeast, Olive oil",
  "Whole Wheat Bread":
    "Whole wheat flour, Yeast, Olive oil, Sea salt",
  "Classic Chocolate Chip Cookie":
    "Rolled oats, Whole wheat flour, Dark chocolate chips, Butter, Brown sugar, Vanilla",
  "Oatmeal Raisin Cookie":
    "Rolled oats, Raisins, Whole wheat flour, Cinnamon, Butter, Brown sugar",
  "Premium Rolled Oats": "100% premium rolled oats",
  "Organic Golden Honey": "Pure organic honey",
  "Fresh Almond Milk": "Almonds, Filtered water",
  "Premium Mixed Nuts": "Almonds, Walnuts, Cashews, Pecans",
  "Dried Mixed Berries": "Dried cranberries, Dried blueberries"
};

const SIZE_PRICE_FIXES = {
  "Fruit Oats": "199,299,399"
};

async function run() {
  const { data: products, error } = await supabase.from("products").select("*");
  if (error) throw error;

  for (const product of products) {
    const updates = {};
    const ingredients = INGREDIENTS_BY_NAME[product.name];
    if (ingredients && !(product.ingredients || "").trim()) {
      updates.ingredients = ingredients;
    }

    const sizeFix = SIZE_PRICE_FIXES[product.name];
    if (sizeFix) {
      let desc = product.description || "";
      if (desc.includes("size_prices:")) {
        desc = desc.replace(/size_prices:[^|]+/, `size_prices:${sizeFix}`);
      } else {
        desc = `${desc} || size_prices:${sizeFix}`;
      }
      updates.description = desc.trim();
      updates.price = parseFloat(sizeFix.split(",")[0]);
    }

    if (Object.keys(updates).length === 0) continue;

    const { error: updateError } = await supabase
      .from("products")
      .update(updates)
      .eq("id", product.id);

    if (updateError) {
      console.error(`Failed ${product.name}:`, updateError.message);
    } else {
      console.log(`Updated ${product.name}:`, Object.keys(updates).join(", "));
    }
  }

  console.log("Menu data fix complete.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
