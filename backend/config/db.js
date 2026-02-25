require("dotenv").config();
const mysql = require("mysql2");
const fs = require("fs");
const path = require("path");

let sslConfig = {};

try {
  const caPath = path.join(__dirname, "ca.pem");

  if (fs.existsSync(caPath)) {
    // Local environment (secure with CA)
    sslConfig = { ca: fs.readFileSync(caPath) };
    console.log("SSL: Using CA certificate (local)");
  } else {
    // Render / Cloud (allow Aiven SSL)
    sslConfig = { rejectUnauthorized: false };
    console.log("SSL: Using Aiven SSL (Render)");
  }
} catch (err) {
  sslConfig = { rejectUnauthorized: false };
}

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: sslConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = db.promise();