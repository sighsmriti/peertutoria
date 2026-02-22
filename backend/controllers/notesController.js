const db = require("../config/db");

// Upload Notes (Peer)
exports.uploadNotes = async (req, res) => {
  try {
    const { title, subject, topic, price, description, uploaded_by } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileUrl = "/uploads/" + req.file.filename;

    await db.query(
      `INSERT INTO notes 
      (title, subject, topic, description, price, file_url, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, subject, topic, description, price, fileUrl, uploaded_by]
    );

    res.json({ success: true, message: "Notes uploaded successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
};

// Search Notes (Student)
exports.searchNotes = async (req, res) => {
  try {
    const { topic = "", filter = "all" } = req.query;

    let sql = `
      SELECT notes.*, users.name AS uploader_name
      FROM notes
      JOIN users ON notes.uploaded_by = users.id
      WHERE notes.topic LIKE ?
    `;

    let params = [`%${topic}%`];

    if (filter === "free") {
      sql += " AND notes.price = 0";
    } else if (filter === "paid") {
      sql += " AND notes.price > 0";
    }

    const [rows] = await db.query(sql, params);

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
};
/* ---------- FAKE PURCHASE ---------- */
exports.fakePurchase = async (req, res) => {
  try {
    const { noteId, studentId } = req.body;

    const [[note]] = await db.query(
      "SELECT price FROM notes WHERE id=?",
      [noteId]
    );

    if (!note) return res.status(400).json({ error: "Note not found" });

    const price = note.price;

    const [existing] = await db.query(
      "SELECT * FROM note_purchases WHERE student_id=? AND note_id=?",
      [studentId, noteId]
    );

    if (existing.length) {
      return res.json({ message: "Already purchased" });
    }

    const [result] = await db.query(
      "INSERT INTO note_purchases (student_id, note_id, amount_paid) VALUES (?, ?, ?)",
      [studentId, noteId, price]
    );

    const purchaseId = result.insertId;

   const platformCut = price * 0.10;

db.query(
    `INSERT INTO platform_earnings 
     (source, reference_id, gross_amount, platform_cut) 
     VALUES ('note_purchase', ?, ?, ?)`,
    [purchaseId, price, platformCut]
);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Purchase failed" });
  }
};

/* ---------- CHECK PURCHASE ---------- */
exports.checkPurchase = async (req, res) => {
  try {
    const { noteId, userId } = req.params;

    const [rows] = await db.query(
      "SELECT * FROM note_purchases WHERE student_id=? AND note_id=?",
      [userId, noteId]
    );

    res.json({ purchased: rows.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Check failed" });
  }
};

/* ---------- SECURE DOWNLOAD ---------- */
exports.downloadNote = async (req, res) => {
  try {
    const { noteId, userId } = req.params;

    const [[note]] = await db.query(
      "SELECT price, file_url FROM notes WHERE id=?",
      [noteId]
    );

    if (!note) return res.status(404).json({ error: "Note not found" });

    if (note.price == 0) {
      return res.download("." + note.file_url);
    }

    const [purchase] = await db.query(
      "SELECT * FROM note_purchases WHERE student_id=? AND note_id=?",
      [userId, noteId]
    );

    if (!purchase.length) {
      return res.status(403).json({ error: "Purchase required" });
    }

    res.download("." + note.file_url);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Download failed" });
  }
};
