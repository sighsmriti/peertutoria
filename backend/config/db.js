const mysql = require("mysql2");
const fs = require("fs");
const path = require("path");

const caPath = path.join(__dirname, "ca.pem");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,

  ssl: {
    ca: fs.readFileSync(caPath)
  },

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = db.promise();