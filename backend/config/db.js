require("dotenv").config();
const mysql = require("mysql2");
const fs = require("fs");
const path = require("path");

const caPath = path.join(__dirname, "ca.pem");

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: {
        ca: fs.readFileSync(caPath)
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = db.promise();