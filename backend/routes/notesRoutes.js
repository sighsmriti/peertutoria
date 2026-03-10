const express = require("express");
const router = express.Router();
const upload = require("../utils/upload");
const notesController = require("../controllers/notesController");

/* ---------- Upload ---------- */
router.post("/upload", upload.single("file"), notesController.uploadNotes);

/* ---------- Search ---------- */
router.get("/search", notesController.searchNotes);

/* ---------- Fake Purchase ---------- */
router.post("/fake-purchase", notesController.fakePurchase);

/* ---------- Check Purchase ---------- */
router.get("/check-purchase/:noteId/:userId", notesController.checkPurchase);

/* ---------- Secure Download ---------- */
router.get("/download/:noteId/:userId", notesController.downloadNote);

module.exports = router;