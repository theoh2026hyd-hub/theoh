/**
 * Migrate auth.users + product-images bucket into the new Supabase project.
 * Uses OLD_SUPABASE_URL + NEW service role / DB password from .env.local
 */
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { Client } = require("pg");

const NEW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const OLD_URL = process.env.OLD_SUPABASE_URL || "";
const ref = NEW_URL ? NEW_URL.replace("https://", "").split(".")[0] : "";

function loadUsers() {
  const usersFile = process.env.USERS_IMPORT_FILE || path.join(__dirname, "users_migration.json");
  if (fs.existsSync(usersFile)) {
    try {
      return JSON.parse(fs.readFileSync(usersFile, "utf8"));
    } catch (e) {
      console.warn("Failed to parse users migration file:", e.message);
    }
  }
  return [];
}

const USERS = loadUsers();

const STORAGE_FILES = [
  "products/0268c5a6-b1e0-4dce-aba3-d515779cb2e5.png",
  "products/07c89c3f-a151-42a7-962b-2b99c21f76bd.jpg",
  "products/30ad3354-196a-4dcc-b05a-f413d5f66877.jpg",
  "products/4a3adb10-9ea4-4dd1-81c2-5352811a7f4f.jpg",
  "products/4d86d0bf-4c01-4fc7-ac0b-f71a58f8ae66.png",
  "products/662ec380-f7aa-4255-84a9-b930b61df315.jpg",
  "products/73dd7da3-3412-45cf-9807-556833944bd4.webp",
  "products/7c7c265e-4796-41c1-82ba-a96a63fff5a5.jpg",
  "products/841716bb-729b-4344-a196-35f7e8c8673b.jpg",
  "products/89a4e982-6931-405a-8379-7a343a23205d.webp",
  "products/89a7767e-ffda-4ccd-b754-dcc9191b807e.jpg",
  "products/9b5be636-a9e2-4f90-8d3a-a1ef1e83ba46.webp",
  "products/c661a575-627e-45e3-b721-0d0beab81c5c.jpeg",
  "products/d2b07db0-ad97-46dc-b698-62e8d560ca06.jpg",
  "products/ee1a7325-f0b6-4064-937d-842de1ec2d7c.jpg",
  "products/fecbef15-e7b9-48c3-acd8-e750d72d25e6.png"
];

async function connectPg() {
  const password = encodeURIComponent(DB_PASSWORD);
  const host = process.env.SUPABASE_POOLER_HOST || "aws-1-ap-northeast-2.pooler.supabase.com";
  const cs = `postgresql://postgres.${ref}:${password}@${host}:6543/postgres`;
  const client = new Client({
    connectionString: cs,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}

async function migrateAuth(client) {
  if (USERS.length === 0) {
    console.log("No users found in migration file. Skipping auth.users migration.");
    return;
  }
  console.log(`Migrating ${USERS.length} auth.users...`);
  const { rows: instances } = await client.query(
    "SELECT id FROM auth.instances LIMIT 1"
  );
  const instanceId = instances[0]?.id || "00000000-0000-0000-0000-000000000000";

  for (const user of USERS) {
    await client.query(
      `INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        last_sign_in_at, is_sso_user
      ) VALUES (
        $1, $2, 'authenticated', 'authenticated', $3, $4, $5,
        $6::jsonb, $7::jsonb, $8, $9,
        '', '', '', '',
        $10, false
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        encrypted_password = EXCLUDED.encrypted_password,
        email_confirmed_at = EXCLUDED.email_confirmed_at,
        raw_app_meta_data = EXCLUDED.raw_app_meta_data,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = EXCLUDED.updated_at,
        last_sign_in_at = EXCLUDED.last_sign_in_at`,
      [
        user.id,
        instanceId,
        user.email,
        user.encrypted_password,
        user.email_confirmed_at,
        JSON.stringify(user.raw_app_meta_data),
        JSON.stringify(user.raw_user_meta_data),
        user.created_at,
        user.updated_at,
        user.last_sign_in_at
      ]
    );

    await client.query(
      `INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) VALUES (
        $1::uuid, $2::uuid, $3::jsonb, 'email', $4::text, $5::timestamptz, $6::timestamptz, $7::timestamptz
      )
      ON CONFLICT (id) DO NOTHING`,
      [
        user.identity_id,
        user.id,
        JSON.stringify({
          sub: user.id,
          email: user.email,
          email_verified: true,
          phone_verified: false
        }),
        user.id,
        user.last_sign_in_at,
        user.created_at,
        user.updated_at
      ]
    );
    console.log("  user", user.email);
  }

  // Re-link user_details.user_id by email
  await client.query(`
    UPDATE user_details ud
    SET user_id = u.id
    FROM auth.users u
    WHERE lower(ud.email) = lower(u.email)
  `);
  console.log("Linked user_details.user_id by email");
}

async function migrateStorage(supabase) {
  if (!OLD_URL) {
    console.log("OLD_SUPABASE_URL not configured. Skipping storage copy.");
    return;
  }
  console.log("Creating product-images bucket...");
  const { error: bucketError } = await supabase.storage.createBucket("product-images", {
    public: true,
    fileSizeLimit: 5242880,
    allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"]
  });
  if (bucketError && !/already exists/i.test(bucketError.message)) {
    // try update
    await supabase.storage.updateBucket("product-images", {
      public: true,
      fileSizeLimit: 5242880,
      allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    });
  }

  let copied = 0;
  for (const filePath of STORAGE_FILES) {
    const oldUrl = `${OLD_URL}/storage/v1/object/public/product-images/${filePath}`;
    try {
      const res = await fetch(oldUrl);
      if (!res.ok) {
        console.log("  skip missing", filePath, res.status);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") || "application/octet-stream";
      const { error } = await supabase.storage.from("product-images").upload(filePath, buf, {
        contentType,
        upsert: true
      });
      if (error) {
        console.log("  upload fail", filePath, error.message);
      } else {
        copied += 1;
        console.log("  copied", filePath);
      }
    } catch (err) {
      console.log("  error", filePath, err.message);
    }
  }
  console.log(`Copied ${copied}/${STORAGE_FILES.length} files`);

  // Rewrite image URLs in products / upcoming_items
  const oldHost = new URL(OLD_URL).hostname;
  const { data: products } = await supabase.from("products").select("id, image");
  for (const p of products || []) {
    if (p.image && String(p.image).includes(oldHost)) {
      const next = String(p.image).replace(OLD_URL, NEW_URL);
      await supabase.from("products").update({ image: next }).eq("id", p.id);
    }
  }
  const { data: upcoming } = await supabase.from("upcoming_items").select("id, image");
  for (const item of upcoming || []) {
    if (item.image && String(item.image).includes(oldHost)) {
      const next = String(item.image).replace(OLD_URL, NEW_URL);
      await supabase.from("upcoming_items").update({ image: next }).eq("id", item.id);
    }
  }
  console.log("Updated image URLs to new project");
}

async function main() {
  if (!NEW_URL || !SERVICE_KEY || !DB_PASSWORD) {
    throw new Error("Missing NEW_URL / SERVICE_KEY / SUPABASE_DB_PASSWORD");
  }
  const client = await connectPg();
  await migrateAuth(client);
  await client.end();

  const supabase = createClient(NEW_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  await migrateStorage(supabase);

  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 100 });
  console.log("\nAuth users on new project:", users?.users?.length || 0);
  const { data: files } = await supabase.storage.from("product-images").list("products");
  console.log("Storage files in products/:", files?.length || 0);
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
