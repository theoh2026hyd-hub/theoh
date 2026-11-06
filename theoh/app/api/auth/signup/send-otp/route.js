import { NextResponse } from "next/server";
import { findAuthUserByEmail } from "@/app/lib/authUserLookup";
import { isEmailRegistered } from "@/app/lib/userRegistration";
import { generateOtp, normalizeUserEmail, storeSignupOtp } from "@/app/lib/userAuth";
import { sendSignupOtpEmail } from "@/app/lib/mailSender";

function isFullyRegistered(existing) {
  return (
    existing?.user &&
    existing?.profile?.user_id &&
    existing.profile.user_id === existing.user.id
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = normalizeUserEmail(body.email);
    const password = String(body.password || "");
    const fullName = String(body.fullName || "").trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (!fullName) {
      return NextResponse.json(
        { success: false, error: "Full name is required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const existing = await findAuthUserByEmail(email);
    if (isFullyRegistered(existing) || (await isEmailRegistered(email))) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists. Please sign in." },
        { status: 409 }
      );
    }

    const otp = generateOtp();
    storeSignupOtp(email, otp, { fullName, password });

    try {
      await sendSignupOtpEmail(email, otp);
    } catch (mailError) {
      console.error("Failed to send signup OTP email:", mailError);
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          {
            success: false,
            error: "Failed to send verification email. Check SMTP settings.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent. Check your email to continue sign up.",
    });
  } catch (error) {
    console.error("Signup send OTP error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Could not send verification code." },
      { status: 500 }
    );
  }
}
