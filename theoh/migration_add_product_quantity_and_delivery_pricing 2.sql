-- Add inventory quantity column to products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 100;

-- Delivery pricing settings (base km threshold, base fee, extra km price)
INSERT INTO settings (key, value) VALUES
('delivery_base_km', '3'),
('delivery_base_fee', '100'),
('delivery_extra_km_price', '15')
ON CONFLICT (key) DO NOTHING;
