import { NextResponse } from "next/server";
import { normalizeUserEmail } from "@/app/lib/userAuth";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = normalizeUserEmail(body.email);

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Email verification is required before creating an account. Please complete the OTP step.",
      },
      { status: 403 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Registration failed." },
      { status: 500 }
    );
  }
}
