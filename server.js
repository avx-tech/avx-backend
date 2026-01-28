// ===============================
// AVX FINAL SERVER.JS (CLEAN + WORKING)
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
const Lead = require("./models/Lead");
require("dotenv").config();

const DemoRequest = require("./models/DemoRequest");

// ===============================
// APP INIT
// ===============================
const app = express();
const PORT = process.env.PORT || 3000;

const {
  orderClientTemplate,
  adminOrderTemplate,
  demoTemplate
} = require("./utils/emailTemplates");


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
      maxAge: 1000 * 60 * 60
    }
  })
);

// ===============================
// RATE LIMIT SECURITY
// ===============================
app.use(
  rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20,
    message: "Too many requests, try again later."
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
    createdAt: { type: Date, default: Date.now }
  })
);

const Admin = mongoose.model(
  "Admin",
  new mongoose.Schema({
    email: String,
    password: String
  })
);

// ===============================
// EMAIL SETUP
// ===============================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
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
    password: hash
  });

  res.send("✅ Admin Created Successfully");
});

// ===============================
// ADMIN LOGIN (DB CHECK)
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
// ADMIN LOGOUT
// ===============================
app.get("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin-login.html");
  });
});

// ===============================
// ADMIN ORDERS FETCH
// ===============================
app.get("/admin/orders", isAdmin, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

// ===============================
// DEMO REQUEST SAVE
// ===============================
app.post("/demo-request", async (req, res) => {
  await DemoRequest.create(req.body);
  res.json({ success: true, message: "Demo Request Saved ✅" });
});

// ===============================
// CONTACT FORM + EMAIL CONFIRM
// ===============================
app.post("/contact", async (req, res) => {
  try {
    const { name, email, phone, message, plan, amount } = req.body;

    // ✅ Unique Order ID
    const orderId = "AVX" + Date.now();

    // ✅ Save Order in MongoDB
    await Order.create({
      orderId,
      plan,
      name,
      email,
      phone,
      message,
      amount
    });

    // ✅ Save Contact Lead also
await Lead.create({
  name,
  email,
  phone,
  plan,
  message
});

    // ==========================
    // ✅ 1. ADMIN EMAIL ALERT
    // ==========================
    await transporter.sendMail({
      from: `"AVX Website" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `📩 New Order Received - ${orderId}`,
      html: adminOrderTemplate(
        name,
        email,
        phone,
        plan,
        amount,
        orderId
      )
    });

    // ==========================
    // ✅ 2. CLIENT CONFIRMATION EMAIL
    // ==========================
    await transporter.sendMail({
      from: `"AVX Web Services" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `✅ Order Confirmed - ${orderId}`,
      html: orderClientTemplate(name, plan, amount, orderId)
    });

    // ✅ Final Response
    res.json({
      success: true,
      message: "Order Saved + Emails Sent Successfully ✅",
      orderId
    });

  } catch (error) {
    console.log("❌ Contact Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server Error ❌"
    });
  }
});

// ===============================
// RAZORPAY SETUP
// ===============================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET
});

// Create Razorpay Order
app.post("/create-order", async (req, res) => {
  const { amount } = req.body;

  const order = await razorpay.orders.create({
    amount: amount * 100,
    currency: "INR",
    receipt: "avx_" + Date.now()
  });

  res.json(order);
});

// Verify Payment
app.post("/verify-payment", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    await Order.updateOne(
      { orderId: razorpay_order_id },
      {
        paymentStatus: "Paid",
        razorpayPaymentId: razorpay_payment_id
      }
    );

    return res.json({ success: true });
  }

  res.status(400).json({ success: false });
});

// ===============================
// SERVER START
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 AVX Server Running → http://localhost:${PORT}`);
});

app.get("/test-email", async (req, res) => {
  try {
    await transporter.sendMail({
      from: `"AVX Web Services" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: "✅ AVX Email System Working",
      text: "Congratulations! आपका Gmail सिस्टम सही चल रहा है 🚀"
    });

    res.send("✅ Email Sent Successfully!");
  } catch (err) {
    console.log("Email Error:", err.message);
    res.status(500).send("❌ Email Failed");
  }
});

app.get("/admin/leads", isAdmin, async(req,res)=>{
  res.json(await Lead.find().sort({createdAt:-1}));
});

app.delete("/admin/delete-lead/:id", isAdmin, async(req,res)=>{
  await Lead.findByIdAndDelete(req.params.id);
  res.json({success:true});
});

app.get("/admin/demo", isAdmin, async(req,res)=>{
  res.json(await DemoRequest.find().sort({createdAt:-1}));
});

// ===============================
// LIVE POPUP API (Real Data)
// ===============================
app.get("/live-popup", async (req, res) => {
  try {
    // Latest 3 Records (Orders + Leads + Demo)
    const orders = await Order.find().sort({ createdAt: -1 }).limit(3);
    const leads = await Lead.find().sort({ createdAt: -1 }).limit(3);
    const demos = await DemoRequest.find().sort({ createdAt: -1 }).limit(3);

    let popupData = [];

    // Orders Messages
    orders.forEach(o => {
      popupData.push(`✅ ${o.name} ordered ${o.plan}`);
    });

    // Leads Messages
    leads.forEach(l => {
      popupData.push(`📩 ${l.name} sent an inquiry for ${l.plan}`);
    });

    // Demo Messages
    demos.forEach(d => {
      popupData.push(`🎁 ${d.name} requested a Free Demo`);
    });

    res.json(popupData);

  } catch (err) {
    res.status(500).json([]);
  }
});


