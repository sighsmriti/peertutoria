const mysql = require("mysql2/promise");

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "admin",
    database: "peertutoria",

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Optional test connection (runs once)
(async () => {
    try {
        const conn = await db.getConnection();
        console.log("✅ MySQL Connected Successfully");
        conn.release();
    } catch (err) {
        console.error("❌ MySQL Connection Error:", err);
    }
})();

module.exports = db;
