const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrate() {
  try {
    console.log('Fetching categories...');
    const { data: categories, error: catError } = await supabase.from('categories').select('*');
    if (catError) throw catError;

    let rawItemsCat = categories.find(c => c.name.toLowerCase() === 'raw items');

    if (!rawItemsCat) {
      console.log('Creating "Raw Items" category...');
      const { data: newCat, error: insertCatError } = await supabase
        .from('categories')
        .insert([{ name: 'Raw Items' }])
        .select()
        .single();
      if (insertCatError) throw insertCatError;
      rawItemsCat = newCat;
      console.log('Created Raw Items category:', rawItemsCat.id);
    } else {
      console.log('Raw Items category already exists:', rawItemsCat.id);
    }

    const rawProducts = [
      {
        name: 'Premium Rolled Oats',
        description: 'High-quality rolled oats for your daily nutrition. Perfect for making healthy oat meals at home. || sub_category:regular',
        price: 150.00,
        calories: 380,
        rating: 4.9,
        image: '/raw_premium_oats.png',
        in_stock: true,
        category_id: rawItemsCat.id
      },
      {
        name: 'Organic Golden Honey',
        description: 'Pure, organic golden honey directly sourced from sustainable farms. || sub_category:regular',
        price: 250.00,
        calories: 300,
        rating: 4.9,
        image: '/raw_organic_honey.png',
        in_stock: true,
        category_id: rawItemsCat.id
      },
      {
        name: 'Fresh Almond Milk',
        description: 'Freshly pressed almond milk, unsweetened and perfect for your oats. || sub_category:regular',
        price: 180.00,
        calories: 120,
        rating: 4.8,
        image: '/raw_almond_milk.png',
        in_stock: true,
        category_id: rawItemsCat.id
      },
      {
        name: 'Premium Mixed Nuts',
        description: 'A luxurious mix of almonds, walnuts, and pecans. || sub_category:regular',
        price: 350.00,
        calories: 450,
        rating: 4.7,
        image: '/raw_mixed_nuts.png',
        in_stock: true,
        category_id: rawItemsCat.id
      },
      {
        name: 'Dried Mixed Berries',
        description: 'Premium dried cranberries and blueberries for natural sweetness. || sub_category:regular',
        price: 280.00,
        calories: 220,
        rating: 4.8,
        image: '/raw_dried_berries.png',
        in_stock: true,
        category_id: rawItemsCat.id
      }
    ];

    console.log('Inserting Raw Items products...');
    for (const prod of rawProducts) {
      const { data: existing, error: existingError } = await supabase
        .from('products')
        .select('*')
        .eq('name', prod.name)
        .maybeSingle();
        
      if (!existing) {
        const { error: insertProdError } = await supabase.from('products').insert([prod]);
        if (insertProdError) console.error('Error inserting', prod.name, insertProdError);
        else console.log('Inserted:', prod.name);
      } else {
        console.log(prod.name, 'already exists. Skipping.');
      }
    }

    // Now insert upcoming items
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

    console.log('Inserting Upcoming Items...');
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

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrate();
