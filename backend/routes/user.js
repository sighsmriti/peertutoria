const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Get user by email (profile load)
router.get("/:email", (req, res) => {
    const email = req.params.email;

    db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
        if (err) return res.status(500).json({ error: err });
        if (results.length === 0) return res.status(404).json({ message: "User not found" });

        res.json(results[0]);
    });
});

module.exports = router;
