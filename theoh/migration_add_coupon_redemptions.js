/**
 * Migration: create coupon_redemptions table for one-time offer/coupon tracking.
 * Run: node migration_add_coupon_redemptions.js
 */
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function migrate() {
  const { error } = await supabase.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS coupon_redemptions (
        id SERIAL PRIMARY KEY,
        customer_phone VARCHAR(50) NOT NULL,
        coupon_code VARCHAR(100) NOT NULL,
        order_id VARCHAR(100),
        redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(customer_phone, coupon_code)
      );
    `
  });

  if (error) {
    console.log("Note: If exec_sql RPC is unavailable, run this SQL manually in Supabase:");
    console.log(`
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id SERIAL PRIMARY KEY,
  customer_phone VARCHAR(50) NOT NULL,
  coupon_code VARCHAR(100) NOT NULL,
  order_id VARCHAR(100),
  redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_phone, coupon_code)
);
    `);
    console.error(error.message);
    return;
  }

  console.log("coupon_redemptions table ready.");
}

migrate();
