import { supabase } from "./supabaseClient";
import {
  PRODUCT_IMAGE_BUCKET,
  PRODUCT_IMAGE_FOLDER,
  getProductImageExtension,
  validateProductImageFile
} from "./productImageValidation";

/**
 * @param {string} originalName
 * @returns {string}
 */
export function buildProductImageStoragePath(originalName = "") {
  const extension = getProductImageExtension(originalName) || ".jpg";
  const fileId = crypto.randomUUID();
  return `${PRODUCT_IMAGE_FOLDER}/${fileId}${extension}`;
}

/**
 * @param {string} storagePath
 * @returns {string}
 */
export function getProductImagePublicUrl(storagePath) {
  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * @param {File | Blob} file
 * @param {string} [originalName]
 * @returns {Promise<{ publicUrl: string, path: string }>}
 */
export async function uploadProductImage(file, originalName = "") {
  const validation = validateProductImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const resolvedName = originalName || (file instanceof File ? file.name : "product.jpg");
  const storagePath = buildProductImageStoragePath(resolvedName);
  const contentType = file.type || "application/octet-stream";

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType
    });

  if (error) {
    throw new Error(error.message || "Failed to upload product image.");
  }

  return {
    path: storagePath,
    publicUrl: getProductImagePublicUrl(storagePath)
  };
}
