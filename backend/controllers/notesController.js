const db = require("../config/db");

/* ================= UPLOAD NOTES ================= */
exports.uploadNotes = (req, res) => {
  const { title, subject, topic, price, description, uploaded_by } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const fileUrl = "/uploads/" + req.file.filename;

  db.query(
    `INSERT INTO notes 
     (title, subject, topic, description, price, file_url, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, subject, topic, description, price, fileUrl, uploaded_by],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Upload failed" });
      }
      res.json({ success: true, message: "Notes uploaded successfully" });
    }
  );
};

/* ================= SEARCH NOTES ================= */
exports.searchNotes = (req, res) => {
  const { topic = "", filter = "all" } = req.query;

  let sql = `
    SELECT notes.*, users.name AS uploader_name
    FROM notes
    JOIN users ON notes.uploaded_by = users.id
    WHERE LOWER(notes.topic) LIKE LOWER(?)
  `;

  let params = [`%${topic}%`];

  if (filter === "free") {
    sql += " AND notes.price = 0";
  } else if (filter === "paid") {
    sql += " AND notes.price > 0";
  }

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Search failed" });
    }
    res.json(rows);
  });
};

/* ================= FAKE PURCHASE ================= */
exports.fakePurchase = (req, res) => {
  const { noteId, studentId } = req.body;

  db.query(
    "SELECT price FROM notes WHERE id=?",
    [noteId],
    (err, rows) => {
      if (err || !rows.length) {
        return res.status(400).json({ error: "Note not found" });
      }

      const price = rows[0].price;

      db.query(
        "SELECT * FROM note_purchases WHERE student_id=? AND note_id=?",
        [studentId, noteId],
        (err, existing) => {
          if (existing && existing.length) {
            return res.json({ message: "Already purchased" });
          }

          db.query(
            "INSERT INTO note_purchases (student_id, note_id, amount_paid) VALUES (?, ?, ?)",
            [studentId, noteId, price],
            (err, result) => {
              if (err) {
                return res.status(500).json({ error: "Purchase failed" });
              }

              const purchaseId = result.insertId;
              const platformCut = price * 0.10;

              db.query(
                `INSERT INTO platform_earnings 
                 (source, reference_id, gross_amount, platform_cut) 
                 VALUES ('note_purchase', ?, ?, ?)`,
                [purchaseId, price, platformCut]
              );

              res.json({ success: true });
            }
          );
        }
      );
    }
  );
};

/* ================= CHECK PURCHASE ================= */
exports.checkPurchase = (req, res) => {
  const { noteId, userId } = req.params;

  db.query(
    "SELECT * FROM note_purchases WHERE student_id=? AND note_id=?",
    [userId, noteId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Check failed" });
      }
      res.json({ purchased: rows.length > 0 });
    }
  );
};

/* ================= SECURE DOWNLOAD ================= */
exports.downloadNote = (req, res) => {
  const { noteId, userId } = req.params;

  db.query(
    "SELECT price, file_url FROM notes WHERE id=?",
    [noteId],
    (err, rows) => {
      if (err || !rows.length) {
        return res.status(404).json({ error: "Note not found" });
      }

      const note = rows[0];

      if (note.price == 0) {
        return res.download("." + note.file_url);
      }

      db.query(
        "SELECT * FROM note_purchases WHERE student_id=? AND note_id=?",
        [userId, noteId],
        (err, purchaseRows) => {
          if (!purchaseRows.length) {
            return res.status(403).json({ error: "Purchase required" });
          }

          res.download("." + note.file_url);
        }
      );
    }
  );
};