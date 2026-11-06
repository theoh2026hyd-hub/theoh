import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { supabase as supabaseAdmin } from "@/app/lib/supabaseClient";
import { getPhoneLast10 } from "@/app/lib/phone";
import { getRegisteredProfileByUserId } from "@/app/lib/userRegistration";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: "Database unavailable." },
        { status: 503 }
      );
    }

    const existing = await getRegisteredProfileByUserId(user.id);
    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: "No account found. Please sign up before signing in.",
          code: "NOT_REGISTERED",
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const updates = {
      updated_at: new Date().toISOString(),
    };

    if (body.fullName?.trim()) {
      updates.full_name = body.fullName.trim();
      updates.customer_name = body.fullName.trim();
    }

    if (body.phone) {
      updates.phone = getPhoneLast10(body.phone);
    }

    const { data: profile, error } = await supabaseAdmin
      .from("user_details")
      .update(updates)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error("Auth profile sync error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to sync profile." },
      { status: 500 }
    );
  }
}
