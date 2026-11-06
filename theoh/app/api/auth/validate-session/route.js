import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import {
  getRegisteredProfileByUserId,
  profileNeedsPhone,
} from "@/app/lib/userRegistration";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, registered: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const profile = await getRegisteredProfileByUserId(user.id);

    if (!profile) {
      return NextResponse.json({
        success: false,
        registered: false,
        error: "No account found. Please sign up before signing in.",
        code: "NOT_REGISTERED",
      });
    }

    return NextResponse.json({
      success: true,
      registered: true,
      needsPhone: profileNeedsPhone(profile, user.id),
      profile: {
        phone: profile.phone,
        fullName: profile.full_name || profile.customer_name,
        email: profile.email,
        authProvider: profile.auth_provider,
      },
    });
  } catch (error) {
    console.error("Validate session error:", error);
    return NextResponse.json(
      { success: false, registered: false, error: error.message || "Session validation failed." },
      { status: 500 }
    );
  }
}
