-- Run this in Supabase SQL Editor (Dashboard → SQL → New query)

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id SERIAL PRIMARY KEY,
  customer_phone VARCHAR(50) NOT NULL,
  coupon_code VARCHAR(100) NOT NULL,
  order_id VARCHAR(100),
  redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_phone, coupon_code)
);

ALTER TABLE coupons
ADD COLUMN IF NOT EXISTS min_order_amount DECIMAL(10, 2) DEFAULT 0.00;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS order_number INTEGER UNIQUE;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM orders
  WHERE order_number IS NULL
)
UPDATE orders
SET order_number = numbered.rn
FROM numbered
WHERE orders.id = numbered.id;

INSERT INTO settings (key, value)
VALUES (
  'next_order_number',
  (SELECT COALESCE(MAX(order_number), 0) + 1 FROM orders)::text
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO settings (key, value)
VALUES (
  'delivery_time_slots',
  '[{"label":"10:00 AM - 11:00 AM","startHour":10},{"label":"11:00 AM - 12:00 PM","startHour":11},{"label":"12:00 PM - 1:00 PM","startHour":12},{"label":"1:00 PM - 2:00 PM","startHour":13},{"label":"2:00 PM - 3:00 PM","startHour":14},{"label":"3:00 PM - 4:00 PM","startHour":15},{"label":"4:00 PM - 5:00 PM","startHour":16},{"label":"5:00 PM - 6:00 PM","startHour":17},{"label":"6:00 PM - 7:00 PM","startHour":18},{"label":"7:00 PM - 8:00 PM","startHour":19},{"label":"8:00 PM - 9:00 PM","startHour":20},{"label":"9:00 PM - 10:00 PM","startHour":21},{"label":"10:00 PM - 11:00 PM","startHour":22}]'
)
ON CONFLICT (key) DO NOTHING;
