const columnCache = new Map();

const normalizeEmail = (value) => {
  const v = String(value || "").trim().toLowerCase();
  return v || null;
};

const normalizePhone = (value) => {
  let valueDigits = String(value || "").replace(/[^\d+]/g, "");
  if (!valueDigits) return null;
  if (valueDigits.startsWith("00")) valueDigits = `+${valueDigits.slice(2)}`;
  if (!valueDigits.startsWith("+")) {
    const digits = valueDigits.replace(/\D/g, "");
    valueDigits = digits.startsWith("223") ? `+${digits}` : `+223${digits}`;
  }
  return valueDigits;
};

const phoneVariants = (phone) => {
  if (!phone) return [];
  const withoutPlus = phone.slice(1);
  const local = withoutPlus.startsWith("223") ? withoutPlus.slice(3) : withoutPlus;
  return Array.from(new Set([phone, withoutPlus, local]));
};

const hasColumn = async (db, table, column) => {
  const key = `${table}:${column}`;
  if (columnCache.has(key)) return columnCache.get(key);

  const [[{ cnt }]] = await db.query(
    "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column]
  );

  const exists = Number(cnt) > 0;
  columnCache.set(key, exists);
  return exists;
};

export const findIdentityConflict = async (
  db,
  { email, phone, excludeUserId = null, excludeAdminId = null } = {}
) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedEmail && !normalizedPhone) {
    return null;
  }

  if (normalizedPhone) {
    const variants = phoneVariants(normalizedPhone);
    const [rows] = await db.query(
      `SELECT id FROM users WHERE phone IN (${variants.map(() => "?").join(",")}) AND (? IS NULL OR id <> ?) LIMIT 1`,
      [...variants, excludeUserId, excludeUserId]
    );
    if (rows.length > 0) {
      return { table: "users", field: "phone", id: rows[0].id };
    }
  }

  if (normalizedEmail) {
    const [rows] = await db.query(
      "SELECT id FROM users WHERE email = ? AND (? IS NULL OR id <> ?) LIMIT 1",
      [normalizedEmail, excludeUserId, excludeUserId]
    );
    if (rows.length > 0) {
      return { table: "users", field: "email", id: rows[0].id };
    }
  }

  if (normalizedEmail) {
    const [rows] = await db.query(
      "SELECT id FROM admin_users WHERE email = ? AND (? IS NULL OR id <> ?) LIMIT 1",
      [normalizedEmail, excludeAdminId, excludeAdminId]
    );
    if (rows.length > 0) {
      return { table: "admin_users", field: "email", id: rows[0].id };
    }
  }

  if (normalizedPhone && (await hasColumn(db, "admin_users", "phone"))) {
    const variants = phoneVariants(normalizedPhone);
    const [rows] = await db.query(
      `SELECT id FROM admin_users WHERE phone IN (${variants.map(() => "?").join(",")}) AND (? IS NULL OR id <> ?) LIMIT 1`,
      [...variants, excludeAdminId, excludeAdminId]
    );
    if (rows.length > 0) {
      return { table: "admin_users", field: "phone", id: rows[0].id };
    }
  }

  return null;
};
