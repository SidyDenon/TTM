export const RequestModel = {
  async create(db, userId, service, description, lat, lng, address, zone) {
    const [result] = await db.query(
      "INSERT INTO requests (user_id, service, description, lat, lng, address, zone, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente', NOW())",
      [userId, service, description, lat, lng, address, zone]
    );
    return result.insertId;
  },

  async findById(db, id) {
    const [[row]] = await db.query("SELECT * FROM requests WHERE id = ?", [id]);
    return row;
  },

  async listByClient(db, userId) {
    const [rows] = await db.query(
      "SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    return rows;
  },
};
