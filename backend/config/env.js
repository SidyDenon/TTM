import dotenv from "dotenv";

dotenv.config();

export async function validateEnv(db) {
  const skipDbCheck = process.env.SKIP_DB_CHECK === "1";
  const requiredAlways = ["JWT_SECRET"]; // requis pour auth/API/Socket
  const requiredForDb = ["DB_HOST", "DB_USER", "DB_NAME"]; // DB_PASS optionnel
  const requiredEnv = [...requiredAlways, ...(skipDbCheck ? [] : requiredForDb)];
  const missingEnv = requiredEnv.filter((k) => !process.env[k]);
  if (missingEnv.length) {
    console.error("❌ Variables d'environnement manquantes:", missingEnv.join(", "));
    process.exit(1);
  }

  if (!skipDbCheck) {
    try {
      await db.query("SELECT 1");
      console.log("✅ Connexion DB réussie");
    } catch (err) {
      console.error("❌ Erreur connexion DB:", err.message);
      process.exit(1);
    }
  } else {
    console.log("⚠️ SKIP_DB_CHECK=1 → ping DB ignoré (mode test)");
  }
}
