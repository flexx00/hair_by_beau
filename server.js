const express = require("express");
const cors = require("cors");
const twilio = require("twilio");
const Stripe = require("stripe");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());

// ================= PORT =================
const PORT = process.env.PORT || 3000;

// ================= BASE URL =================
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// ================= MIDDLEWARE =================
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.static(__dirname));

// ================= FILE STORAGE =================
const BOOKINGS_FILE = path.join(__dirname, "bookings.json");

function loadBookings() {
    if (fs.existsSync(BOOKINGS_FILE)) {
        return JSON.parse(fs.readFileSync(BOOKINGS_FILE));
    }
    return [];
}

function saveBookings() {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
}

let bookings = loadBookings();

// ================= KEYS (USE ENV ON RENDER) =================
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const client = twilio(
    process.env.TWILIO_SID,
    process.env.TWILIO_AUTH
);

const twilioNumber = process.env.TWILIO_PHONE;

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

        await client.messages.create({
            body: `Hi ${name}! 💖 Your ${service} booking is confirmed for ${date} at ${time}.`,
            from: twilioNumber,
            to: formattedPhone,
        });

        console.log("✅ SMS SENT");
    } catch (err) {
        console.error("❌ SMS ERROR:", err.message);
    }
}

// ================= CREATE CHECKOUT =================
app.post("/create-checkout-session", async (req, res) => {
    try {
        const { name, phone, service, date, time } = req.body;

        if (!name || !phone || !service || !date || !time) {
            return res.status(400).json({ error: "Missing booking data" });
        }

        console.log("📦 Booking request:", req.body);

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
            success_url: `${BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${BASE_URL}`,
            metadata: { name, phone, service, date, time },
        });

        console.log("💳 Stripe session:", session.id);

        res.json({ url: session.url });

    } catch (err) {
        console.error("❌ STRIPE ERROR:", err);
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
        console.error("❌ Session error:", err);
        res.status(500).json({ error: "Failed to retrieve session" });
    }
});

// ================= WEBHOOK =================
app.post("/webhook", (req, res) => {
    let event;

    try {
        const sig = req.headers["stripe-signature"];
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error("❌ Webhook error:", err.message);
        return res.sendStatus(400);
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const booking = session.metadata;

        console.log("💳 PAYMENT SUCCESS:", booking);

        const newBooking = {
            id: Date.now(),
            ...booking,
            status: "active",
        };

        bookings.push(newBooking);
        saveBookings();

        sendSMS(booking);
    }

    res.json({ received: true });
});

// ================= BOOKINGS =================
app.get("/bookings", (req, res) => {
    res.json(bookings);
});

app.delete("/bookings/:id", (req, res) => {
    const id = Number(req.params.id);
    bookings = bookings.filter(b => b.id !== id);
    saveBookings();
    res.json({ success: true });
});

// ================= HEALTH =================
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

// ================= IMPORTANT FIX =================
// 👇 THIS FIXES YOUR 404 + JSON ERROR
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// ================= START =================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});