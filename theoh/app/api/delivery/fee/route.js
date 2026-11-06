import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabaseClient";
import {
  getDeliveryFeeFromCoordsAsync,
  isTakeawayAddress,
  resolveDeliveryCoords
} from "@/app/lib/delivery";
import { getDeliveryPricingSettings } from "@/app/lib/settings";

async function loadDeliveryPricing() {
  const { data } = await supabase.from("settings").select("key, value");
  const settings = {};
  (data || []).forEach((row) => {
    settings[row.key] = row.value;
  });
  return getDeliveryPricingSettings(settings);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { address, isTakeaway } = body;
    const pricing = await loadDeliveryPricing();

    if (isTakeaway || isTakeawayAddress(address)) {
      return NextResponse.json({
        success: true,
        distanceKm: 0,
        deliveryFee: 0,
        coordsFound: true,
        distanceMethod: "bike",
        pricing
      });
    }

    const coords = await resolveDeliveryCoords(address);

    if (coords) {
      const result = await getDeliveryFeeFromCoordsAsync(coords.lat, coords.lng, pricing);
      if (result.withinRadius === false) {
        return NextResponse.json({
          success: false,
          error: `Delivery is available only within ${result.maxKm} km of our kitchen. Your location is about ${result.distanceKm} km away.`,
          ...result,
          coordsFound: true,
          coordSource: coords.source,
          pricing
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        ...result,
        coordsFound: true,
        coordSource: coords.source,
        pricing
      });
    }

    return NextResponse.json({
      success: false,
      error: "No Google Maps link found in address. Please use Current Location to confirm your delivery point.",
      coordsFound: false,
      deliveryFee: pricing.baseFee,
      distanceKm: null,
      pricing
    }, { status: 400 });
  } catch (error) {
    console.error("Delivery fee calculation error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
