import db from "../config/db.js";

const requiredSchema = {
  transactions: ["commission_percent", "payment_method"],
  oil_models: ["unit_price", "price_1l", "price_4l", "price_5l", "price_20l"],
  operators: ["pending_alerts_enabled"],
  admin_users: ["extra_permissions"],
  configurations: [
    "support_email",
    "operator_mission_radius_km",
    "operator_towing_radius_km",
    "site_content_json",
    "towing_price_per_km",
    "towing_base_price",
  ],
  services: ["is_active", "is_internal"],
  mission_feedback: [],
  device_tokens: [],
  vitrine_services: [],
};

try {
  const [rows] = await db.query(
    "SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()"
  );
  const actual = new Map();
  for (const row of rows) {
    if (!actual.has(row.TABLE_NAME)) actual.set(row.TABLE_NAME, new Set());
    actual.get(row.TABLE_NAME).add(row.COLUMN_NAME);
  }

  const missing = [];
  for (const [table, columns] of Object.entries(requiredSchema)) {
    if (!actual.has(table)) {
      missing.push(`table:${table}`);
      continue;
    }
    for (const column of columns) {
      if (!actual.get(table).has(column)) missing.push(`column:${table}.${column}`);
    }
  }

  console.log(JSON.stringify({ connected: true, compatible: missing.length === 0, missing }, null, 2));
  process.exitCode = missing.length ? 2 : 0;
} catch (error) {
  console.error(JSON.stringify({ connected: false, error: error.code || error.message }, null, 2));
  process.exitCode = 1;
} finally {
  await db.end();
}
