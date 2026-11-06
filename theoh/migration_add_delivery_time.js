const { Client } = require('pg');

const pw = process.env.SUPABASE_DB_PASSWORD;
const ref = process.env.SUPABASE_PROJECT_REF || (process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('.')[0] : '');

if (!pw || !ref) {
  console.error("Missing SUPABASE_DB_PASSWORD or SUPABASE_PROJECT_REF / NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

async function migrate() {
  const host = process.env.SUPABASE_POOLER_HOST || 'aws-0-ap-northeast-2.pooler.supabase.com';
  const user = `postgres.${ref}`;
  
  for (const port of [5432, 6543]) {
    const client = new Client({
      host,
      port,
      database: 'postgres',
      user,
      password: pw,
      ssl: { rejectUnauthorized: false }
    });

    try {
      console.log(`Connecting to ${host} on port ${port}...`);
      await client.connect();
      console.log(`SUCCESS! Connected on port ${port}`);
      
      console.log('Adding delivery_date_time to orders table...');
      await client.query(`
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date_time VARCHAR(100);
      `);
      console.log('Column added successfully!');

      await client.end();
      return;
    } catch (e) {
      console.log(`Failed on port ${port}: ${e.message}`);
    }
  }
}

migrate();
