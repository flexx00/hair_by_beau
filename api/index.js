const express = require("express");
const cors = require("cors");
const twilio = require("twilio");
const Stripe = require("stripe");
require('dotenv').config(); // Load .env for local testing

const app = express();
app.use(cors());

// Webhook needs raw body
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

// Serve static files (optional — if you host frontend here too)
// app.use(express.static(__dirname + "/../public"));

// 🔐 Credentials from Environment Variables (SECURE!)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !stripeSecret || !endpointSecret || !twilioNumber) {
    console.error("❌ Missing required environment variables!");
    throw new Error("Missing env vars");
}

const stripe = Stripe(stripeSecret);
const client = twilio(accountSid, authToken);

// 💰 Price helper
function getPrice(service) {
    const prices = {
        "Wash / Blow Dry": 2500,
        "Hair Dye / Colouring": 3500,
        "Styling": 1500,
        "Hair Ups": 2000,
    };
    return prices[service] || 2500;
}

// 📲 Improved SEND SMS (works for any country)
async function sendSMS({ phone, name, service, date, time }) {
    if (!phone || !name || !service || !date || !time) {
        throw new Error("Missing required booking details");
    }

    // Clean and normalize phone number (adds + if missing)
    let cleanPhone = String(phone).trim().replace(/\s+/g, "");
    if (!cleanPhone.startsWith("+")) {
        cleanPhone = "+" + cleanPhone;
    }

    console.log(`📩 Sending SMS to: ${cleanPhone} | Name: ${name}`);

    const messageBody = `Hi ${name}! 💖 Your ${service} booking is confirmed for ${date} at ${time}. See you soon! - Hair By Beau`;

    try {
        const message = await client.messages.create({
            body: messageBody,
            from: twilioNumber,
            to: cleanPhone
        });

        console.log(`✅ SMS SENT! SID: ${message.sid}`);
        return message.sid;
    } catch (err) {
        console.error("❌ Twilio SMS Error:", err.message);
        if (err.code) console.error("Error Code:", err.code);
        throw err;
    }
}

// 🔥 Create Stripe Checkout Session
app.post("/create-checkout-session", async (req, res) => {
    const { name, phone, service, date, time } = req.body;

    console.log("🧾 Creating checkout session for:", { name, phone, service, date, time });

    // Get domain from env var or fallback
    const DOMAIN = process.env.DOMAIN_URL || "https://your-project-name.vercel.app";

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            line_items: [{
                price_data: {
                    currency: "gbp",
                    product_data: { name: service },
                    unit_amount: getPrice(service),
                },
                quantity: 1,
            }],
            success_url: `${DOMAIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${DOMAIN}/index.html`,
            metadata: { name, phone, service, date, time },   // For webhook
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error("❌ Stripe error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 🔥 Stripe Webhook
app.post("/webhook", async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error("❌ Webhook signature error:", err.message);
        return res.sendStatus(400);
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const booking = session.metadata;

        console.log("💳 Payment completed! Session ID:", session.id);

        if (booking && booking.phone) {
            try {
                await sendSMS(booking);
            } catch (err) {
                console.error("❌ SMS failed after payment:", err.message);
                // You could add email fallback here later
            }
        }
    }

    res.json({ received: true });
});

// 🧪 Manual test route (optional)
app.post("/send-sms", async (req, res) => {
    try {
        await sendSMS(req.body);
        res.json({ success: true });
    } catch (err) {
        console.error("❌ Manual SMS error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ❌ REMOVE THIS LINE FOR VERCEL:
// app.listen(3000, () => { ... });

// ✅ EXPORT APP FOR VERCEL SERVERLESS FUNCTION
module.exports = app;