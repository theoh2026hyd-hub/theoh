-- THE OH ! Cloud Kitchen PostgreSQL Supabase Schema
-- Run this script in the Supabase SQL Editor to initialize the database tables and seed data.

-- 1. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    show_in_menu BOOLEAN NOT NULL DEFAULT TRUE,
    show_section BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    calories INTEGER NOT NULL,
    rating DECIMAL(3, 2) DEFAULT 4.8,
    description TEXT,
    image TEXT,
    in_stock BOOLEAN DEFAULT TRUE,
    quantity INTEGER NOT NULL DEFAULT 100,
    protein DECIMAL(10, 2),
    carbohydrates DECIMAL(10, 2),
    fats DECIMAL(10, 2),
    ingredients TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TABLE IF EXISTS product_addons CASCADE;

-- 3. PRODUCT ADDONS TABLE
CREATE TABLE IF NOT EXISTS product_addons (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    calories DECIMAL(10, 2),
    grams INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(100) PRIMARY KEY, -- Will hold the Razorpay Order ID or custom order reference
    razorpay_order_id VARCHAR(100) UNIQUE NOT NULL,
    razorpay_payment_id VARCHAR(100) UNIQUE,
    razorpay_signature TEXT,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    receiver_name VARCHAR(255) NOT NULL,
    receiver_phone VARCHAR(50) NOT NULL,
    delivery_address TEXT NOT NULL,
    landmark VARCHAR(255),
    pincode VARCHAR(20) NOT NULL,
    delivery_date_time VARCHAR(100),
    special_instructions TEXT,
    subtotal DECIMAL(10, 2) NOT NULL,
    coin_discount DECIMAL(10, 2) DEFAULT 0.00,
    promo_discount DECIMAL(10, 2) DEFAULT 0.00,
    tax DECIMAL(10, 2) NOT NULL,
    grand_total DECIMAL(10, 2) NOT NULL,
    coins_earned INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Culinary Preparation',
    status_class VARCHAR(50) DEFAULT 'preparing',
    order_number INTEGER UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(100) REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    selected_addons JSONB DEFAULT '[]'::jsonb, -- Array of selected addons, e.g., [{"name": "Gold Leaves", "price": 5}]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. COIN WALLET & CUSTOMER LOGS TABLE (Phone-based tracking)
CREATE TABLE IF NOT EXISTS coin_wallet (
    phone VARCHAR(50) PRIMARY KEY,
    balance INTEGER DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. COUPONS TABLE
CREATE TABLE IF NOT EXISTS coupons (
    code VARCHAR(100) PRIMARY KEY,
    discount_percent DECIMAL(5, 2) NOT NULL,
    min_order_amount DECIMAL(10, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    phone_restriction VARCHAR(50), -- Only usable by this specific customer phone (e.g. for 6th order reward)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. ADMIN ORDER LOGS (Notifications & Alerts)
CREATE TABLE IF NOT EXISTS admin_order_logs (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(100) REFERENCES orders(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
);

-- 11. USER DETAILS
CREATE TABLE IF NOT EXISTS user_details (
    phone VARCHAR(50) PRIMARY KEY,
    customer_name VARCHAR(255) DEFAULT 'User',
    delivery_address TEXT DEFAULT 'Sutton Place Hotel, Suite 1402',
    favorites JSONB DEFAULT '[]'::jsonb,
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name VARCHAR(255),
    auth_provider VARCHAR(50) DEFAULT 'email',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. COUPON REDEMPTIONS (one-time use tracking per customer)
CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id SERIAL PRIMARY KEY,
    customer_phone VARCHAR(50) NOT NULL,
    coupon_code VARCHAR(100) NOT NULL,
    order_id VARCHAR(100),
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_phone, coupon_code)
);

-- 15. CONTACT FORM SUBMISSIONS
CREATE TABLE IF NOT EXISTS contact_submissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);



-- ==========================================
-- SEED DATA (INITIAL CATALOG SEEDING)
-- ==========================================

-- Seed Categories
INSERT INTO categories (id, name) VALUES 
(1, 'Sushi'),
(2, 'Hot Plates'),
(3, 'Desserts'),
(4, 'Reserve Pairings')
ON CONFLICT (id) DO NOTHING;

-- Seed Products
INSERT INTO products (id, category_id, name, price, calories, rating, description, image, in_stock) VALUES
(1, 1, 'Chirashi Gold Sushi Bowl', 32.00, 480, 4.90, 'Sashimi-grade bluefin tuna, premium wild-caught salmon belly, Hokkaido uni, gold leaf flake garnish, seasoned heirloom sushi rice.', '/hero_sushi_bowl.png', TRUE),
(2, 1, 'Truffle Bluefin Toro Maki', 24.00, 390, 4.80, 'Chopped bluefin tuna belly, shaved Italian black truffles, cucumber, organic avocado, glazed sweet shoyu, micro shiso.', '/hero_sushi_bowl.png', TRUE),
(3, 2, 'Searing A5 Wagyu Hot Stone', 65.00, 680, 4.90, 'Sliced A5 Miyazaki Wagyu beef seared at your table on a volcanic hot stone, served with white truffle butter and garlic sake-shoyu dipping glaze.', '/wagyu_beef.png', TRUE),
(4, 2, 'Crispy Lobster Truffle Tempura', 42.00, 520, 4.70, 'Maine lobster tail chunks battered and fried in clean sesame oil, drizzled with black truffle oil infusion, served with a sharp yuzu courier-citrus aioli.', '/wagyu_beef.png', TRUE),
(5, 3, 'Kyoto Matcha Molten Lava Cake', 16.00, 410, 4.90, 'Warm ceremonial Uji matcha chocolate cake with an oozing liquid matcha white chocolate core, served with gold leaf and raspberry dust.', '/matcha_lava.png', TRUE),
(6, 3, 'Torched Yuzu Meringue Tartlet', 14.00, 320, 4.80, 'Zesty organic Japanese yuzu custard curd, clouds of toasted Swiss meringue, crispy almond flour shortcrust base, gold leaf accents.', '/matcha_lava.png', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Seed Global Addons
-- We can associate these addon options to the database by matching them in client-side arrays or attaching them in DB.
-- We seed product_addons mapping standard upgrades to each dish
INSERT INTO product_addons (id, product_id, name, price) VALUES
(1, 1, '24K Edible Gold Leaves', 5.00),
(2, 1, 'Premium Hokkaido Uni', 12.00),
(3, 1, 'Shaved Black Truffle', 8.00),
(4, 3, 'Shaved Black Truffle', 8.00),
(5, 3, 'Freshly Grated Wasabi Root', 3.00),
(6, 4, 'Shaved Black Truffle', 8.00),
(7, 5, '24K Edible Gold Leaves', 5.00)
ON CONFLICT (id) DO NOTHING;

-- Seed Pre-defined Coupons
INSERT INTO coupons (code, discount_percent, is_active) VALUES
('WELCOME20', 20.00, TRUE),
('RESERVE10', 10.00, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Seed Settings
INSERT INTO settings (key, value) VALUES
('coins_earned_ratio', '1.0'),
('order_reward_count_trigger', '6'),
('reward_coupon_discount', '15.00'),
('restaurant_name', 'THE OH !'),
('restaurant_phone', '+91 9876543210'),
('restaurant_email', 'concierge@theohreserve.com'),
('restaurant_address', 'Malkam Cheruvu Heritage Rocks, Hyderabad'),
('restaurant_map_link', 'https://maps.app.goo.gl/iYGBPfd8wGH1RgMf7'),
('restaurant_map_embed', 'https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d3619.155609450031!2d78.37295999999999!3d17.385372999999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zMTfCsDIzJzA3LjMiTiA3OMKwMjInMjIuNyJF!5e1!3m2!1sen!2sin!4v1782893765574!5m2!1sen!2sin'),
('delivery_charge', '15.00'),
('delivery_base_km', '3'),
('delivery_base_fee', '100'),
('delivery_extra_km_price', '15'),
('packing_charge', '10.00'),
('gst_percent', '8.0'),
('minimum_order', '0'),
('open_time', '10:00'),
('close_time', '23:00'),
('next_order_number', '1'),
('coins_redemption_enabled', 'true'),
('coins_min_order_amount', '1000'),
('hero_video_url', 'https://res.cloudinary.com/dcttatiuj/video/upload/v1783494867/Video_Project_7_nwnjee.mp4'),
('delivery_time_slots', '[{"label":"10:00 AM - 11:00 AM","startHour":10,"enabled":true},{"label":"11:00 AM - 12:00 PM","startHour":11,"enabled":true},{"label":"12:00 PM - 1:00 PM","startHour":12,"enabled":true},{"label":"1:00 PM - 2:00 PM","startHour":13,"enabled":true},{"label":"2:00 PM - 3:00 PM","startHour":14,"enabled":true},{"label":"3:00 PM - 4:00 PM","startHour":15,"enabled":true},{"label":"4:00 PM - 5:00 PM","startHour":16,"enabled":true},{"label":"5:00 PM - 6:00 PM","startHour":17,"enabled":true},{"label":"6:00 PM - 7:00 PM","startHour":18,"enabled":true},{"label":"7:00 PM - 8:00 PM","startHour":19,"enabled":true},{"label":"8:00 PM - 9:00 PM","startHour":20,"enabled":true},{"label":"9:00 PM - 10:00 PM","startHour":21,"enabled":true},{"label":"10:00 PM - 11:00 PM","startHour":22,"enabled":true}]')
ON CONFLICT (key) DO NOTHING;

-- Seed default user details
INSERT INTO user_details (phone, customer_name, delivery_address, favorites) VALUES
('9876543210', 'User', 'Sutton Place Hotel, Suite 1402', '[1, 3]')
ON CONFLICT (phone) DO NOTHING;

-- Seed a coin wallet for default user 9876543210 (points initially 0)
INSERT INTO coin_wallet (phone, balance, order_count) VALUES
('9876543210', 0, 0)
ON CONFLICT (phone) DO NOTHING;

-- 12. BUSINESS UPDATES TABLE
CREATE TABLE IF NOT EXISTS business_updates (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    content TEXT NOT NULL,
    tag VARCHAR(50) DEFAULT 'New Store', -- e.g. 'Gym Opening', 'Mall Opening', 'Business Update'
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed initial business updates
INSERT INTO business_updates (id, title, subtitle, content, tag, image_url) VALUES
(1, 'New Store Opening at Gold''s Gym', 'Bringing healthy oats bowls closer to your workout routine.', 'We are excited to announce our brand new store inside Gold''s Gym, Jubilee Hills! Fuel your post-workout recovery with our protein-packed oats bowls.', 'Gym Opening', '/masala_oats.png'),
(2, 'Grand Launch in Forum Mall', 'Healthy dining now at your favorite shopping destination.', 'Visit our newly opened outlet at the Food Court in Forum Mall, Kukatpally. Enjoy special launch offers and discount coupons!', 'Mall Opening', '/oats_smoothie.png'),
(3, 'Message from the Founders', 'Wholesome nutrition is our core mission.', 'Our founders share the vision behind THE OH ! oats habit and our commitment to bringing luxury, health-conscious dining options to everyone.', 'Business Update', '/family_combo.png')
ON CONFLICT (id) DO NOTHING;

-- 13. EVENTS TABLE
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    description TEXT NOT NULL,
    requires_registration BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. EVENT REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS event_registrations (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_name VARCHAR(255) NOT NULL,
    user_phone VARCHAR(50) NOT NULL,
    user_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed initial events
INSERT INTO events (id, title, location, event_date, description, requires_registration, image_url) VALUES
(1, 'Startup Hub Fitness Fest', 'T-Hub Stall #12, Gachibowli', '2026-07-15 10:00:00+00', 'We are opening a pop-up kitchen stall at the T-Hub Startup Fest! Meet our founders and register below for exclusive free tastings.', TRUE, '/south_indian_upma.png'),
(2, 'Oats Power Pop-up Gym Stall', 'Cult Fit Hub, Madhapur', '2026-07-20 06:00:00+00', 'Post-workout protein oats bowls pop-up stall. Drop by after your workout session for healthy recovery bowls.', FALSE, '/paneer_oats.png')
ON CONFLICT (id) DO NOTHING;

