import { NextResponse } from "next/server";
import {
  createPasswordResetToken,
  normalizeUserEmail,
  verifyPasswordResetOtp,
} from "@/app/lib/userAuth";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = normalizeUserEmail(body.email);
    const otp = String(body.otp || "").replace(/\D/g, "").trim();

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: "Email and OTP are required." },
        { status: 400 }
      );
    }

    if (otp.length !== 6) {
      return NextResponse.json(
        { success: false, error: "Enter the 6-digit code from your email." },
        { status: 400 }
      );
    }

    const isValid = verifyPasswordResetOtp(email, otp);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired OTP. Please request a new code." },
        { status: 400 }
      );
    }

    const resetToken = createPasswordResetToken(email);

    return NextResponse.json({
      success: true,
      resetToken,
      message: "OTP verified. You can now set a new password.",
    });
  } catch (error) {
    console.error("Verify reset OTP error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "OTP verification failed." },
      { status: 500 }
    );
  }
}
