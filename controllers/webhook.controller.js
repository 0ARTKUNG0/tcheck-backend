const Payment = require("../models/payment.model.js");
const { grantProAccess } = require("../utils/subscription.util.js");
const { logActivity } = require("../utils/logger.util.js");

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
                
                // Grant Pro access when payment is successful
                if (data.status === "successful") {
                    try {
                        const upgradedUser = await grantProAccess(payment.user_id, 30);
                        console.log(`✅ Pro access granted to user ${payment.user_id}`);

                        // Log activity สำหรับ admin dashboard
                        logActivity({
                            user_id: upgradedUser._id,
                            user_name: upgradedUser.user_name,
                            type: "payment_received",
                            metadata: {
                                amount: payment.amount,
                                payment_method: "omise",
                                charge_id: data.id
                            }
                        });
                        logActivity({
                            user_id: upgradedUser._id,
                            user_name: upgradedUser.user_name,
                            type: "user_upgraded_pro",
                            metadata: { days: 30, source: "payment_webhook" }
                        });
                    } catch (proError) {
                        console.error(`❌ Failed to grant Pro access:`, proError.message);
                    }
                }
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
