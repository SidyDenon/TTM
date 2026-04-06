import mysql from "mysql2/promise";
import dotenv from "dotenv";

// Garantit le chargement de .env avant l'initialisation du pool,
// même si db.js est importé avant config/env.js.
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, // <-- IMPORTANT : DB_PASSWORD
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
