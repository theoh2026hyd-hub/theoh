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

    const oatsCat = categories.find(c => c.name.toLowerCase() === 'oats');
    const breadsCat = categories.find(c => c.name.toLowerCase() === 'breads');
    const butterCat = categories.find(c => c.name.toLowerCase() === 'butter');

    console.log('Categories found:', {
      oats: oatsCat ? oatsCat.id : null,
      breads: breadsCat ? breadsCat.id : null,
      butter: butterCat ? butterCat.id : null
    });

    // 1. Update Oats descriptions to append subcategories
    if (oatsCat) {
      console.log('Fetching Oats products...');
      const { data: oatsProducts, error: oatsProdError } = await supabase
        .from('products')
        .select('*')
        .eq('category_id', oatsCat.id);
      if (oatsProdError) throw oatsProdError;

      for (const p of oatsProducts) {
        let subCat = 'regular';
        if (p.name === 'High Protein Oats Chocolate' || p.name === 'All Mix Oats (Fruits & Nuts)') {
          subCat = 'oats signature';
        }
        
        let newDesc = p.description || '';
        // Clean any existing tag first to prevent multiple appends
        if (newDesc.includes(' || sub_category:')) {
          newDesc = newDesc.split(' || sub_category:')[0];
        }
        newDesc += ` || sub_category:${subCat}`;

        console.log(`Updating description of '${p.name}' to include sub_category:${subCat}`);
        const { error: updError } = await supabase
          .from('products')
          .update({ description: newDesc })
          .eq('id', p.id);
        if (updError) throw updError;
      }
      console.log('Oats subcategories updated successfully.');
    }

    // 2. Move butter category items to breads addons
    if (breadsCat) {
      console.log('Checking and adding Butter products as Breads addons...');
      const butterAddons = [
        { name: 'Almond Butter (Creamy/Crunchy)', price: 250.00 },
        { name: 'Dark Chocolate Peanut Butter', price: 180.00 },
        { name: 'Peanut Butter', price: 140.00 }
      ];

      for (const addon of butterAddons) {
        const { data: existingAddon, error: exError } = await supabase
          .from('product_addons')
          .select('*')
          .eq('category_id', breadsCat.id)
          .eq('name', addon.name);
        if (exError) throw exError;

        if (!existingAddon || existingAddon.length === 0) {
          console.log(`Inserting addon '${addon.name}' under Breads (category_id: ${breadsCat.id})...`);
          const { error: addError } = await supabase
            .from('product_addons')
            .insert({ category_id: breadsCat.id, name: addon.name, price: addon.price });
          if (addError) throw addError;
        } else {
          console.log(`Addon '${addon.name}' already exists under Breads.`);
        }
      }
    }

    // 3. Delete Butter category and its products
    if (butterCat) {
      console.log('Deleting products in Butter category...');
      const { error: delProductsError } = await supabase
        .from('products')
        .delete()
        .eq('category_id', butterCat.id);
      if (delProductsError) throw delProductsError;

      console.log('Deleting Butter category...');
      const { error: delCatError } = await supabase
        .from('categories')
        .delete()
        .eq('id', butterCat.id);
      if (delCatError) throw delCatError;
      console.log('Butter section removed.');
    }

    // 4. Create Cookies category and products
    console.log("Checking if 'Cookies' category exists...");
    let cookiesCat = categories.find(c => c.name.toLowerCase() === 'cookies');
    let cookiesCatId;

    if (!cookiesCat) {
      console.log("Creating 'Cookies' category...");
      const { data: newCat, error: newCatError } = await supabase
        .from('categories')
        .insert({ name: 'Cookies' })
        .select()
        .single();
      if (newCatError) throw newCatError;
      cookiesCatId = newCat.id;
      console.log("Created 'Cookies' category with ID:", cookiesCatId);
    } else {
      cookiesCatId = cookiesCat.id;
      console.log("'Cookies' category already exists with ID:", cookiesCatId);
    }

    const cookies = [
      {
        name: 'Classic Chocolate Chip Cookie',
        price: 90.00,
        calories: 250,
        description: 'Freshly baked artisan cookie loaded with premium dark and milk chocolate chips.',
        image: '/chocolate_chip_cookie.png'
      },
      {
        name: 'Oatmeal Raisin Cookie',
        price: 80.00,
        calories: 220,
        description: 'Chewy organic rolled oats cookie with raisins and a hint of sweet cinnamon.',
        image: '/oatmeal_raisin_cookie.png'
      }
    ];

    for (const cookie of cookies) {
      const { data: existingCookie, error: exCookieError } = await supabase
        .from('products')
        .select('*')
        .eq('category_id', cookiesCatId)
        .eq('name', cookie.name);
      if (exCookieError) throw exCookieError;

      if (!existingCookie || existingCookie.length === 0) {
        console.log(`Creating cookie product '${cookie.name}'...`);
        const { error: insCookieError } = await supabase
          .from('products')
          .insert({
            category_id: cookiesCatId,
            name: cookie.name,
            price: cookie.price,
            calories: cookie.calories,
            rating: 4.8,
            description: cookie.description,
            image: cookie.image,
            in_stock: true
          });
        if (insCookieError) throw insCookieError;
      } else {
        console.log(`Cookie product '${cookie.name}' already exists.`);
      }
    }

    console.log('Migration finished successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  }
}

migrate();
