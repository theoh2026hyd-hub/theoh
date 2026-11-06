import { NextResponse } from "next/server";
import { normalizeUserEmail } from "@/app/lib/userAuth";
import { isEmailRegistered } from "@/app/lib/userRegistration";

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

    const registered = await isEmailRegistered(email);

    return NextResponse.json({
      success: true,
      registered,
    });
  } catch (error) {
    console.error("Pre-login check error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Could not verify account." },
      { status: 500 }
    );
  }
}
