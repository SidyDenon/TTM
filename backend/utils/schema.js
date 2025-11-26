// Lightweight runtime schema detection with caching
const cache = new Map();

async function columnExists(db, table, column) {
  const [[{ cnt }]] = await db.query(
    "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column]
  );
  return Number(cnt) > 0;
}

async function resolveColumn(db, table, candidates) {
  const key = `${table}:${candidates.join(',')}`;
  if (cache.has(key)) return cache.get(key);
  for (const col of candidates) {
    // skip falsy
    if (!col) continue;
    if (await columnExists(db, table, col)) {
      cache.set(key, col);
      return col;
    }
  }
  cache.set(key, null);
  return null;
}

export async function getSchemaColumns(db) {
  const clientAddress = await resolveColumn(db, "clients", ["adresse", "address"]);
  const operatorDispo = await resolveColumn(db, "operators", ["dispo", "available", "is_available"]);
  const operatorCreatedAt = await resolveColumn(db, "operators", ["created_at"]);
  return { clientAddress, operatorDispo, operatorCreatedAt };
}

export default { getSchemaColumns };
