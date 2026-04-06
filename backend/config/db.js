import mysql from "mysql2/promise";
// dotenv est chargé une seule fois dans config/env.js au démarrage

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
