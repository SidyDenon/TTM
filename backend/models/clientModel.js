import { getSchemaColumns } from "../utils/schema.js";

export const ClientModel = {
  async create(db, userId, adresse) {
    const { clientAddress } = await getSchemaColumns(db);
    if (clientAddress) {
      await db.query(`INSERT INTO clients (user_id, ${clientAddress}) VALUES (?, ?)`, [
        userId,
        adresse,
      ]);
    } else {
      await db.query(`INSERT INTO clients (user_id) VALUES (?)`, [userId]);
    }
  },

  async findByUserId(db, userId) {
    const [[row]] = await db.query("SELECT * FROM clients WHERE user_id = ?", [
      userId,
    ]);
    return row;
  },
};
