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
const BASE_URL =
    process.env.NODE_ENV === "production"
        ? "https://hairbybeau.com"
        : "http://localhost:3000";

// ================= MIDDLEWARE =================
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.static(__dirname));

// ================= KEYS =================
const stripe = Stripe("sk_test_51TBKY3QtbyUXSAuNXQEUpjGHVw4qyJxhADuJ8I4LSlqdBUExEYZuGrbBL8HEGSPLF9kGSQgDBMgYwizDm5FQcikt00fyJ0pB1u");
const endpointSecret = "whsec_pVUpdXbT0IDspBBe7R4VUDP74JMsFRAE";

const client = twilio(
    "AC4598af68d81c78de170b6529d318eda7",
    "81da45b7bb682348024e4f017671c673"
);

const twilioNumber = "+447460963690";

// ================= FILE STORAGE =================
const bookingsFilePath = path.join(__dirname, "bookings.json");

// Load bookings from file
function loadBookingsFromFile() {
    try {
        const data = fs.readFileSync(bookingsFilePath, "utf8");
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

// Save bookings to file
function saveBookingsToFile(bookings) {
    fs.writeFileSync(bookingsFilePath, JSON.stringify(bookings, null, 2));
}

// Initialize bookings from file
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

// ================= BOOKINGS API =================
// Get all bookings
app.get("/bookings", (req, res) => {
    res.json(bookings);
});

// Add a new booking
app.post("/bookings", (req, res) => {
    const booking = req.body;
    if (!booking.id) booking.id = Date.now();
    if (!booking.status) booking.status = "active";
    bookings.push(booking);
    saveBookingsToFile(bookings);
    res.status(201).json(booking);
});

// Update a booking
app.put("/bookings/:id", (req, res) => {
    const bookingId = parseInt(req.params.id);
    const bookingIndex = bookings.findIndex((b) => b.id === bookingId);
    if (bookingIndex === -1) {
        return res.status(404).json({ error: "Booking not found" });
    }
    bookings[bookingIndex] = { ...bookings[bookingIndex], ...req.body };
    saveBookingsToFile(bookings);
    res.json(bookings[bookingIndex]);
});

// Delete a booking
app.delete("/bookings/:id", (req, res) => {
    const bookingId = parseInt(req.params.id);
    bookings = bookings.filter((b) => b.id !== bookingId);
    saveBookingsToFile(bookings);
    res.status(204).end();
});

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

        const newBooking = {
            id: Date.now(),
            ...booking,
            status: "active",
        };

        bookings.push(newBooking);
        saveBookingsToFile(bookings);

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