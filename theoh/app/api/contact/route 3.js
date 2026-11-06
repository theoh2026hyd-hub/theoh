import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabaseClient";

export async function POST(request) {
  try {
    const { name, email, message, phone } = await request.json();

    if (!name || !String(name).trim()) {
      return NextResponse.json({ success: false, error: "Name is required." }, { status: 400 });
    }

    if (!email || !String(email).trim()) {
      return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });
    }

    const payload = {
      name: String(name).trim(),
      email: String(email).trim(),
      phone: phone ? String(phone).trim() : null,
      message: message && String(message).trim()
        ? String(message).trim()
        : "General inquiry (no additional notes provided)."
    };

    const { data, error } = await supabase
      .from("contact_submissions")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Contact insert error:", error);
      return NextResponse.json(
        {
          success: false,
          error: error.message.includes("contact_submissions")
            ? "Contact storage is not set up. Please run the database migration for contact_submissions."
            : error.message
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, submission: data });
  } catch (error) {
    console.error("Contact form API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
