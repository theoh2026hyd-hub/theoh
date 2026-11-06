import { NextResponse } from "next/server";
import { razorpay } from "@/app/lib/razorpayClient";
import { buildCheckoutQuote } from "@/app/lib/checkoutPricing";

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      customerName,
      receiverName,
      receiverPhone,
      deliveryAddress,
      landmark,
      pincode,
      specialInstructions,
      deliveryDateTime
    } = body;

    const quote = await buildCheckoutQuote(body);
    if (!quote.success) {
      return NextResponse.json({ success: false, error: quote.error }, { status: quote.status || 400 });
    }

    const {
      subtotal: calculatedSubtotal,
      coinDiscount: coinDiscountVal,
      promoDiscount: promoDiscountVal,
      tax: taxVal,
      packingFee: activePackingFee,
      deliveryFee: activeDeliveryFee,
      grandTotal: grandTotalVal,
      coinsEarned,
      gstPercent
    } = quote.totals;

    const validatedItems = quote.validatedItems;
    const validatedCouponCode = quote.validatedCouponCode;

    const razorpayAmount = Math.round(grandTotalVal * 100);

    const options = {
      amount: razorpayAmount,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        customerName,
        customerPhone: body.customerPhone,
        receiverName,
        receiverPhone,
        deliveryAddress,
        landmark: landmark || "",
        pincode,
        specialInstructions: specialInstructions || "",
        subtotal: calculatedSubtotal.toString(),
        coinDiscount: coinDiscountVal.toString(),
        promoDiscount: promoDiscountVal.toString(),
        tax: taxVal.toString(),
        packingFee: activePackingFee.toString(),
        deliveryFee: activeDeliveryFee.toString(),
        gstPercent: String(gstPercent ?? 8),
        grandTotal: grandTotalVal.toString(),
        coinsEarned: coinsEarned.toString(),
        couponCode: validatedCouponCode || "",
        deliveryDateTime: deliveryDateTime || ""
      }
    };

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction && (!keyId || !keySecret || keyId === "your_razorpay_key" || keySecret === "your_razorpay_secret")) {
      console.error("Razorpay keys are not configured in production.");
      return NextResponse.json(
        { success: false, error: "Payment processor not configured." },
        { status: 500 }
      );
    }

    const isMock =
      !isProduction &&
      (!keyId ||
        keyId === "your_razorpay_key" ||
        !keySecret ||
        keySecret === "your_razorpay_secret" ||
        razorpayAmount < 100);

    let orderId = `order_mock_${Date.now()}`;
    let amount = razorpayAmount;
    let currency = "INR";

    if (!isMock) {
      const razorpayOrder = await razorpay.orders.create(options);
      orderId = razorpayOrder.id;
      amount = razorpayOrder.amount;
      currency = razorpayOrder.currency;
    }

    return NextResponse.json({
      success: true,
      isMock,
      keyId: isMock ? "rzp_test_mock" : keyId,
      orderId,
      amount,
      currency,
      totals: quote.totals,
      validatedItems
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    const errorMsg =
      error.error?.description || error.description || error.message || "Unknown payment creation error.";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
