const express = require("express");

const db = require("./config/db");
const bcrypt = require("bcrypt");

const app = express();
// Middleware setup

const cors = require("cors");

app.use(cors({
  origin: true,   // 👈 automatically reflect request origin
  credentials: true
}));


app.use(express.json());
app.use("/match", require("./routes/match"));
app.use("/uploads", express.static("uploads"));

/* ---------------- DB CONNECTION ---------------- */

// app.get("/test-db", async (req, res) => {
//     try {
//         const [rows] = await db.query("SELECT 1 AS ok");
//         res.json(rows);
//     } catch (err) {
//         console.error("DB TEST ERROR:", err);
//         res.status(500).json({ error: err.message });
//     }
// });
/* ---------------- NOTIFICATIONS HELPER ---------------- */
function createNotification(email, message) {
    if (!email) return;

    db.query(
        "INSERT INTO notifications (user_email, message) VALUES (?, ?)",
        [email, message],
        err => {
            if (err) console.error("Notification insert failed:", err);
        }
    );
}
/* ---------------- REGISTER ---------------- */
app.post("/api/register", async (req, res) => {
    const { name, email, password, role, institute, education, skills } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // 1️⃣ Check if user already exists
    db.query(
        "SELECT id FROM users WHERE email = ?",
        [email],
        async (err, rows) => {
            if (err) {
                console.error("Registration DB Check Error:", err);
                return res.status(500).json({ error: "Database error during check" });
            }

            if (rows.length > 0) {
                return res
                    .status(400)
                    .json({ error: "Account already exists, please login" });
            }

            try {
                // 2️⃣ Hash password
                const hashedPassword = await bcrypt.hash(password, 10);

                // 3️⃣ Insert user
                // NOTE: Ensure your MySQL 'users' table has columns for all fields,
                // and the 'password' column is large enough (VARCHAR/TEXT)
                const insertSql = `
                    INSERT INTO users
                    (name, email, password, role, institute, education, skills, xp, level)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)
                `;

                db.query(
                    insertSql,
                    [name, email, hashedPassword, role, institute, education, skills],
                    (err) => {
                        if (err) {
                            console.error("Registration DB Insert Error:", err);
                            return res
                                .status(500)
                                .json({ error: "Registration failed" });
                        }

                        // IMPORTANT: Send back success response after database operation completes
                        res.json({ message: "Registration successful" });
                    }
                );
            } catch (hashErr) {
                console.error("Bcrypt Hashing Error:", hashErr);
                return res.status(500).json({ error: "Server error during registration" });
            }
        }
    );
});
/* ================= PEER EARNINGS ================= */
app.get("/api/peer/earnings/:peerId", (req, res) => {

    const peerId = req.params.peerId;

    const sql = `
        SELECT 
            n.title,
            u.name AS buyer_name,
            np.amount_paid,
            pe.platform_cut,
            (np.amount_paid - pe.platform_cut) AS peer_earning,
            np.purchased_at
        FROM note_purchases np
        JOIN notes n ON np.note_id = n.id
        JOIN users u ON np.student_id = u.id
        JOIN platform_earnings pe 
            ON pe.reference_id = np.id 
           AND pe.source = 'note_purchase'
        WHERE n.uploaded_by = ?
        ORDER BY np.purchased_at DESC
    `;

    db.query(sql, [peerId], (err, rows) => {
        if (err) {
            console.error("Earnings fetch error:", err);
            return res.status(500).json({ error: "Failed to fetch earnings" });
        }
        res.json(rows);
    });
});
/* ================= MONTHLY EARNINGS GRAPH ================= */
app.get("/api/peer/earnings/monthly/:peerId", (req, res) => {

    const sql = `
        SELECT 
            DATE_FORMAT(np.purchased_at, '%Y-%m') AS month,
            SUM(np.amount_paid - pe.platform_cut) AS total_earning
        FROM note_purchases np
        JOIN notes n ON np.note_id = n.id
        JOIN platform_earnings pe 
            ON pe.reference_id = np.id 
           AND pe.source = 'note_purchase'
        WHERE n.uploaded_by = ?
        GROUP BY month
        ORDER BY month
    `;

    db.query(sql, [req.params.peerId], (err, rows) => {
        if (err) return res.status(500).json({ error: "Graph failed" });
        res.json(rows);
    });
});
/* ---------------- PEER REVIEW DASHBOARD ---------------- */
app.get("/api/peer/reviews-dashboard/:peerId", (req, res) => {

    const peerId = req.params.peerId;

    /* TOTAL SESSIONS COMPLETED */
    const totalSessionsQuery = `
        SELECT COUNT(*) AS total_sessions
        FROM sessions
        WHERE tutor_id = ? AND status = 'completed'
    `;

    /* TOTAL REVIEWS RECEIVED */
    const totalReviewsQuery = `
        SELECT COUNT(*) AS total_reviews
        FROM ratings
        WHERE tutor_id = ?
    `;

    /* MONTHLY GRAPH DATA */
    const monthlyQuery = `
        SELECT 
            DATE_FORMAT(s.completed_at, '%Y-%m') AS month,
            COUNT(DISTINCT s.id) AS sessions,
            COUNT(DISTINCT r.id) AS reviews
        FROM sessions s
        LEFT JOIN ratings r 
            ON r.session_id = s.id
        WHERE s.tutor_id = ?
          AND s.status = 'completed'
        GROUP BY month
        ORDER BY month
    `;

    db.query(totalSessionsQuery, [peerId], (err, sessionsRes) => {
        if (err) return res.status(500).json({ error: "Sessions fetch failed" });

        db.query(totalReviewsQuery, [peerId], (err, reviewsRes) => {
            if (err) return res.status(500).json({ error: "Reviews fetch failed" });

            db.query(monthlyQuery, [peerId], (err, monthlyRes) => {
                if (err) return res.status(500).json({ error: "Graph data failed" });

                res.json({
                    total_sessions: sessionsRes[0].total_sessions,
                    total_reviews: reviewsRes[0].total_reviews,
                    monthly: monthlyRes
                });
            });
        });
    });
});
/* ---------------- LOGIN ---------------- */
app.post("/api/login", async (req, res) => {
    console.log("======== LOGIN REQUEST RECEIVED ========");
    console.log("HEADERS:", req.headers);
    console.log("BODY:", req.body);

    const { email, password, role } = req.body;

    // Step 1: Check request body
    if (!email || !password || !role) {
        console.log("❌ Missing fields", { email, password, role });
        return res.status(400).json({ error: "Missing login fields" });
    }

    console.log("✅ Fields present:", { email, role });

    // Step 2: Query DB
    const sql = "SELECT * FROM users WHERE email = ?";
    db.query(sql, [email], async (err, rows) => {
        if (err) {
            console.log("❌ DB ERROR:", err);
            return res.status(500).json({ error: "Database error" });
        }

        console.log("DB RESULT:", rows);

        // Step 3: Check user exists
        if (!rows || rows.length === 0) {
            console.log("❌ User not found");
            return res.status(404).json({ error: "User not found" });
        }

        const user = rows[0];
        console.log("✅ User found:", {
            id: user.id,
            email: user.email,
            role: user.role,
            xp: user.xp
        });

        // 3. VERIFY ROLE 
        if (user.role.toLowerCase() !== role.toLowerCase()) {
            return res.status(400).json({ error: "Role mismatch. Please login with the correct role." });
        }

        console.log("✅ Role matched");

        // Step 5: Password comparison
        try {
            console.log("Comparing passwords...");
            const match = await bcrypt.compare(password, user.password);
            console.log("PASSWORD MATCH RESULT:", match);

            if (!match) {
                console.log("❌ Password incorrect");
                return res.status(400).json({ error: "Incorrect password" });
            }
        } catch (err) {
            console.log("❌ BCRYPT ERROR:", err);
            return res.status(500).json({ error: "Password check failed" });
        }

        console.log("✅ Password matched");

        // 5. Successful Login
        // Remove password from response
        delete user.password;

        // Return success with user data
        res.json({ message: "Login successful", user });
    });
});
/* ---------------- PUBLIC PROFILE BY ID ---------------- */
app.get("/api/user/profile/:id", (req, res) => {
    const sql = `
        SELECT id, name, role, institute, education,
               skills, bio, learning, xp, level,
               rating, rating_count, is_online
        FROM users
        WHERE id = ?
    `;

    db.query(sql, [req.params.id], (err, rows) => {
        if (err) {
            console.error("Profile fetch error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        if (!rows.length) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(rows[0]); // 🚫 Email NOT included
    });
});
/* ---------------- GET USER PROFILE ---------------- */
app.get("/api/user/:email", (req, res) => {
    const email = req.params.email;

    db.query(
        "SELECT * FROM users WHERE email = ?",
        [email],
        (err, rows) => {
            if (err) return res.status(500).json({ error: "Database error" });
            if (rows.length === 0)
                return res.status(404).json({ error: "User not found" });

            delete rows[0].password;
            res.json(rows[0]);
        }
    );
});

/* ---------------- UPDATE PROFILE ---------------- */
app.put("/api/user/update", (req, res) => {
    const { email, name, institute, contact, learning, skills, bio } = req.body;

    const sql = `
        UPDATE users
        SET name = ?, institute = ?, contact = ?, learning = ?, skills = ?, bio = ?
        WHERE email = ?
    `;

    db.query(
        sql,
        [name, institute, contact, learning, skills, bio, email],
        err => {
            if (err) return res.status(500).json({ error: "Update failed" });

            res.json({ message: "Profile updated successfully" });
        }
    );
});
app.get("/api/leaderboard", (req, res) => {
    const sql = `
        SELECT name, role, xp, level
        FROM users
        ORDER BY xp DESC
        LIMIT 10
    `;

    db.query(sql, (err, rows) => {
        if (err) return res.status(500).json({ error: "DB error" });
        res.json(rows);
    });
});

/* ---------------- USER BADGES BY ID ---------------- */
app.get("/api/badges/user/:id", (req, res) => {
    const sql = `
        SELECT b.id, b.name, b.image_url, b.min_xp
        FROM user_badges ub
        JOIN badges b ON ub.badge_id = b.id
        WHERE ub.user_id = ?
        ORDER BY b.min_xp ASC
    `;

    db.query(sql, [req.params.id], (err, rows) => {
        if (err) {
            console.error("Badges fetch error:", err);
            return res.status(500).json({ error: "DB error" });
        }
        res.json(rows);
    });
});
app.get("/api/tutor/:id/sessions", (req, res) => {
    const sql = `
        SELECT s.*, u.name AS student_name
        FROM sessions s
        JOIN users u ON s.student_id = u.id
        WHERE s.tutor_id = ? AND s.status = 'requested'
    `;

    db.query(sql, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch" });
        res.json(rows);
    });
});
app.put("/api/sessions/:id/accept", (req, res) => {
    const sessionId = req.params.id;

    const sql = `
        UPDATE sessions
        SET status = 'accepted'
        WHERE id = ?
    `;

    db.query(sql, [sessionId], err => {
        if (err) return res.status(500).json({ error: "Accept failed" });

        // 🔥 NOTIFY STUDENT IMMEDIATELY
        console.log(`📢 Emitting 'sessionAccepted' to room: ${sessionId}`);
        io.to(sessionId).emit("sessionAccepted");
        // 🔔 Notify student
db.query(
    `
    SELECT u.email
    FROM users u
    JOIN sessions s ON u.id = s.student_id
    WHERE s.id = ?
    `,
    [sessionId],
    (err, rows) => {
        if (!err && rows.length) {
            createNotification(
                rows[0].email,
                "Your session request was accepted"
            );
        }
    }
);
        res.json({ message: "Session accepted" });
    });
});

app.post("/api/session/start", (req, res) => {
    const { studentEmail, tutorId, topic } = req.body;

    db.query(
        "SELECT id FROM users WHERE email = ?",
        [studentEmail],
        (err, rows) => {
            if (err || rows.length === 0)
                return res.status(400).json({ error: "Student not found" });

            const studentId = rows[0].id;

            db.query(
                "INSERT INTO sessions (student_id, tutor_id, topic, status) VALUES (?, ?, ?, 'requested')",
                [studentId, tutorId, topic],
                (err, result) => {
                    if (err)
                        return res.status(500).json({ error: "Session creation failed" });

                    console.log("✅ Session Created. ID:", result.insertId);
                    // 🔔 Notify tutor
db.query(
    "SELECT email FROM users WHERE id=?",
    [tutorId],
    (err, rows) => {
        if (!err && rows.length) {
            createNotification(
                rows[0].email,
                `New session request from ${studentEmail} for "${topic}"`
            );
        }
    }
);
                    res.json({ sessionId: result.insertId });
                }
            );
        }
    );
});

app.put("/api/sessions/:id/reject", (req, res) => {
    const sql = `
        UPDATE sessions
        SET status = 'cancelled'
        WHERE id = ?
    `;

    db.query(sql, [req.params.id], err => {
        if (err) return res.status(500).json({ error: "Reject failed" });
        // Emit event to notify the student
        io.to(req.params.id).emit("sessionRejected");
        // 🔔 Notify student
db.query(
    `
    SELECT u.email
    FROM users u
    JOIN sessions s ON u.id = s.student_id
    WHERE s.id = ?
    `,
    [req.params.id],
    (err, rows) => {
        if (!err && rows.length) {
            createNotification(
                rows[0].email,
                "Your session request was rejected"
            );
        }
    }
);
        res.json({ message: "Session rejected" });
    });
});
app.get("/api/sessions/:id", (req, res) => {
    const sql = "SELECT * FROM sessions WHERE id = ?";

    db.query(sql, [req.params.id], (err, rows) => {
        if (err || rows.length === 0)
            return res.status(404).json({ error: "Session not found" });

        res.json(rows[0]);
    });
});
app.get("/api/notes/check-purchase/:noteId/:userId", (req, res) => {

    const { noteId, userId } = req.params;

    db.query(
        "SELECT * FROM note_purchases WHERE student_id=? AND note_id=?",
        [userId, noteId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: "Check failed" });
            res.json({ purchased: rows.length > 0 });
        }
    );
});
app.put("/api/sessions/:id/complete", (req, res) => {
    const SESSION_XP = 20;
    const sessionId = req.params.id;

    db.query(
        `
        UPDATE sessions
        SET status='completed', completed_at=NOW()
        WHERE id=? AND status!='completed'
        `,
        [sessionId],
        (err, result) => {
            if (err) return res.status(500).json({ error: "Session update failed" });

            // already completed → stop
            if (result.affectedRows === 0) {
                return res.json({ message: "Session already completed" });
            }

            // add XP
            db.query(
                `
                UPDATE users u
                JOIN sessions s ON u.id = s.student_id
                SET u.xp = u.xp + ?
                WHERE s.id = ?
                `,
                [SESSION_XP, sessionId],
                err => {
                    if (err) return res.status(500).json({ error: "XP update failed" });

                    // assign badges
                    db.query(
                        `
                        INSERT INTO user_badges (user_id, badge_id)
                        SELECT u.id, b.id
                        FROM users u
                        JOIN badges b ON u.xp >= b.min_xp
                        LEFT JOIN user_badges ub
                          ON ub.user_id = u.id AND ub.badge_id = b.id
                        WHERE u.id = (
                            SELECT student_id FROM sessions WHERE id = ?
                        )
                        AND ub.id IS NULL
                        `,
                        [sessionId],
                        () => {
                            // 🔥 notify BOTH users
                            io.to(sessionId).emit("sessionEnded");
                            // 🔔 Notify BOTH users
db.query(
    `
    SELECT su.email AS student_email, tu.email AS tutor_email
    FROM sessions s
    JOIN users su ON s.student_id = su.id
    JOIN users tu ON s.tutor_id = tu.id
    WHERE s.id = ?
    `,
    [sessionId],
    (err, rows) => {
        if (!err && rows.length) {
            createNotification(rows[0].student_email, "Session completed 🎉");
            createNotification(rows[0].tutor_email, "Session completed 🎉");
        }
    }
);
                            res.json({ message: "Session completed, XP awarded" });
                        }
                    );
                }
            );
        }
    );
});
app.get("/api/tutors", (req, res) => {
    const { topic = "" } = req.query;

    const sql = `
        SELECT id, name, email, skills, institute, is_online
        FROM users
        WHERE role = 'peer'
          AND LOWER(skills) LIKE LOWER(?)
        ORDER BY is_online DESC, xp DESC
    `;

    db.query(sql, [`%${topic}%`], (err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch tutors" });
        res.json(rows);
    });
});
const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "http://localhost:5173"
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});

