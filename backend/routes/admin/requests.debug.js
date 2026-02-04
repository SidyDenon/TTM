import express from "express";

const router = express.Router();

export default (db) => {
  router.get("/_debug", async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT id, status, created_at
         FROM requests
         ORDER BY created_at DESC
         LIMIT 5`
      );
      res.json({ ok: true, sample: rows });
    } catch (e) {
      console.error("SQL DEBUG /_debug:", e.code, e.sqlMessage || e.message);
      res.status(500).json({
        ok: false,
        error: e.code || "DB_FAIL",
        detail: e.sqlMessage || e.message,
      });
    }
  });

  router.get("/_stats", async (req, res) => {
    try {
      const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM requests`);

      const [byStatus] = await db.query(
        `SELECT status, COUNT(*) AS n
         FROM requests
         GROUP BY status
         ORDER BY n DESC`
      );

      const [latest] = await db.query(
        `SELECT id, status, created_at
         FROM requests
         ORDER BY created_at DESC
         LIMIT 10`
      );

      res.json({ total, byStatus, latest });
    } catch (e) {
      console.error("SQL DEBUG /_stats:", e.code, e.sqlMessage || e.message);
      res.status(500).json({
        error: e.code || "DB_FAIL",
        detail: e.sqlMessage || e.message,
      });
    }
  });

  return router;
};
