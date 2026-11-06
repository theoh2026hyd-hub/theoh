const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrate() {
  try {
    console.log('Fetching products...');
    const { data: products, error: prodError } = await supabase.from('products').select('*');
    if (prodError) throw prodError;

    console.log(`Found ${products.length} products. Calculating macros...`);
    for (const prod of products) {
      // Original math formulas
      const protein = Math.round(prod.price * 1.5);
      const carbs = Math.round(prod.price * 2.2);
      const fats = Math.round(prod.price * 0.8);

      const { error: updateError } = await supabase
        .from('products')
        .update({ protein, carbohydrates: carbs, fats })
        .eq('id', prod.id);

      if (updateError) {
        console.error(`Failed to update product ${prod.id}:`, updateError);
      } else {
        console.log(`Updated product ${prod.id} (${prod.name}) with macros: P:${protein} C:${carbs} F:${fats}`);
      }
    }

    // Double check upcoming items
    const upcomingItems = [
      {
        name: 'Matcha Green Tea Oats',
        description: 'Our newest creation featuring premium culinary matcha, chia seeds, and fresh berries.',
        image: '/upcoming_matcha_oats.png'
      },
      {
        name: 'Artisan Chia Pudding',
        description: 'A luxurious chia seed pudding layered with seasonal exotic fruits and organic honey.',
        image: '/upcoming_chia_pudding.png'
      },
      {
        name: 'Reserve Cold Brew',
        description: '18-hour steeped cold brew coffee finished with a sweet cream swirl.',
        image: '/upcoming_cold_brew.png'
      }
    ];

    for (const item of upcomingItems) {
      const { data: existing, error: existingError } = await supabase
        .from('upcoming_items')
        .select('*')
        .eq('name', item.name)
        .maybeSingle();

      if (!existing) {
        const { error: insertUpcomingError } = await supabase.from('upcoming_items').insert([item]);
        if (insertUpcomingError) console.error('Error inserting upcoming', item.name, insertUpcomingError);
        else console.log('Inserted upcoming:', item.name);
      } else {
        console.log('Upcoming item', item.name, 'already exists. Skipping.');
      }
    }

    console.log('Migration 3 completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrate();
