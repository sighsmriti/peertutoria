const db = require("../config/db");
const { rankTutors } = require("../utils/matcher");

exports.matchTutor = (req, res) => {
    const { subject } = req.body;

    if (!subject) {
        return res.status(400).json({ error: "Subject is required" });
    }

    db.query(`
        SELECT 
            id,
            name,
            skills,
            rating,
            rating_count,
            xp,
            is_online
        FROM users
        WHERE role = 'peer'
    `, (err, rows) => {

        if (err) {
            console.error("Matcher DB error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (!rows || rows.length === 0) {
            return res.json([]);
        }

        // Convert DB rows → usable tutor objects
        const tutors = rows.map(user => ({
            id: user.id,
            name: user.name,
            skills: user.skills
                ? user.skills
                    .split(",")
                    .map(s => s.trim().toLowerCase())
                : [],
            rating: user.rating || 0,
            rating_count: user.rating_count || 0,
            xp: user.xp || 0,
            is_online: !!user.is_online
        }));

        // Rank tutors using matcher logic
        const rankedTutors = rankTutors(tutors, {
            subject: subject.toLowerCase()
        });

        res.json(rankedTutors);
    });
};