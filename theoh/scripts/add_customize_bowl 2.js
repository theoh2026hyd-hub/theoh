const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  try {
    console.log("Adding 'Customize' category...");
    // Create "Customize" category
    let { data: catData, error: catErr } = await supabase
      .from('categories')
      .select('*')
      .eq('name', 'Customize')
      .maybeSingle();

    if (catErr) throw catErr;

    if (!catData) {
      const res = await supabase.from('categories').insert({ name: 'Customize' }).select().single();
      if (res.error) throw res.error;
      catData = res.data;
      console.log("Created 'Customize' category with ID:", catData.id);
    } else {
      console.log("'Customize' category already exists with ID:", catData.id);
    }

    console.log("Adding 'Oat Bases' category...");
    let { data: oatBasesCat, error: obCatErr } = await supabase
      .from('categories')
      .select('*')
      .eq('name', 'Oat Bases')
      .maybeSingle();
      
    if (obCatErr) throw obCatErr;

    if (!oatBasesCat) {
      const res = await supabase.from('categories').insert({ name: 'Oat Bases' }).select().single();
      if (res.error) throw res.error;
      oatBasesCat = res.data;
      console.log("Created 'Oat Bases' category with ID:", oatBasesCat.id);
    } else {
      console.log("'Oat Bases' category already exists with ID:", oatBasesCat.id);
    }

    console.log("Adding 'Customize Your Bowl' product...");
    const productPayload = {
      category_id: catData.id,
      name: 'Customize Your Bowl',
      price: 199,
      calories: 320,
      rating: 5.0,
      description: 'Craft your perfect bowl exactly how you want it! Pick your oat base, then layer on fresh fruits, crunchy nuts, and wholesome seeds. || size_prices:199,249,299 || size_grams:120,180,210',
      image: 'https://xyooeardwkcheydfxwcr.supabase.co/storage/v1/object/public/product-images/products/4a3adb10-9ea4-4dd1-81c2-5352811a7f4f.jpg',
      in_stock: true,
      protein: 11,
      carbohydrates: 52,
      fats: 6,
      ingredients: 'Customizable base and toppings',
      quantity: 100
    };

    let { data: prodData, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('name', 'Customize Your Bowl')
      .maybeSingle();
      
    if (prodErr) throw prodErr;

    if (!prodData) {
      const res = await supabase.from('products').insert(productPayload).select().single();
      if (res.error) throw res.error;
      console.log("Created 'Customize Your Bowl' product with ID:", res.data.id);
    } else {
      console.log("'Customize Your Bowl' product already exists.");
    }

    console.log("Adding Oat Bases addons...");
    const bases = [
      { name: 'The Oats Base (Plain)', price: 0, calories: 150, grams: 50 },
      { name: 'Chocolate Oats Base', price: 50, calories: 180, grams: 50 },
      { name: 'Mango Oats Base', price: 150, calories: 170, grams: 50 },
      { name: 'Dry Fruit Oats Base', price: 100, calories: 200, grams: 50 },
      { name: 'All Mix Oats Base', price: 100, calories: 220, grams: 50 }
    ];

    for (const base of bases) {
      const { data: existingBase } = await supabase
        .from('product_addons')
        .select('id')
        .eq('name', base.name)
        .maybeSingle();

      if (!existingBase) {
        const { error } = await supabase.from('product_addons').insert({
          name: base.name,
          price: base.price,
          calories: base.calories,
          grams: base.grams,
          category_id: oatBasesCat.id
        });
        if (error) throw error;
        console.log(`Inserted addon: ${base.name}`);
      } else {
        console.log(`Addon already exists: ${base.name}`);
      }
    }

    console.log("Migration complete!");
  } catch (err) {
    console.error("Migration failed:", err);
  }
}

run();
