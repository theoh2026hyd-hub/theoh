import Razorpay from "razorpay";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  console.warn("Razorpay credentials missing in environment variables. Payment operations will fail unless credentials are provided.");
}

export const razorpay = new Razorpay({
  key_id: keyId || "mock_key_id",
  key_secret: keySecret || "mock_key_secret",
});
