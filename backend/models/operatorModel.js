import { getSchemaColumns } from "../utils/schema.js";

export const OperatorModel = {
  async create(db, userId, ville, quartier) {
    const { operatorDispo, operatorCreatedAt } = await getSchemaColumns(db);
    const columns = ["user_id", "ville", "quartier"];
    const placeholders = ["?", "?", "?"];
    const values = [userId, ville, quartier];

    if (operatorDispo) {
      columns.push(operatorDispo);
      placeholders.push("?");
      values.push(1);
    }

    if (operatorCreatedAt) {
      columns.push(operatorCreatedAt);
      placeholders.push("NOW()");
    }

    const sql = `INSERT INTO operators (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`;
    await db.query(sql, values);
  },

  async findByUserId(db, userId) {
    const [[row]] = await db.query(
      "SELECT * FROM operators WHERE user_id = ?",
      [userId]
    );
    return row;
  },
};
