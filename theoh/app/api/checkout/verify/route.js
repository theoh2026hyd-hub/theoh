import { NextResponse } from "next/server";
import crypto from "crypto";
import { razorpay } from "@/app/lib/razorpayClient";
import { createOrder } from "@/app/lib/dbService";
import { formatOrderNumber } from "@/app/lib/orderNumber";

export async function POST(request) {
  try {
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id) {
      return NextResponse.json(
        { success: false, error: "Payment verification parameters are missing." },
        { status: 400 }
      );
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction && (!keySecret || keySecret === "your_razorpay_key" || keySecret === "mock_key_secret")) {
      console.error("Razorpay key secret is not configured in production.");
      return NextResponse.json(
        { success: false, error: "Payment processing error. Gateway not configured." },
        { status: 500 }
      );
    }

    const isMock = !isProduction && (
      !keySecret ||
      keySecret === "your_razorpay_key" ||
      keySecret === "mock_key_secret" ||
      razorpay_order_id.startsWith("order_mock")
    );

    let verified = false;

    if (isMock) {
      // Allow bypass in local development/mock states
      verified = true;
    } else {
      if (!razorpay_signature) {
        return NextResponse.json(
          { success: false, error: "Signature parameter is missing." },
          { status: 400 }
        );
      }
      
      const text = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(text)
        .digest("hex");

      if (expectedSignature === razorpay_signature) {
        verified = true;
      }
    }

    if (!verified) {
      return NextResponse.json(
        { success: false, error: "Cryptographic signature validation failed." },
        { status: 400 }
      );
    }

    // Retrieve order notes (metadata details)
    let notes = {};

    if (isMock) {
      // Fallback: extract properties directly from payload if we are using fake client requests
      notes = body.notes || {
        customerName: body.customerName || "Test Guest",
        customerPhone: body.customerPhone || "+919999999999",
        receiverName: body.receiverName || "Test Guest",
        receiverPhone: body.receiverPhone || "+919999999999",
        deliveryAddress: body.deliveryAddress || "Test Suite 101, Cloud Kitchen",
        landmark: body.landmark || "",
        pincode: body.pincode || "10022",
        specialInstructions: body.specialInstructions || "",
        subtotal: body.subtotal || "0.00",
        coinDiscount: body.coinDiscount || "0.00",
        promoDiscount: body.promoDiscount || "0.00",
        tax: body.tax || "0.00",
        packingFee: body.packingFee || "0.00",
        deliveryFee: body.deliveryFee || "0.00",
        gstPercent: body.gstPercent || "8",
        grandTotal: body.grandTotal || "0.00",
        coinsEarned: body.coinsEarned || "0",
        couponCode: body.couponCode || "",
        deliveryDateTime: body.deliveryDateTime || "",
        cartItemsJson: JSON.stringify(body.cartItems || [])
      };
    } else {
      const orderDetails = await razorpay.orders.fetch(razorpay_order_id);
      notes = orderDetails.notes;
    }

    const items = body.cartItems || [];

    const orderData = {
      id: razorpay_order_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature: razorpay_signature || "mock_signature",
      customer_name: notes.customerName,
      customer_phone: notes.customerPhone,
      receiver_name: notes.receiverName,
      receiver_phone: notes.receiverPhone,
      delivery_address: notes.deliveryAddress,
      landmark: notes.landmark,
      pincode: notes.pincode,
      special_instructions: notes.specialInstructions,
      subtotal: parseFloat(notes.subtotal || 0),
      coin_discount: parseFloat(notes.coinDiscount || 0),
      promo_discount: parseFloat(notes.promoDiscount || 0),
      tax: parseFloat(notes.tax || 0),
      grand_total: parseFloat(notes.grandTotal || 0),
      coins_earned: parseInt(notes.coinsEarned || 0, 10),
      delivery_date_time: notes.deliveryDateTime || null,
      coupon_code: notes.couponCode || null
    };

    const result = await createOrder(orderData, items);

    return NextResponse.json({
      success: true,
      message: "Payment successfully verified and order recorded.",
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      displayOrderId: result.displayOrderId || formatOrderNumber(result.orderNumber),
      generatedCoupon: result.generatedCoupon
    });

  } catch (error) {
    console.error("Payment verification failure:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
