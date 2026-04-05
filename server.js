const express = require("express");
const cors = require("cors");
const twilio = require("twilio");
const Stripe = require("stripe");

const app = express();
app.use(cors());

// ================= ENV / PORT =================
const PORT = process.env.PORT || 3000;

// ================= MIDDLEWARE =================
// Stripe webhook MUST come BEFORE express.json()
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

// Serve frontend
app.use(express.static(__dirname));

// ================= 🔐 CREDENTIALS =================
// ⚠️ For production: move these to ENV variables later
const accountSid = "AC4598af68d81c78de170b6529d318eda7";
const authToken = "70c7dccf1c735625972d54ce24c4d939";
const stripe = Stripe("sk_test_51TBKY3QtbyUXSAuNXQEUpjGHVw4qyJxhADuJ8I4LSlqdBUExEYZuGrbBL8HEGSPLF9kGSQgDBMgYwizDm5FQcikt00fyJ0pB1u");
const endpointSecret = "whsec_pVUpdXbT0IDspBBe7R4VUDP74JMsFRAE";

const client = twilio(
    "AC4598af68d81c78de170b6529d318eda7",
    "70c7dccf1c735625972d54ce24c4d939"
);
const twilioNumber = "+447460963690";

// ================= STORAGE =================
// ⚠️ Temporary (resets on restart)
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

// ================= SMS =================
async function sendSMS({ phone, name, service, date, time }) {
    try {
        let cleanPhone = String(phone || "").replace(/\s+/g, "");
        if (!cleanPhone.startsWith("+")) cleanPhone = "+" + cleanPhone;

        const messageBody =
            `Hi ${name}! 💖 Your ${service} booking is confirmed for ${date} at ${time}.`;

        await client.messages.create({
            body: messageBody,
            from: twilioNumber,
            to: cleanPhone
        });

        console.log("✅ SMS SENT:", cleanPhone);
    } catch (err) {
        console.error("❌ SMS ERROR:", err.message);
    }
}

// ================= CREATE STRIPE SESSION =================
app.post("/create-checkout-session", async (req, res) => {
    const { name, phone, service, date, time } = req.body;

    if (!name || !phone || !service || !date || !time) {
        return res.status(400).json({ error: "Missing booking data" });
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

            // ✅ LIVE URL (FIXED)
            success_url: `https://hair-by-beau.onrender.com/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: "https://hair-by-beau.onrender.com",

            metadata: { name, phone, service, date, time },
        });

        res.json({ url: session.url });

    } catch (err) {
        console.error("❌ Stripe error:", err.message);
        res.status(500).json({ error: err.message });
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
            status: "active"
        };

        bookings.push(newBooking);

        // 🔥 Send SMS async (don’t block webhook)
        sendSMS(booking);
    }

    res.json({ received: true });
});


app.get("/test-sms", async (req, res) => {
    try {
        await client.messages.create({
            body: "Test SMS from Hair By Beau 💖",
            from: "+447460963690",
            to: "+447932355630"
        });

        res.send("SMS sent!");
    } catch (err) {
        res.send("Error: " + err.message);
    }
});

// ================= GET BOOKINGS =================
app.get("/bookings", (req, res) => {
    res.json(bookings);
});

// ================= CANCEL =================
app.delete("/book/:id", (req, res) => {
    const id = Number(req.params.id);

    bookings = bookings.map(b =>
        b.id === id ? { ...b, status: "cancelled" } : b
    );

    res.json({ success: true });
});

// ================= TEST ROUTE =================
app.post("/test-booking", (req, res) => {
    const test = {
        id: Date.now(),
        name: "Test User",
        phone: "+447000000000",
        service: "Wash / Blow Dry",
        date: "2026-04-10",
        time: "12:00",
        status: "active"
    };

    bookings.push(test);

    res.json({ success: true, booking: test });
});

// ================= HEALTH CHECK =================
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

// ================= START =================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});