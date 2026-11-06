import { NextResponse } from "next/server";
import { completeEmailRegistration } from "@/app/lib/emailRegistration";
import { normalizeUserEmail, verifySignupOtp } from "@/app/lib/userAuth";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = normalizeUserEmail(body.email);
    const otp = String(body.otp || "").replace(/\D/g, "").trim();

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: "Email and verification code are required." },
        { status: 400 }
      );
    }

    if (otp.length !== 6) {
      return NextResponse.json(
        { success: false, error: "Enter the 6-digit code from your email." },
        { status: 400 }
      );
    }

    const pendingSignup = verifySignupOtp(email, otp);
    if (!pendingSignup) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired verification code. Please sign up again to receive a new code.",
        },
        { status: 400 }
      );
    }

    const result = await completeEmailRegistration({
      email,
      password: pendingSignup.password,
      fullName: pendingSignup.fullName,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      profile: result.profile,
      recovered: Boolean(result.recovered),
    });
  } catch (error) {
    console.error("Signup verify OTP error:", error);
    const status = error.status || 500;
    return NextResponse.json(
      { success: false, error: error.message || "Email verification failed." },
      { status }
    );
  }
}
