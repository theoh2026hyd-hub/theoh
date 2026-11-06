import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/app/lib/adminAuth";
import { uploadProductImage } from "@/app/lib/productImageStorage";
import { validateProductImageFile } from "@/app/lib/productImageValidation";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Please select an image file." },
        { status: 400 }
      );
    }

    const validation = validateProductImageFile(file);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const { publicUrl, path } = await uploadProductImage(file, file.name);

    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        path
      }
    });
  } catch (error) {
    console.error("Product image upload failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to upload product image."
      },
      { status: 500 }
    );
  }
}
