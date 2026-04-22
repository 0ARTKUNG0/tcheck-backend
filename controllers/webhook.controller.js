const Payment = require("../models/payment.model.js");

// Webhook handler for Omise events
const handleOmiseWebhook = async (req, res) => {
    try {
        console.log("=== OMISE WEBHOOK RECEIVED ===");
        console.log("Headers:", JSON.stringify(req.headers));
        console.log("Body:", req.body);
        
        if (!req.body || typeof req.body !== 'object') {
            console.log("⚠️ No body received, returning OK to prevent retries");
            return res.status(200).send("OK");
        }
        
        const { key, data } = req.body;
        
        console.log("Event:", key);
        console.log("Charge ID:", data?.id);
        console.log("Status:", data?.status);
        console.log("Timestamp:", new Date().toISOString());
        
        if (key === "charge.complete") {
            const payment = await Payment.findOneAndUpdate(
                { omise_charge_id: data.id },
                { 
                    status: data.status === "successful" ? "paid" : "cancelled",
                    paid_at: data.status === "successful" ? new Date() : null
                },
                { new: true }
            );
            
            if (payment) {
                console.log(`✅ Payment ${payment._id} updated to ${payment.status}`);
            } else {
                console.log(`⚠️ No payment found for charge ID: ${data.id}`);
            }
        }
        
        console.log("=== WEBHOOK PROCESSING COMPLETE ===");
        res.status(200).send("OK");
    } catch (error) {
        console.error("❌ Webhook error:", error);
        res.status(500).json({ message: "Webhook processing error" });
    }
};

module.exports = {
    handleOmiseWebhook
};