/* 🔥 TRACK USERS PER SESSION */
const sessionUsers = {};

io.on("connection", socket => {
    console.log("User connected:", socket.id);

    /* ---------- JOIN SESSION ---------- */
    socket.on("joinSession", sessionId => {
        socket.join(sessionId);
        console.log("Joined session:", sessionId);

        // Track number of users in session
        sessionUsers[sessionId] = (sessionUsers[sessionId] || 0) + 1;

        console.log(
            `Users in session ${sessionId}:`,
            sessionUsers[sessionId]
        );

        // 🔥 BOTH USERS READY → START VIDEO SAFELY
        if (sessionUsers[sessionId] === 2) {
            io.to(sessionId).emit("readyForCall");
        }
    });

    /* ---------- CHAT ---------- */
    socket.on("chatMessage", data => {
        io.to(data.sessionId).emit("chatMessage", data);
    });

    /* ---------- VIDEO SWITCH FLOW ---------- */
    socket.on("switchToVideo", sessionId => {
        socket.to(sessionId).emit("switchToVideo");
    });

    socket.on("videoAccepted", sessionId => {
        socket.to(sessionId).emit("videoAccepted");
    });

    socket.on("videoRejected", sessionId => {
        socket.to(sessionId).emit("videoRejected");
    });

    /* ---------- WEBRTC SIGNALING ---------- */
    socket.on("videoOffer", data => {
        socket.to(data.sessionId).emit("videoOffer", data);
    });

    socket.on("videoAnswer", data => {
        socket.to(data.sessionId).emit("videoAnswer", data);
    });

    socket.on("iceCandidate", data => {
        socket.to(data.sessionId).emit("iceCandidate", data);
    });

    /* ---------- END SESSION ---------- */
    socket.on("endSession", sessionId => {
        io.to(sessionId).emit("sessionEnded");

        // cleanup count
        if (sessionUsers[sessionId]) {
            sessionUsers[sessionId] = Math.max(
                0,
                sessionUsers[sessionId] - 1
            );
        }
    });

    /* ---------- DISCONNECT ---------- */
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        // Safe cleanup (handles refresh / tab close)
        for (const sessionId in sessionUsers) {
            sessionUsers[sessionId] = Math.max(
                0,
                sessionUsers[sessionId] - 1
            );
        }
    });
});

