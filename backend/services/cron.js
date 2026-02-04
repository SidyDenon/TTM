import cron from "node-cron";

export function startCron(db) {
  cron.schedule("0 0 * * *", async () => {
    try {
      const [result] = await db.query(
        "UPDATE users SET reset_code = NULL, reset_expires = NULL WHERE reset_expires < NOW()"
      );
      console.log(`🧹 Nettoyage tokens expirés : ${result.affectedRows} ligne(s)`);
    } catch (err) {
      console.error("❌ Erreur cron nettoyage:", err);
    }
  });
}
