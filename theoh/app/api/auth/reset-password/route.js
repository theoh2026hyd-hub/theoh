import { NextResponse } from "next/server";
import { findAuthUserByEmail } from "@/app/lib/authUserLookup";
import { supabase } from "@/app/lib/supabaseClient";
import {
  clearPasswordResetToken,
  normalizeUserEmail,
  verifyPasswordResetToken,
} from "@/app/lib/userAuth";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = normalizeUserEmail(body.email);
    const resetToken = String(body.resetToken || "").trim();
    const newPassword = String(body.newPassword || "");

    if (!email || !resetToken || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Email, reset token, and new password are required." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    if (!verifyPasswordResetToken(email, resetToken)) {
      return NextResponse.json(
        { success: false, error: "Reset session expired. Please start again." },
        { status: 400 }
      );
    }

    const account = await findAuthUserByEmail(email);
    if (!account?.user) {
      return NextResponse.json(
        { success: false, error: "Account not found." },
        { status: 404 }
      );
    }

    const { error } = await supabase.auth.admin.updateUserById(account.user.id, {
      password: newPassword,
    });

    if (error) {
      throw error;
    }

    clearPasswordResetToken(email);

    return NextResponse.json({
      success: true,
      message: "Password updated successfully. You can sign in now.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Could not update password." },
      { status: 500 }
    );
  }
}
