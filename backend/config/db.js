require("dotenv").config();
const mysql = require("mysql2");
const fs = require("fs");
const path = require("path");

let sslConfig = {};

try {
  const caPath = path.join(__dirname, "ca.pem");

  if (fs.existsSync(caPath)) {
    // Local environment (uses CA certificate)
    sslConfig = { ca: fs.readFileSync(caPath) };
    console.log("SSL: Using CA certificate (local mode)");
  } else {
    // Render / cloud environment (no ca.pem present)
    sslConfig = { rejectUnauthorized: true };
    console.log("SSL: Using secure connection without CA (Render mode)");
  }
} catch (err) {
  console.log("SSL fallback activated");
  sslConfig = { rejectUnauthorized: true };
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