import { NextResponse } from "next/server";
import { registerForEvent } from "@/app/lib/dbService";
import { getPhoneLast10, isValidPhone } from "@/app/lib/phone";

export async function POST(request) {
  try {
    const body = await request.json();
    const { eventId, name, phone, email } = body;
    const normalizedPhone = getPhoneLast10(phone);

    if (!eventId || !name || !phone) {
      return NextResponse.json(
        { success: false, error: "Event ID, Guest Name, and Phone are required." },
        { status: 400 }
      );
    }

    if (!isValidPhone(normalizedPhone)) {
      return NextResponse.json(
        {
          success: false,
          error: "Phone number must be exactly 10 digits. Extra digits are not allowed.",
        },
        { status: 400 }
      );
    }

    const data = await registerForEvent(eventId, {
      user_name: name,
      user_phone: normalizedPhone,
      user_email: email
    });

    return NextResponse.json({
      success: true,
      message: "Successfully registered for event!",
      data
    });
  } catch (error) {
    console.error("Error registering guest for event:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
