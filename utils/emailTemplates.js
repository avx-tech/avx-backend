// utils/emailTemplates.js

function orderClientTemplate(name, plan, amount, orderId) {
  return `
  <div style="font-family:Poppins,sans-serif;max-width:600px;margin:auto;
  padding:20px;border-radius:12px;background:#0b0b0b;color:white;">

    <h2 style="color:#00fff0;">✅ Order Confirmed - AVX Web Services</h2>

    <p>Hi <b>${name}</b>,</p>

    <p>Thank you for choosing AVX 🎉</p>

    <div style="padding:15px;border-radius:10px;
    background:rgba(255,255,255,0.08);margin-top:15px;">

      <p><b>Order ID:</b> ${orderId}</p>
      <p><b>Plan:</b> ${plan}</p>
      <p><b>Total Amount:</b> ₹${amount}</p>
      <p><b>Delivery:</b> Within 3-5 Days</p>

    </div>

    <br>

    <a href="https://wa.me/917668569913"
    style="display:inline-block;padding:12px 20px;
    background:linear-gradient(90deg,#00fff0,#0066ff);
    border-radius:10px;color:black;font-weight:700;text-decoration:none;">
    💬 Chat on WhatsApp
    </a>

    <p style="margin-top:20px;color:#aaa;font-size:13px;">
    AVX Web Services | Websites for Business Growth 🚀
    </p>

  </div>
  `;
}

function adminOrderTemplate(name, email, phone, plan, amount, orderId) {
  return `
  <div style="font-family:Poppins,sans-serif;padding:20px;">
    <h2 style="color:#00fff0;">📩 New Order Received</h2>

    <p><b>Order ID:</b> ${orderId}</p>
    <p><b>Name:</b> ${name}</p>
    <p><b>Email:</b> ${email}</p>
    <p><b>Phone:</b> ${phone}</p>
    <p><b>Plan:</b> ${plan}</p>
    <p><b>Amount:</b> ₹${amount}</p>

    <br>

    <a href="https://wa.me/${phone}"
    style="padding:10px 18px;
    background:#25D366;
    border-radius:10px;
    text-decoration:none;
    color:white;">
    Reply Client on WhatsApp
    </a>
  </div>
  `;
}

function demoTemplate(name, business) {
  return `
  <div style="font-family:Poppins,sans-serif;max-width:600px;margin:auto;
  padding:20px;border-radius:12px;background:#0b0b0b;color:white;">

    <h2 style="color:#00fff0;">🎁 Free Demo Request Received</h2>

    <p>Hello <b>${name}</b>,</p>

    <p>We received your free demo request for:</p>

    <div style="padding:15px;background:rgba(255,255,255,0.08);
    border-radius:10px;">
      <p><b>Business Name:</b> ${business}</p>
      <p><b>Status:</b> Demo will be delivered within 24 Hours ✅</p>
    </div>

    <br>

    <p>Our team will contact you soon.</p>

    <a href="https://wa.me/917668569913"
    style="display:inline-block;margin-top:15px;
    padding:12px 20px;background:#00fff0;
    border-radius:10px;color:black;font-weight:700;text-decoration:none;">
    WhatsApp Support
    </a>

  </div>
  `;
}

module.exports = {
  orderClientTemplate,
  adminOrderTemplate,
  demoTemplate
};
