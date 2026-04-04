const express = require("express");
const cors = require("cors");
const twilio = require("twilio");
const Stripe = require("stripe");

const app = express();
app.use(cors());

// Webhook needs raw body
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

// Serve static files (index.html, success.html, images, etc.)
app.use(express.static(__dirname));

// 🔐 Credentials
const accountSid = "AC4598af68d81c78de170b6529d318eda7";
const authToken = "70c7dccf1c735625972d54ce24c4d939";
const stripe = Stripe("sk_test_51TBKY3QtbyUXSAuNXQEUpjGHVw4qyJxhADuJ8I4LSlqdBUExEYZuGrbBL8HEGSPLF9kGSQgDBMgYwizDm5FQcikt00fyJ0pB1u");
const endpointSecret = "whsec_yxROhgBYj4VMGUGyQl8R899bZIQTv5Dz";

const client = twilio(accountSid, authToken);
const twilioNumber = "+447460963690";   // Your Twilio SMS-enabled number

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

    const messageBody = `Hi ${name}! 💖 Your ${service} booking is confirmed for ${date} at ${time}.`;

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
            success_url: `https://stomachically-peppiest-alyssa.ngrok-free.dev/success.html?booking=${encodeURIComponent(JSON.stringify({ name, phone, service, date, time }))}`,
            cancel_url: "https://stomachically-peppiest-alyssa.ngrok-free.dev",
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

// 🧪 Manual test route
app.post("/send-sms", async (req, res) => {
    try {
        await sendSMS(req.body);
        res.json({ success: true });
    } catch (err) {
        console.error("❌ Manual SMS error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Start server
app.listen(3000, () => {
    console.log("🚀 Server running on http://localhost:3000");
    console.log(`Twilio From: ${twilioNumber}`);
});