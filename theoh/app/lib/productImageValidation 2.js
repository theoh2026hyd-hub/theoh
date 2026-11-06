/** @typedef {{ valid: true }} ProductImageValidationSuccess */
/** @typedef {{ valid: false, error: string }} ProductImageValidationFailure */
/** @typedef {ProductImageValidationSuccess | ProductImageValidationFailure} ProductImageValidationResult */

export const PRODUCT_IMAGE_BUCKET = "product-images";
export const PRODUCT_IMAGE_FOLDER = "products";
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_PRODUCT_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp"
]);

export const ALLOWED_PRODUCT_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
]);

/**
 * @param {string} fileName
 * @returns {string}
 */
export function getProductImageExtension(fileName = "") {
  const match = String(fileName).toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : "";
}

/**
 * @param {File | { name?: string, type?: string, size?: number }} file
 * @returns {ProductImageValidationResult}
 */
export function validateProductImageFile(file) {
  if (!file) {
    return { valid: false, error: "Please select an image file." };
  }

  const mimeType = String(file.type || "").toLowerCase();
  const extension = getProductImageExtension(file.name || "");
  const mimeAllowed = ALLOWED_PRODUCT_IMAGE_MIME_TYPES.has(mimeType);
  const extensionAllowed = ALLOWED_PRODUCT_IMAGE_EXTENSIONS.has(extension);

  if (!mimeAllowed && !extensionAllowed) {
    return {
      valid: false,
      error: "Only JPG, JPEG, PNG, and WebP images are allowed."
    };
  }

  if (typeof file.size === "number" && file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return {
      valid: false,
      error: "Image must be 5 MB or smaller."
    };
  }

  return { valid: true };
}
