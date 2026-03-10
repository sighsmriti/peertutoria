const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const db = require("../config/db");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ---------- CREATE CHECKOUT SESSION ---------- */
router.post("/create-checkout-session", (req, res) => {

    const { noteId, studentId } = req.body;

    db.query(
        "SELECT title, price FROM notes WHERE id=?",
        [noteId],
        async (err, rows) => {

            if (err) {
                console.error("DB error:", err);
                return res.status(500).json({ error: "Database error" });
            }

            if (!rows.length) {
                return res.status(404).json({ error: "Note not found" });
            }

            const note = rows[0];

            try {

                const session = await stripe.checkout.sessions.create({

                    payment_method_types: ["card"],
                    mode: "payment",

                    line_items: [{
                        price_data: {
                            currency: "inr",
                            product_data: {
                                name: note.title
                            },
                            unit_amount: note.price * 100
                        },
                        quantity: 1
                    }],

                    metadata: {
                        noteId,
                        studentId
                    },

                    success_url: `${process.env.FRONTEND_URL}/payment-success.html?noteId=${noteId}&studentId=${studentId}`,
                    cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`
                });

                res.json({ url: session.url });

            } catch (stripeErr) {

                console.error("Stripe error:", stripeErr);
                res.status(500).json({ error: "Stripe failed" });

            }
        }
    );
});


/* ---------- CONFIRM PURCHASE AFTER PAYMENT ---------- */
router.post("/confirm-purchase", (req, res) => {

    const { noteId, studentId } = req.body;

    db.query(
        "SELECT price FROM notes WHERE id=?",
        [noteId],
        (err, rows) => {

            if (err) {
                console.error(err);
                return res.status(500).json({ error: "DB error" });
            }

            if (!rows.length) {
                return res.status(404).json({ error: "Note not found" });
            }

            const price = rows[0].price;

            /* prevent duplicate purchase */
            db.query(
                "SELECT id FROM note_purchases WHERE student_id=? AND note_id=?",
                [studentId, noteId],
                (err, existing) => {

                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: "Check failed" });
                    }

                    if (existing.length) {
                        return res.json({ success: true });
                    }

                    /* insert purchase */
                    db.query(
                        "INSERT INTO note_purchases (note_id, student_id, amount_paid) VALUES (?,?,?)",
                        [noteId, studentId, price],
                        (err) => {

                            if (err) {
                                console.error(err);
                                return res.status(500).json({ error: "Insert failed" });
                            }

                            res.json({ success: true });
                        }
                    );
                }
            );
        }
    );
});

module.exports = router;