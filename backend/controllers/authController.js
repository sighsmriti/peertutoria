const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = (req, res) => {
    const { name, email, password, role, institute, education, skills } = req.body;

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.json({ message: "Hash error" });

        const sql = `
            INSERT INTO users (name, email, password, role, institute, education, skills) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(sql, [name, email, hash, role, institute, education, skills], (err, result) => {
            if (err) return res.json({ message: "Register error", error: err });

            res.json({ message: "User registered successfully" });
        });
    });
};

exports.login = (req, res) => {
    const { email, password } = req.body;

    db.query("SELECT * FROM users WHERE email = ?", [email], (err, users) => {
        if (err || users.length === 0) {
            return res.json({ message: "User not found" });
        }

        const user = users[0];

        bcrypt.compare(password, user.password, (err, match) => {
            if (!match) return res.json({ message: "Incorrect password" });

            const token = jwt.sign({ id: user.id, role: user.role }, "SECRET123");

            res.json({
                message: "Login successful",
                token,
                user
            });
        });
    });
};
