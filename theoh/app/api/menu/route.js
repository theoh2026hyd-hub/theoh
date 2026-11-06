import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { getMenu, getMenuCategories, getUpdates, getEvents, getUpcomingItems, getMostOrderedProductIds } from "@/app/lib/dbService";
import { supabase } from "@/app/lib/supabaseClient";

export async function GET() {
  try {
    const [menu, menuCategories, updates, events, upcomingItems, mostOrderedProductIds] = await Promise.all([
      getMenu(),
      getMenuCategories(),
      getUpdates(),
      getEvents(),
      getUpcomingItems(),
      getMostOrderedProductIds()
    ]);
    
    const { data: couponsData } = await supabase.from("coupons").select("*").eq("is_active", true);
    
    const { data: settingsData } = await supabase.from("settings").select('*');
    const settings = {};
    if (settingsData) {
      settingsData.forEach((s) => {
        settings[s.key] = s.value;
      });
    }

    return NextResponse.json({ 
      success: true, 
      menu,
      menuCategories,
      mostOrderedProductIds,
      coupons: couponsData || [],
      settings,
      updates,
      events,
      upcomingItems
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "toggle-stock") {
      const { productId, inStock } = body;
      
      if (!productId) {
        return NextResponse.json({ success: false, error: "Product ID is required." }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("products")
        .update({ in_stock: inStock })
        .eq("id", productId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, product: data });
    }

    // Default: Add a new product to the catalog
    const { categoryId, name, price, calories, rating, description, image, addons } = body;

    if (!categoryId || !name || price === undefined || calories === undefined) {
      return NextResponse.json(
        { success: false, error: "Required fields (categoryId, name, price, calories) are missing." },
        { status: 400 }
      );
    }

    const { data: newProduct, error: productError } = await supabase
      .from("products")
      .insert({
        category_id: categoryId,
        name,
        price,
        calories,
        rating: rating || 4.8,
        description,
        image: image || "/why_us_premium_oats.png",
        in_stock: true
      })
      .select()
      .single();

    if (productError) throw productError;

    // Add nested addons if provided
    if (addons && Array.isArray(addons) && addons.length > 0) {
      const addonsData = addons.map((addon) => ({
        product_id: newProduct.id,
        name: addon.name,
        price: addon.price
      }));
      const { error: addonsError } = await supabase
        .from("product_addons")
        .insert(addonsData);

      if (addonsError) {
        console.error("Warning: Failed to insert addons during product creation:", addonsError);
      }
    }

    return NextResponse.json({ success: true, product: newProduct });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