/* ---------------- SECURE NOTE VIEW ---------------- */
app.get("/api/notes/view/:noteId/:userId", (req, res) => {

    const { noteId, userId } = req.params;

    db.query(
        "SELECT price, file_url FROM notes WHERE id=?",
        [noteId],
        (err, rows) => {

            if (err || !rows.length)
                return res.status(404).json({ error: "Note not found" });

            const note = rows[0];

            // FREE note
            if (note.price == 0) {
                return res.json({ fileUrl: note.file_url });
            }

            // PAID note → verify purchase
            db.query(
                "SELECT * FROM note_purchases WHERE student_id=? AND note_id=?",
                [userId, noteId],
                (err, purchaseRows) => {

                    if (!purchaseRows.length)
                        return res.status(403).json({ error: "Purchase required" });

                    res.json({ fileUrl: note.file_url });
                }
            );
        }
    );
});


/* ---------------- SET ONLINE STATUS ---------------- */
app.post("/api/user/set-online", (req, res) => {
    const { id, is_online } = req.body;

    db.query(
        "UPDATE users SET is_online = ? WHERE id = ?",
        [is_online, id],
        err => {
            if (err) {
                console.error("Online status update error:", err);
                return res.status(500).json({ error: "Status update failed" });
            }
            res.json({ message: "Status updated" });
        }
    );
});
app.post("/api/ratings", (req, res) => {
    const { sessionId, tutorId, studentId, rating, review } = req.body;

    db.query(
        `
        INSERT INTO ratings (session_id, tutor_id, student_id, rating, review)
        VALUES (?, ?, ?, ?, ?)
        `,
        [sessionId, tutorId, studentId, rating, review],
        err => {
            if (err) return res.status(500).json({ error: "Rating failed" });

            // update tutor average
            db.query(
                `
                UPDATE users
                SET rating = ((rating * rating_count) + ?) / (rating_count + 1),
                    rating_count = rating_count + 1
                WHERE id = ?
                `,
                [rating, tutorId],
                () => res.json({ message: "Rating submitted" })
            );
        }
    );
});
app.get("/api/student/:id/sessions", (req, res) => {
    const sql = `
        SELECT s.*, u.name AS tutor_name
        FROM sessions s
        JOIN users u ON s.tutor_id = u.id
        WHERE s.student_id = ?
        ORDER BY s.created_at DESC
    `;

    db.query(sql, [req.params.id], (err, rows) => {
        if (err) {
            console.error("Student sessions fetch error:", err);
            return res.status(500).json({ error: "Failed to load sessions" });
        }
        res.json(rows);
    });
});
app.use("/api/notes", require("./routes/notesRoutes"));

