-- Run in Supabase SQL Editor (optional — app works without this column)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date_time VARCHAR(100);
