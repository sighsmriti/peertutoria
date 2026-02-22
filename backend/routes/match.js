const express = require("express");
const router = express.Router();

const { matchTutor } = require("../controllers/matchController");

// POST /match
router.post("/", matchTutor);

module.exports = router;
