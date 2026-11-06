-- Supabase Storage setup for product image uploads
-- Run this in the Supabase SQL Editor if the bucket does not exist yet.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY IF NOT EXISTS "Public read product images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'product-images');
