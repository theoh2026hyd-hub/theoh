import { NextResponse } from "next/server";
import { findAuthUserByEmail } from "@/app/lib/authUserLookup";
import { generateOtp, normalizeUserEmail, storePasswordResetOtp } from "@/app/lib/userAuth";
import { sendPasswordResetOtpEmail } from "@/app/lib/mailSender";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = normalizeUserEmail(body.email);

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const account = await findAuthUserByEmail(email);
    if (!account?.user) {
      return NextResponse.json(
        { success: false, error: "No account found with this email. Please sign up first." },
        { status: 404 }
      );
    }

    const otp = generateOtp();
    storePasswordResetOtp(email, otp);
    await sendPasswordResetOtpEmail(email, otp);

    return NextResponse.json({
      success: true,
      message: "Password reset code sent to your email.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Could not send reset code." },
      { status: 500 }
    );
  }
}
