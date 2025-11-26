export const UserModel = {
  async findById(db, id) {
    const [[row]] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    return row;
  },

  async findByEmailOrPhone(db, email, phone) {
    const [rows] = await db.query(
      "SELECT * FROM users WHERE email = ? OR phone = ?",
      [email, phone]
    );
    return rows[0];
  },

  async create(db, { name, phone, email, password, role }) {
    const [result] = await db.query(
      "INSERT INTO users (name, phone, email, password, role, must_change_password) VALUES (?, ?, ?, ?, ?, 1)",
      [name, phone, email, password, role]
    );
    return result.insertId;
  },
};
