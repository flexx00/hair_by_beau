const express = require("express");
const cors = require("cors");
const twilio = require("twilio");
const Stripe = require("stripe");

const app = express();
app.use(cors());

// ================= PORT =================
const PORT = process.env.PORT || 3000;

// ================= BASE URL =================
// 🔥 Uses your custom domain automatically
const BASE_URL =
    process.env.NODE_ENV === "production"
        ? "https://hairbybeau.com"
        : "http://localhost:3000";

// ================= MIDDLEWARE =================
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.static(__dirname));

// ================= KEYS =================
// ⚠️ Move to ENV later for security
const stripe = Stripe("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");
const endpointSecret = "mk_1TBKYGQtbyUXSAuNLA1sh0c1";

const client = twilio(
    "AC4598af68d81c78de170b6529d318eda7",
    "81da45b7bb682348024e4f017671c673"
);

const twilioNumber = "+447460963690";

// ================= TEMP STORAGE =================
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
    let clean = String(phone || "").replace(/\s+/g, "");

    if (clean.startsWith("0")) {
        clean = "+44" + clean.slice(1);
    }

    if (!clean.startsWith("+")) {
        clean = "+" + clean;
    }

    return clean;
}

// ================= SMS =================
async function sendSMS({ phone, name, service, date, time }) {
    try {
        const formattedPhone = formatUKNumber(phone);

        console.log("📩 Sending SMS to:", formattedPhone);

        await client.messages.create({
            body: `Hi ${name}! 💖 Your ${service} booking is confirmed for ${date} at ${time}.`,
            from: twilioNumber,
            to: formattedPhone,
        });

        console.log("✅ SMS SENT SUCCESSFULLY");
    } catch (err) {
        console.error("❌ SMS ERROR:", err.message);
    }
}

// ================= CREATE CHECKOUT =================
app.post("/create-checkout-session", async (req, res) => {
    const { name, phone, service, date, time } = req.body;

    if (!name || !phone || !service || !date || !time) {
        return res.status(400).json({ error: "Missing booking data" });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "gbp",
                        product_data: { name: service },
                        unit_amount: getPrice(service),
                    },
                    quantity: 1,
                },
            ],

            // ✅ FIXED URL (THIS WAS YOUR MAIN ISSUE)
            success_url: `${BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${BASE_URL}`,

            metadata: { name, phone, service, date, time },
        });

        console.log("💳 Stripe session created:", session.id);

        res.json({ url: session.url });
    } catch (err) {
        console.error("❌ Stripe error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ================= GET SESSION =================
app.get("/session/:id", async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.retrieve(req.params.id);

        if (!session || !session.metadata) {
            return res.status(404).json({ error: "Booking not found" });
        }

        res.json({ booking: session.metadata });
    } catch (err) {
        console.error("❌ Session fetch error:", err.message);
        res.status(500).json({ error: "Failed to retrieve session" });
    }
});

// ================= WEBHOOK =================
app.post("/webhook", (req, res) => {
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

        console.log("💳 PAYMENT SUCCESS:", booking);

        bookings.push({
            id: Date.now(),
            ...booking,
            status: "active",
        });

        // ✅ SMS sent AFTER payment success
        sendSMS(booking);
    }

    res.json({ received: true });
});

// ================= HEALTH =================
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

// ================= START =================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});