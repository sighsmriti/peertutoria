const db = require("../config/db");
const { rankTutors } = require("../utils/matcher");

exports.matchTutor = async (req, res) => {
    try {
        const { subject } = req.body;

        if (!subject) {
            return res.status(400).json({ error: "Subject is required" });
        }

        // Fetch all peers (tutors) from DB
        const [rows] = await db.query(`
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
        `);

        if (!rows || rows.length === 0) {
            return res.json([]);
        }

        // Convert DB rows → usable tutor objects
        const tutors = rows.map(user => ({
            id: user.id,
            name: user.name,

            // Convert comma-separated skills → array
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

    } catch (err) {
        console.error("Matcher error:", err);
        res.status(500).json({ error: "Failed to match tutors" });
    }
};
