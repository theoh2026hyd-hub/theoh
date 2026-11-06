import { NextResponse } from "next/server";
import { buildCheckoutQuote } from "@/app/lib/checkoutPricing";

export async function POST(request) {
  try {
    const body = await request.json();
    const quote = await buildCheckoutQuote(body);
    if (!quote.success) {
      return NextResponse.json({ success: false, error: quote.error }, { status: quote.status || 400 });
    }

    return NextResponse.json({
      success: true,
      totals: quote.totals,
      validatedItems: quote.validatedItems,
      validatedCouponCode: quote.validatedCouponCode
    });
  } catch (error) {
    console.error("Checkout calculate error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
