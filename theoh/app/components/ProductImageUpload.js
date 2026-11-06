"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { validateProductImageFile } from "../lib/productImageValidation";
import { parseJsonResponse } from "../lib/fetchJson";

/**
 * @param {{
 *   imageUrl: string,
 *   onImageUrlChange: (url: string) => void,
 *   onUploadingChange?: (uploading: boolean) => void,
 *   disabled?: boolean,
 *   label?: string,
 *   inputId?: string
 * }} props
 */
export default function ProductImageUpload({
  imageUrl,
  onImageUrlChange,
  onUploadingChange,
  disabled = false,
  label = "Product Image",
  inputId = "product-image-file-input"
}) {
  const fileInputRef = useRef(null);
  const previewObjectUrlRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(imageUrl || "");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uploading) {
      setPreviewUrl(imageUrl || "");
      if (!imageUrl) {
        setSelectedFileName("");
      }
    }
  }, [imageUrl, uploading]);

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [uploading, onUploadingChange]);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  const clearPreviewObjectUrl = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setError("");
    setSelectedFileName(file.name);

    const validation = validateProductImageFile(file);
    if (!validation.valid) {
      setError(validation.error);
      setSelectedFileName("");
      return;
    }

    clearPreviewObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/upload-product-image", {
        method: "POST",
        body: formData
      });

      const data = await parseJsonResponse(response);
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to upload product image.");
      }

      clearPreviewObjectUrl();
      onImageUrlChange(data.data.url);
      setPreviewUrl(data.data.url);
      setSelectedFileName(file.name);
    } catch (uploadError) {
      console.error(uploadError);
      clearPreviewObjectUrl();
      setPreviewUrl(imageUrl || "");
      setSelectedFileName("");
      setError(uploadError.message || "Failed to upload product image.");
    } finally {
      setUploading(false);
    }
  };

  const displayName = selectedFileName || (imageUrl ? "Current image saved" : "No file chosen");

  return (
    <div className="product-image-upload input-group">
      <span className="product-image-upload__label">{label}</span>

      <div className="product-image-upload__picker">
        <input
          ref={fileInputRef}
          id={inputId}
          className="product-image-upload__input"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={disabled || uploading}
        />
        <button
          type="button"
          className="product-image-upload__btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          Choose Image
        </button>
        <span className="product-image-upload__filename" title={displayName}>
          {displayName}
        </span>
      </div>

      <span className="product-image-upload__hint">
        JPG, JPEG, PNG, or WebP up to 5 MB.
      </span>

      {error && (
        <p className="product-image-upload__error">{error}</p>
      )}

      {uploading && (
        <div className="product-image-upload__status">
          <Loader2 size={14} style={{ animation: "spinner-rot 1s linear infinite" }} />
          Uploading image...
        </div>
      )}

      {previewUrl && (
        <div className="product-image-upload__preview-wrap">
          <img src={previewUrl} alt="Product preview" />
        </div>
      )}
    </div>
  );
}
