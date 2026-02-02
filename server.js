// ===============================
// AVX FINAL SERVER.JS (RENDER READY + BREVO SMTP)
// ===============================

// ===== IMPORTS =====
const express = require("express");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const Razorpay = require("razorpay");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
require("dotenv").config();

// ===== MODELS =====
const Lead = require("./models/Lead");
const DemoRequest = require("./models/DemoRequest");

// ===== EMAIL TEMPLATES =====
const {
  orderClientTemplate,
  adminOrderTemplate,
  demoTemplate,
} = require("./utils/emailTemplates");

// ===============================
// APP INIT
// ===============================
const app = express();
const PORT = process.env.PORT || 3000;

/* ✅ ADD THIS ROOT ROUTE HERE */
app.get("/", (req, res) => {
  res.send("✅ AVX Backend Running Successfully 🚀");
});




// ===============================
// ✅ CORS FIX (Netlify → Render)
// ===============================
app.use(
  cors({
    origin: "https://avxweb.netlify.app",
    methods: ["GET", "POST"],
    credentials: false,
  })
);

// ===============================
// MIDDLEWARES
// ===============================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// ===============================
// SESSION SETUP
// ===============================
app.use(
  session({
    secret: process.env.SESSION_SECRET || "avxSuperSecretKey",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

// ===============================
// RATE LIMIT SECURITY
// ===============================
app.use(
  rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20,
    message: "Too many requests, try again later.",
  })
);

// ===============================
// MONGODB CONNECTION
// ===============================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ Mongo Error:", err.message));

// ===============================
// MODELS
// ===============================
const Order = mongoose.model(
  "Order",
  new mongoose.Schema({
    orderId: String,
    plan: String,
    name: String,
    email: String,
    phone: String,
    message: String,
    amount: Number,
    paymentStatus: { type: String, default: "Pending" },
    razorpayPaymentId: String,
    createdAt: { type: Date, default: Date.now },
  })
);

const Admin = mongoose.model(
  "Admin",
  new mongoose.Schema({
    email: String,
    password: String,
  })
);

// ===============================
// ✅ EMAIL SETUP (BREVO SMTP)
// ===============================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, // smtp-relay.brevo.com
  port: process.env.SMTP_PORT, // 587
  secure: false,
  auth: {
    user: process.env.SMTP_USER, // Brevo Email
    pass: process.env.SMTP_PASS, // Brevo SMTP Key
  },
});

// ===============================
// ADMIN AUTH MIDDLEWARE
// ===============================
function isAdmin(req, res, next) {
  if (req.session.admin) return next();
  res.status(401).json({ message: "Unauthorized" });
}

// ===============================
// CREATE ADMIN (RUN ONCE)
// ===============================
app.get("/create-admin", async (req, res) => {
  const exists = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
  if (exists) return res.send("⚠ Admin already exists");

  const hash = await bcrypt.hash(process.env.ADMIN_PASS, 10);

  await Admin.create({
    email: process.env.ADMIN_EMAIL,
    password: hash,
  });

  res.send("✅ Admin Created Successfully");
});

// ===============================
// ADMIN LOGIN
// ===============================
app.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;

  const admin = await Admin.findOne({ email });
  if (!admin) return res.status(401).json({ success: false });

  const match = await bcrypt.compare(password, admin.password);
  if (!match) return res.status(401).json({ success: false });

  req.session.admin = true;
  res.json({ success: true });
});

// ===============================
// ADMIN ORDERS FETCH
// ===============================
app.get("/admin/orders", isAdmin, async (req, res) => {
  res.json(await Order.find().sort({ createdAt: -1 }));
});

// ===============================
// ADMIN LEADS FETCH
// ===============================
app.get("/admin/leads", isAdmin, async (req, res) => {
  res.json(await Lead.find().sort({ createdAt: -1 }));
});

// ===============================
// DEMO REQUEST SAVE
// ===============================
app.post("/demo-request", async (req, res) => {
  await DemoRequest.create(req.body);

  res.json({
    success: true,
    message: "Demo Request Saved ✅",
  });
});

// ===============================
// CONTACT FORM + EMAIL CONFIRM
// ===============================
app.post("/contact", async (req, res) => {
  try {
    console.log("✅ CONTACT FORM HIT:", req.body);

    const { name, email, phone, message, plan, amount } = req.body;
    const orderId = "AVX" + Date.now();

    // Save Order
    await Order.create({
      orderId,
      plan,
      name,
      email,
      phone,
      message,
      amount,
    });

    // Save Lead
    await Lead.create({
      name,
      email,
      phone,
      plan,
      message,
    });

    // ===============================
    // ✅ ADMIN EMAIL
    // ===============================
    await transporter.sendMail({
      from: `"AVX Website" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `📩 New Order Received - ${orderId}`,
      html: adminOrderTemplate(name, email, phone, plan, amount, orderId),
    });

    // ===============================
    // ✅ CLIENT EMAIL
    // ===============================
    await transporter.sendMail({
      from: `"AVX Web Services" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `✅ Order Confirmed - ${orderId}`,
      html: orderClientTemplate(name, plan, amount, orderId),
    });

    res.json({
      success: true,
      message: "Order Saved + Emails Sent Successfully ✅",
      orderId,
    });
  } catch (err) {
    console.log("❌ Contact Error:", err.message);

    res.status(500).json({
      success: false,
      message: "Server Error ❌",
    });
  }
});

app.get("/", (req, res) => {
  res.send("✅ AVX Backend Running Successfully 🚀");
});


// ===============================
// TEST EMAIL ROUTE
// ===============================
app.get("/test-email", async (req, res) => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ADMIN_EMAIL,
      subject: "✅ AVX Test Email",
      text: "Brevo SMTP working successfully 🚀",
    });

    res.send("✅ Email Sent Successfully!");
  } catch (err) {
    res.send("❌ Email Failed: " + err.message);
  }
});

// ===============================
// SERVER START (ONLY ONCE)
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 AVX Backend Live → Port ${PORT}`);
});
