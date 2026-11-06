const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addColumns() {
  try {
    console.log("Adding columns to products table via Supabase RPC...");

    // Use raw SQL via supabase.rpc or direct REST — but supabase-js doesn't support raw SQL.
    // Instead, we'll try to update a row with the new columns. If they don't exist, we need
    // the user to run the ALTER TABLE in the Supabase SQL Editor.

    // Test if columns already exist by doing a select
    const { data, error } = await supabase
      .from('products')
      .select('id, protein, carbohydrates, fats, ingredients')
      .limit(1);

    if (error) {
      console.log("\n❌ The columns do NOT exist yet in your Supabase database.");
      console.log("Please run the following SQL in your Supabase SQL Editor (https://supabase.com/dashboard):\n");
      console.log("------------------------------------------------------------");
      console.log("ALTER TABLE products ADD COLUMN IF NOT EXISTS protein DECIMAL(10, 2);");
      console.log("ALTER TABLE products ADD COLUMN IF NOT EXISTS carbohydrates DECIMAL(10, 2);");
      console.log("ALTER TABLE products ADD COLUMN IF NOT EXISTS fats DECIMAL(10, 2);");
      console.log("ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredients TEXT;");
      console.log("------------------------------------------------------------");
      console.log("\nAfter running the SQL above, re-run: node migration_add_nutrients.js");
    } else {
      console.log("✅ Columns already exist! Data sample:", data);
      console.log("\nProceeding to populate macro data...\n");

      // Now run the migration
      const { data: products, error: prodError } = await supabase.from('products').select('*');
      if (prodError) throw prodError;

      console.log(`Found ${products.length} products. Calculating macros...`);
      for (const prod of products) {
        const protein = prod.protein !== null && prod.protein !== undefined ? prod.protein : Math.round(prod.price * 1.5);
        const carbs = prod.carbohydrates !== null && prod.carbohydrates !== undefined ? prod.carbohydrates : Math.round(prod.price * 2.2);
        const fats = prod.fats !== null && prod.fats !== undefined ? prod.fats : Math.round(prod.price * 0.8);
        const ingredients = prod.ingredients || "";

        const { error: updateError } = await supabase
          .from('products')
          .update({ protein, carbohydrates: carbs, fats, ingredients })
          .eq('id', prod.id);

        if (updateError) {
          console.error(`❌ Failed to update product ${prod.id} (${prod.name}):`, updateError.message);
        } else {
          console.log(`✅ Product ${prod.id} (${prod.name}) → P:${protein}g C:${carbs}g F:${fats}g`);
        }
      }
      console.log("\n🎉 Migration complete!");
    }
  } catch (err) {
    console.error("Migration failed:", err);
  }
}

addColumns();
