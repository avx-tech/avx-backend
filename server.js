// ===============================
// IMPORTS
// ===============================
const express = require("express");
const nodemailer = require("nodemailer");
const Razorpay = require("razorpay");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

// ===============================
// APP INIT
// ===============================
const app = express();
const PORT = 3000;
const JWT_SECRET = "AVX_SUPER_SECRET_KEY";

// ===============================
// MIDDLEWARES
// ===============================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(__dirname));

// ===============================
// MONGODB CONNECTION (NO OLD OPTIONS)
// ===============================
mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("✅ MongoDB Connected"))
.catch(err=>console.log("❌ Mongo Error:", err.message));


// ===============================
// SCHEMAS
// ===============================
const orderSchema = new mongoose.Schema({
  orderId: String,
  name: String,
  email: String,
  message: String,
  amount: Number,
  paymentStatus: { type: String, default: "Pending" }, // 👈 NEW
  razorpayPaymentId: String,
  createdAt: { type: Date, default: Date.now }
});


const adminSchema = new mongoose.Schema({
  email: String,
  password: String
});

const Order = mongoose.model("Order", orderSchema);
const Admin = mongoose.model("Admin", adminSchema);

// ===============================
// RAZORPAY
// ===============================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET
});

// ===============================
// EMAIL (GMAIL APP PASSWORD)
// ===============================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ===============================
// CREATE PAYMENT ORDER
// ===============================
app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: "avx_" + Date.now()
    });

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "Payment error" });
  }
});

// ADMIN FETCH ORDERS (PROTECTED)
app.get("/admin/orders", isAdmin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ===============================
// CONTACT + SAVE ORDER + EMAIL
// ===============================
app.post("/contact", async (req, res) => {
  const { name, email, message, orderId } = req.body;

  try {
    await Order.create({ name, email, message, orderId });

    // ADMIN MAIL
    await transporter.sendMail({
      from: `"AVX Website" <infoavx1234@gmail.com>`,
      to: "infoavx1234@gmail.com",
      subject: `New Order - ${orderId}`,
      text: `Name: ${name}\nEmail: ${email}\nOrder ID: ${orderId}\n\n${message}`
    });

    // CLIENT AUTO REPLY
    await transporter.sendMail({
      from: `"AVX Web Services" <infoavx1234@gmail.com>`,
      to: email,
      subject: `Order Confirmed - ${orderId}`,
      text: `Hi ${name},\n\nYour order is confirmed.\nOrder ID: ${orderId}\n\nAVX Team`
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

//razor api
const crypto = require("crypto");

app.post("/verify-payment", async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", "3bRs1YtVQ1OHred7H6uSzL54")
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    // ✅ PAYMENT SUCCESS → UPDATE DB
    await Order.updateOne(
      { orderId: razorpay_order_id },
      {
        paymentStatus: "Paid",
        razorpayPaymentId: razorpay_payment_id
      }
    );

    res.json({ success: true });
  } else {
    res.status(400).json({ success: false });
  }
});


// ===============================
// CREATE ADMIN (RUN ONCE)
// ===============================
app.get("/create-admin", async (req, res) => {
  const exists = await Admin.findOne({ email: "admin@avx.com" });
  if (exists) return res.send("Admin already exists");

  const hash = await bcrypt.hash("admin123", 10);

  await Admin.create({
    email: "admin@avx.com",
    password: hash
  });

  res.send("✅ Admin created");
});

// ===============================
// ADMIN LOGIN
// ===============================
app.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;

  const admin = await Admin.findOne({ email });
  if (!admin) return res.status(401).json({ error: "Invalid credentials" });

  const match = await bcrypt.compare(password, admin.password);
  if (!match) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: admin._id }, JWT_SECRET, { expiresIn: "1d" });

  res.cookie("admin_token", token, {
    httpOnly: true,
    sameSite: "strict"
  });

  res.json({ success: true });
});

// ===============================
// ADMIN AUTH MIDDLEWARE
// ===============================
function isAdmin(req, res, next) {
  const token = req.cookies.admin_token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ===============================
// ADMIN FETCH ORDERS
// ===============================
app.get("/admin/orders", isAdmin, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

// ===============================
// SERVER START
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 Server running → http://localhost:${PORT}`);
});


