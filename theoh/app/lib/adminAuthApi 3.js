import { NextResponse } from "next/server";
import {
  generateOtp,
  storeOtp,
  verifyOtp,
  setAdminSession,
  clearAdminSession,
  getAdminSession,
  isAuthorizedEmail,
  normalizeEmail
} from "@/app/lib/adminAuth";
import { sendAdminOtpEmail } from "@/app/lib/mailSender";

export async function handleAdminAuthGet() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, authenticated: false });
    }
    return NextResponse.json({
      success: true,
      authenticated: true
    });
  } catch (error) {
    console.error("Admin session check error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function handleAdminAuthPost(request) {
  try {
    const body = await request.json();
    const { action, email, otp } = body;

    if (action === "send-otp" || action === "resend-otp") {
      const normalized = normalizeEmail(email);

      if (!normalized) {
        return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });
      }

      if (!isAuthorizedEmail(normalized)) {
        return NextResponse.json(
          { success: false, error: "Access denied. This email is not authorized for admin access." },
          { status: 403 }
        );
      }

      const code = generateOtp();
      await storeOtp(normalized, code);

      try {
        await sendAdminOtpEmail(normalized, code);
      } catch (mailError) {
        console.error("Failed to send admin OTP email:", mailError);
        return NextResponse.json(
          {
            success: false,
            error: mailError.message || "Failed to send OTP email. Check SMTP settings."
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message:
          action === "resend-otp"
            ? "A new 6-digit code has been sent. Use the latest email."
            : "A 6-digit code has been sent. Check your inbox."
      });
    }

    if (action === "verify-otp") {
      const normalized = normalizeEmail(email);

      if (!normalized || !otp) {
        return NextResponse.json(
          { success: false, error: "Email and OTP are required." },
          { status: 400 }
        );
      }

      if (!isAuthorizedEmail(normalized)) {
        return NextResponse.json(
          { success: false, error: "Access denied. This email is not authorized for admin access." },
          { status: 403 }
        );
      }

      if (!(await verifyOtp(normalized, otp))) {
        return NextResponse.json(
          { success: false, error: "Invalid or expired OTP. Please try again." },
          { status: 401 }
        );
      }

      await setAdminSession(normalized);

      return NextResponse.json({
        success: true,
        message: "Authentication successful."
      });
    }

    if (action === "logout") {
      await clearAdminSession();
      return NextResponse.json({ success: true, message: "Logged out." });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (error) {
    console.error("Admin auth error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
