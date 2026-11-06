const { Client } = require("pg");

const DEFAULT_DELIVERY_TIME_SLOTS_JSON = JSON.stringify([
  { label: "10:00 AM - 11:00 AM", startHour: 10 },
  { label: "11:00 AM - 12:00 PM", startHour: 11 },
  { label: "12:00 PM - 1:00 PM", startHour: 12 },
  { label: "1:00 PM - 2:00 PM", startHour: 13 },
  { label: "2:00 PM - 3:00 PM", startHour: 14 },
  { label: "3:00 PM - 4:00 PM", startHour: 15 },
  { label: "4:00 PM - 5:00 PM", startHour: 16 },
  { label: "5:00 PM - 6:00 PM", startHour: 17 },
  { label: "6:00 PM - 7:00 PM", startHour: 18 },
  { label: "7:00 PM - 8:00 PM", startHour: 19 },
  { label: "8:00 PM - 9:00 PM", startHour: 20 },
  { label: "9:00 PM - 10:00 PM", startHour: 21 },
  { label: "10:00 PM - 11:00 PM", startHour: 22 }
]);

const pw = process.env.SUPABASE_DB_PASSWORD;
const ref = process.env.SUPABASE_PROJECT_REF || (process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.NEXT_PUBLIC_SUPABASE_URL.replace("https://", "").split(".")[0] : "");

if (!pw || !ref) {
  console.error("Missing SUPABASE_DB_PASSWORD or SUPABASE_PROJECT_REF / NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

async function migrate() {
  const host = process.env.SUPABASE_POOLER_HOST || "aws-0-ap-northeast-2.pooler.supabase.com";
  const user = `postgres.${ref}`;

  for (const port of [5432, 6543]) {
    const client = new Client({
      host,
      port,
      database: "postgres",
      user,
      password: pw,
      ssl: { rejectUnauthorized: false }
    });

    try {
      console.log(`Connecting to ${host} on port ${port}...`);
      await client.connect();
      console.log("Connected. Applying migrations...");

        await client.query(`
          CREATE TABLE IF NOT EXISTS coupon_redemptions (
            id SERIAL PRIMARY KEY,
            customer_phone VARCHAR(50) NOT NULL,
            coupon_code VARCHAR(100) NOT NULL,
            order_id VARCHAR(100),
            redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(customer_phone, coupon_code)
          );
        `);

        await client.query(`
          ALTER TABLE coupons
          ADD COLUMN IF NOT EXISTS min_order_amount DECIMAL(10, 2) DEFAULT 0.00;
        `);

        await client.query(`
          ALTER TABLE orders
          ADD COLUMN IF NOT EXISTS order_number INTEGER UNIQUE;
        `);

        await client.query(`
          WITH numbered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
            FROM orders
            WHERE order_number IS NULL
          )
          UPDATE orders
          SET order_number = numbered.rn
          FROM numbered
          WHERE orders.id = numbered.id;
        `);

        const nextOrderResult = await client.query(`
          SELECT COALESCE(MAX(order_number), 0) + 1 AS next_num FROM orders;
        `);
        const nextOrderNumber = nextOrderResult.rows[0]?.next_num || 1;

        await client.query(
          `
          INSERT INTO settings (key, value)
          VALUES ('next_order_number', $1)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
        `,
          [String(nextOrderNumber)]
        );

        const slotsJson = DEFAULT_DELIVERY_TIME_SLOTS_JSON;
        await client.query(
          `
          INSERT INTO settings (key, value)
          VALUES ('delivery_time_slots', $1)
          ON CONFLICT (key) DO NOTHING;
        `,
          [slotsJson]
        );

        console.log("Migrations applied successfully.");
        await client.end();
        return;
      } catch (error) {
        console.log(`Failed on port ${port}: ${error.message}`);
        try {
          await client.end();
        } catch {
          // ignore
        }
      }
    }

  console.error("Could not connect to database. Run the SQL in schema.sql manually in Supabase.");
}

migrate();
