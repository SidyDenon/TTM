import db from "../config/db.js";

try {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME IN ('reset_code', 'reset_expires')`
  );
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await db.end();
}
