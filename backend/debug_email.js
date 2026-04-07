import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { sendMail } from "./utils/mailer.js";

dotenv.config();

async function test() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "ttm",
  });

  // 1. Vérifier si le client existe
  const [users] = await conn.query(
    "SELECT id, name, email, phone, role FROM users WHERE email = ? LIMIT 1",
    ["dm.diarramoussa@gmail.com"]
  );

  console.log("📋 Client trouvé en BD:");
  console.log(users);

  if (users.length === 0) {
    console.log("❌ PROBLÈME: Aucun client avec cet email!");
    await conn.end();
    return;
  }

  const client = users[0];
  console.log(`\n✅ Client trouvé : ${client.name} (ID: ${client.id})`);
  console.log(`   Email: ${client.email}`);
  console.log(`   Phone: ${client.phone}`);
  console.log(`   Role: ${client.role}`);

  // 2. Tester l'envoi d'email
  console.log("\n📧 Test d'envoi d'email...");
  try {
    const result = await sendMail(
      client.email,
      "🧪 Test Email TTM",
      "Ceci est un email de test.",
      "<h2>Test Email</h2><p>Si vous lisez ceci, le système d'email fonctionne!</p>"
    );
    console.log("✅ Email envoyé avec succès!");
    console.log("Réponse:", result);
  } catch (err) {
    console.error("❌ ERREUR lors de l'envoi:", err.message);
    console.error("Détails complets:", err);
  }

  await conn.end();
  process.exit(0);
}

test().catch(console.error);
