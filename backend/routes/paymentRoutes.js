const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const db = require("../config/db");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* CREATE CHECKOUT SESSION */
router.post("/create-checkout-session", async (req,res)=>{

const {noteId, studentId} = req.body;

try{

const [rows] = await db.query(
"SELECT title, price FROM notes WHERE id=?",
[noteId]
);

if(!rows.length){
return res.status(404).json({error:"Note not found"});
}

const note = rows[0];

const session = await stripe.checkout.sessions.create({

payment_method_types:["card"],
mode:"payment",

line_items:[{
price_data:{
currency:"inr",
product_data:{
name: note.title
},
unit_amount: note.price * 100
},
quantity:1
}],

metadata:{
noteId,
studentId
},

success_url:`${process.env.FRONTEND_URL}/payment-success?noteId=${noteId}&studentId=${studentId}`,
cancel_url:`${process.env.FRONTEND_URL}/payment-cancel`

});

res.json({url:session.url});

}catch(err){
console.error("Stripe error:",err);
res.status(500).json({error:"Stripe failed"});
}

});
/* CONFIRM PURCHASE AFTER PAYMENT */

router.post("/confirm-purchase", async (req,res)=>{

const {noteId, studentId} = req.body;

try{

const [rows] = await db.query(
"SELECT price FROM notes WHERE id=?",
[noteId]
);

if(!rows.length){
return res.status(404).json({error:"Note not found"});
}

const price = rows[0].price;

/* prevent duplicate purchases */

const [existing] = await db.query(
"SELECT id FROM note_purchases WHERE student_id=? AND note_id=?",
[studentId, noteId]
);

if(existing.length){
return res.json({success:true});
}

/* insert purchase */

await db.query(
"INSERT INTO note_purchases (note_id, student_id, amount_paid) VALUES (?,?,?)",
[noteId, studentId, price]
);

res.json({success:true});

}catch(err){
console.error(err);
res.status(500).json({error:"Insert failed"});
}

});

module.exports = router;