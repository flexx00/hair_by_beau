const express = require("express");
const cors = require("cors");
const twilio = require("twilio");
const Stripe = require("stripe");
const fs = require("fs");
const path = require("path");

const app = express();

// ================= PORT =================
const PORT = process.env.PORT || 3000;

// ================= BASE URL =================
// Use Render's environment variable if available, otherwise fallback
const BASE_URL = process.env.RENDER_EXTERNAL_URL
    ? `https://${process.env.RENDER_EXTERNAL_URL}`
    : "http://localhost:3000";

// ================= MIDDLEWARE =================
// 1. Raw body for Stripe Webhook verification
app.use("/webhook", express.raw({ type: "application/json" }));

// 2. JSON parsing for other routes
app.use(express.json());

// 3. CORS (Allow frontend to talk to backend)
app.use(cors());

// 4. SERVE STATIC FILES FROM 'PUBLIC' FOLDER
// This tells Express to look inside the 'public' folder for HTML/CSS/JS
app.use(express.static(path.join(__dirname, "public")));

// ================= KEYS =================
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_51TBKY3QtbyUXSAuNXQEUpjGHVw4qyJxhADuJ8I4LSlqdBUExEYZuGrbBL8HEGSPLF9kGSQgDBMgYwizDm5FQcikt00fyJ0pB1u");
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_pVUpdXbT0IDspBBe7R4VUDP74JMsFRAE";

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID || "AC4598af68d81c78de170b6529d318eda7",
    process.env.TWILIO_AUTH_TOKEN || "81da45b7bb682348024e4f017671c673"
);

const twilioNumber = "+447460963690";
const ADMIN_PHONE = "+447927799217"; // Your number

// ================= FILE STORAGE =================
const bookingsFilePath = path.join(__dirname, "bookings.json");

function loadBookingsFromFile() {
    try {
        if (!fs.existsSync(bookingsFilePath)) {
            fs.writeFileSync(bookingsFilePath, "[]"); // Create empty file if missing
            return [];
        }
        const data = fs.readFileSync(bookingsFilePath, "utf8");
        return JSON.parse(data);
    } catch (err) {
        console.error("Error loading bookings:", err);
        return [];
    }
}

function saveBookingsToFile(bookings) {
    fs.writeFileSync(bookingsFilePath, JSON.stringify(bookings, null, 2));
}

let bookings = loadBookingsFromFile();

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
    if (clean.startsWith("0")) clean = "+44" + clean.slice(1);
    if (!clean.startsWith("+")) clean = "+" + clean;
    return clean;
}

// ================= SMS =================
async function sendSMS({ phone, name, service, date, time }) {
    const formattedPhone = formatUKNumber(phone);

    // 1. SMS to Customer
    try {
        await client.messages.create({
            body: `Hi ${name}! 💖 Your ${service} booking is confirmed for ${date} at ${time}.`,
            from: twilioNumber,
            to: formattedPhone,
        });
        console.log("✅ Customer SMS sent");
    } catch (err) { console.error("❌ Customer SMS Error:", err.message); }

    // 2. SMS to Admin (You)
    try {
        await client.messages.create({
            body: `💇♀️ NEW BOOKING!\n${name}\n${service}\n${date} @ ${time}\n${phone}`,
            from: twilioNumber,
            to: ADMIN_PHONE,
        });
        console.log("✅ Admin SMS sent");
    } catch (err) { console.error("❌ Admin SMS Error:", err.message); }
}

// ================= ROUTES =================

// 1. Get all bookings (Admin Dashboard)
app.get("/bookings", (req, res) => {
    console.log("📡 Fetching bookings. Count:", bookings.length);
    res.json(bookings);
});

// 2. Delete a booking (Admin Dashboard)
app.delete("/bookings/:id", (req, res) => {
    const bookingId = parseInt(req.params.id);
    const beforeLength = bookings.length;
    bookings = bookings.filter((b) => b.id !== bookingId);

    if (bookings.length < beforeLength) {
        saveBookingsToFile(bookings);
        console.log(`🗑️ Booking ${bookingId} deleted`);
        res.status(204).end();
    } else {
        res.status(404).json({ error: "Booking not found" });
    }
});

// 3. Create Checkout Session
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
                        product_data: {
                            name: service
                        },
                        unit_amount: getPrice(service),
                    },
                    quantity: 1,
                },
            ],
            success_url: `${BASE_URL}/?success=true`,
            cancel_url: `${BASE_URL}/?canceled=true`,
            metadata: {
                name,
                phone,
                service,
                date,
                time
            },
        });

        console.log("💳 Stripe session created:", session.id);
        res.json({ url: session.url });
    } catch (err) {
        console.error("❌ Stripe error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 4. Webhook (Handles Payment Success)
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
        const bookingData = session.metadata;

        console.log("💳 PAYMENT SUCCESS:", bookingData);

        const newBooking = {
            id: Date.now(),
            name: bookingData.name,
            phone: bookingData.phone,
            service: bookingData.service,
            date: bookingData.date,
            time: bookingData.time,
            status: "active",
        };

        bookings.push(newBooking);
        saveBookingsToFile(bookings);

        // ✅ Send SMS AFTER payment success
        sendSMS(newBooking);
    }

    res.json({ received: true });
});

// 5. Health Check
app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "Server is running!" });
});

// ================= START =================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📂 Serving static files from: ${path.join(__dirname, "public")}`);
});