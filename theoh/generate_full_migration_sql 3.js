const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "migration_dump");

function esc(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

function insertSQL(table, rows) {
  if (!rows.length) return `-- ${table} empty\n`;
  const cols = Object.keys(rows[0]);
  let out = `INSERT INTO ${table} (${cols.join(", ")}) VALUES\n`;
  out += rows
    .map((r) => `  (${cols.map((c) => esc(r[c])).join(", ")})`)
    .join(",\n");
  out += "\nON CONFLICT DO NOTHING;\n\n";
  return out;
}

const order = [
  "categories",
  "products",
  "product_addons",
  "settings",
  "coupons",
  "coin_wallet",
  "orders",
  "order_items",
  "admin_order_logs",
  "user_details",
  "upcoming_items",
  "contact_submissions"
];

let sql = fs.readFileSync(path.join(dir, "01_schema.sql"), "utf8") + "\n\n";

for (const t of order) {
  const rows = JSON.parse(fs.readFileSync(path.join(dir, `${t}.json`), "utf8"));
  if (t === "user_details") {
    rows.forEach((r) => {
      r.user_id = null;
    });
  }
  sql += insertSQL(t, rows);
}

sql += `
SELECT setval(pg_get_serial_sequence('categories','id'), COALESCE((SELECT MAX(id) FROM categories), 1));
SELECT setval(pg_get_serial_sequence('products','id'), COALESCE((SELECT MAX(id) FROM products), 1));
SELECT setval(pg_get_serial_sequence('product_addons','id'), COALESCE((SELECT MAX(id) FROM product_addons), 1));
SELECT setval(pg_get_serial_sequence('order_items','id'), COALESCE((SELECT MAX(id) FROM order_items), 1));
SELECT setval(pg_get_serial_sequence('admin_order_logs','id'), COALESCE((SELECT MAX(id) FROM admin_order_logs), 1));
SELECT setval(pg_get_serial_sequence('contact_submissions','id'), COALESCE((SELECT MAX(id) FROM contact_submissions), 1));
`;

const outPath = path.join(dir, "FULL_MIGRATION.sql");
fs.writeFileSync(outPath, sql);
console.log("Wrote", outPath, "bytes", fs.statSync(outPath).size);
