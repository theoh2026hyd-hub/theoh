import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const categoryId = 39;

  const productsToInsert = [
    {
      category_id: categoryId,
      name: "Classic Fruit Oats Base",
      price: 150,
      description: "Our signature blend of rolled oats perfect for fruity creations.",
      in_stock: true,
      quantity: 100,
      calories: 300
    },
    {
      category_id: categoryId,
      name: "High Protein Chocolate Oats Base",
      price: 180,
      description: "Rich chocolate infused oats with an extra kick of plant protein.",
      in_stock: true,
      quantity: 100,
      calories: 350
    }
  ];

  const { data: products, error: prodError } = await supabase
    .from("products")
    .insert(productsToInsert)
    .select();

  if (prodError) {
    console.error("Error creating products:", prodError);
    return;
  }
  console.log("Created products:", products.length);
}

run();
