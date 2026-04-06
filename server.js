const express = require("express");
const cors = require("cors");
const twilio = require("twilio");
const Stripe = require("stripe");

const app = express();
app.use(cors());

// ================= ENV / PORT =================
const PORT = process.env.PORT || 3000;

// ================= MIDDLEWARE =================
app.use("/webhook", express.raw({ type: "application/json" })); // Must be before express.json()
app.use(express.json());
app.use(express.static(__dirname));

// ================= 🔐 CREDENTIALS (Move to .env ASAP!) =================
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_51TBKY3QtbyUXSAuNXQEUpjGHVw4qyJxhADuJ8I4LSlqdBUExEYZuGrbBL8HEGSPLF9kGSQgDBMgYwizDm5FQcikt00fyJ0pB1u");

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_pVUpdXbT0IDspBBe7R4VUDP74JMsFRAE";

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID || "AC4598af68d81c78de170b6529d318eda7",
    process.env.TWILIO_AUTH_TOKEN || "81da45b7bb682348024e4f017671c673"
);

const twilioNumber = "+447460963690";

// ================= STORAGE (Better to use DB later) =================
let bookings = [];

// ================= PRICE =================
function getPrice(service) {
    const prices = {
        "Wash / Blow Dry": 2500,
        "Hair Dye / Colouring": 3500,
        "Styling": 1500,
        "Hair Ups": 2000,
    };
    return prices[service] || 2500;
}

// ================= PHONE FORMAT =================
function formatUKNumber(phone) {
    let clean = phone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");

    if (clean.startsWith("0")) {
        clean = "+44" + clean.slice(1);
    } else if (!clean.startsWith("+")) {
        clean = "+44" + clean;
    }
    return clean;
}

// ================= SEND SMS =================
async function sendSMS({ name, phone, service, date, time }) {
    try {
        if (!phone) throw new Error("No phone number provided");

        const formattedPhone = formatUKNumber(phone);

        console.log(`📲 Sending SMS to ${formattedPhone} for ${name}`);

        await client.messages.create({
            body: `Hi ${name}! 💖\n\nYour ${service} is confirmed for ${date} at ${time}.\n\nSee you soon! ✨`,
            from: twilioNumber,
            to: formattedPhone
        });

        console.log("✅ SMS sent successfully");
        return true;
    } catch (err) {
        console.error("❌ SMS Failed:", err.message);
        return false;
    }
}

// ================= CREATE CHECKOUT SESSION =================
app.post("/create-checkout-session", async (req, res) => {
    const { name, phone, service, date, time } = req.body;

    if (!name || !phone || !service || !date || !time) {
        return res.status(400).json({ error: "Missing required booking fields" });
    }

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
            success_url: `${process.env.BASE_URL || "http://localhost:3000"}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.BASE_URL || "http://localhost:3000"}`,
            metadata: { name, phone, service, date, time },
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error("❌ Stripe session error:", err.message);
        res.status(500).json({ error: "Failed to create payment session" });
    }
});

// ================= WEBHOOK - This is where SMS is triggered =================
app.post("/webhook", async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error("❌ Webhook signature verification failed:", err.message);
        return res.sendStatus(400);
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const metadata = session.metadata;

        if (!metadata || !metadata.phone) {
            console.error("⚠️ No metadata or phone number in session");
            return res.json({ received: true });
        }

        // Save booking
        bookings.push({
            id: Date.now(),
            ...metadata,
            status: "confirmed",
            paidAt: new Date().toISOString()
        });

        // Send SMS
        await sendSMS(metadata);

        console.log(`🎉 Booking confirmed for ${metadata.name}`);
    }

    res.json({ received: true });
});

// ================= START SERVER =================
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 Webhook ready at /webhook`);
});