/* ---------------- GET NOTIFICATIONS ---------------- */
app.get("/api/notifications/:email", (req, res) => {
    db.query(
        "SELECT * FROM notifications WHERE user_email=? ORDER BY created_at DESC",
        [req.params.email],
        (err, rows) => {
            if (err) return res.status(500).json({ error: "Fetch failed" });
            res.json(rows);
        }
    );
});

/* ---------------- MARK READ ---------------- */
app.post("/api/notifications/read/:id", (req, res) => {
    db.query(
        "UPDATE notifications SET is_read=TRUE WHERE id=?",
        [req.params.id],
        err => {
            if (err) return res.status(500).json({ error: "Update failed" });
            res.json({ success: true });
        }
    );
});
/* ---------------- GET STUDENT PURCHASES ---------------- */
app.get("/api/notes/purchases/:studentId", (req, res) => {

    const sql = `
        SELECT 
            np.id,
            np.amount_paid,
            np.purchased_at,
            n.id AS note_id,
            n.title,
            n.file_url,
            u.name AS tutor_name
        FROM note_purchases np
        JOIN notes n ON np.note_id = n.id
        JOIN users u ON n.uploaded_by = u.id
        WHERE np.student_id = ?
        ORDER BY np.purchased_at DESC
    `;

    db.query(sql, [req.params.studentId], (err, rows) => {
        if (err) {
            console.error("Purchase fetch error:", err);
            return res.status(500).json({ error: "Failed to fetch purchases" });
        }
        res.json(rows);
    });
});

/* ---------------- DELETE ---------------- */
app.delete("/api/notifications/:id", (req, res) => {
    db.query(
        "DELETE FROM notifications WHERE id=?",
        [req.params.id],
        err => {
            if (err) return res.status(500).json({ error: "Delete failed" });
            res.json({ success: true });
        }
    );
});
const PORT = process.env.PORT || 5000;
// --- Global error handler (prevents fake CORS errors) ---
app.use((err, req, res, next) => {
    console.error("GLOBAL ERROR:", err);

    res.header("Access-Control-Allow-Origin", "http://localhost:3000");
    res.header("Access-Control-Allow-Credentials", "true");

    res.status(500).json({
        error: "Internal Server Error",
        details: err.message
    });
});
server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

