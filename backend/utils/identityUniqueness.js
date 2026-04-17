const columnCache = new Map();

const normalizeEmail = (value) => {
  const v = String(value || "").trim().toLowerCase();
  return v || null;
};

const normalizePhone = (value) => {
  const v = String(value || "").trim();
  return v || null;
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
    const [rows] = await db.query(
      "SELECT id FROM users WHERE phone = ? AND (? IS NULL OR id <> ?) LIMIT 1",
      [normalizedPhone, excludeUserId, excludeUserId]
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
    const [rows] = await db.query(
      "SELECT id FROM admin_users WHERE phone = ? AND (? IS NULL OR id <> ?) LIMIT 1",
      [normalizedPhone, excludeAdminId, excludeAdminId]
    );
    if (rows.length > 0) {
      return { table: "admin_users", field: "phone", id: rows[0].id };
    }
  }

  return null;
};
