const Payment = require("../models/payment.model.js");
const User = require("../models/user.model.js");
const omise = require("omise")({
    publicKey: process.env.OMISE_PUBLIC_KEY,
    secretKey: process.env.OMISE_SECRET_KEY
});

// Create new PromptPay payment with QR code
const createPromptPayPayment = async (req, res) => {
    try {
        const { amount, description } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "Amount must be greater than 0" });
        }
        
        // Verify user exists
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Create Omise Source for PromptPay
        const source = await omise.sources.create({
            type: 'promptpay',
            amount: amount * 100, // Convert to satang
            currency: 'THB'
        });
        
        // Create Omise Charge
        const charge = await omise.charges.create({
            amount: amount * 100,
            currency: 'THB',
            source: source.id,
            description: description || "PromptPay Payment",
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
        
        // Get QR Code URL from Omise
        const qrCodeUrl = charge.source.scannable_code.image.download_uri;
        
        // Create payment record
        const payment = new Payment({
            user_id: req.user._id,
            amount: amount,
            description: description || "PromptPay Payment",
            qr_code_url: qrCodeUrl,
            omise_charge_id: charge.id,
            omise_source_id: source.id,
            payment_method: "promptpay",
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });
        
        await payment.save();
        
        res.status(201).json({
            message: "PromptPay payment created successfully. Please scan the QR code to pay.",
            payment: {
                id: payment._id,
                amount: payment.amount,
                description: payment.description,
                qr_code_url: payment.qr_code_url,
                omise_charge_id: payment.omise_charge_id,
                payment_method: "promptpay",
                status: payment.status,
                expires_at: payment.expires_at
            }
        });
    } catch (error) {
        console.error("Create PromptPay payment error:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Get all PromptPay payments for current user
const getUserPromptPayPayments = async (req, res) => {
    try {
        const payments = await Payment.find({ 
            user_id: req.user._id,
            payment_method: "promptpay"
        })
            .sort("-createdAt")
            .select("-__v");
        
        res.status(200).json({
            message: "PromptPay payments retrieved successfully",
            count: payments.length,
            payments
        });
    } catch (error) {
        console.error("Get PromptPay payments error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get single PromptPay payment by ID
const getPromptPayPaymentById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const payment = await Payment.findOne({ 
            _id: id, 
            user_id: req.user._id,
            payment_method: "promptpay"
        });
        
        if (!payment) {
            return res.status(404).json({ message: "PromptPay payment not found" });
        }
        
        // Check status from Omise if payment is pending
        if (payment.status === "pending" && payment.omise_charge_id) {
            try {
                const charge = await omise.charges.retrieve(payment.omise_charge_id);
                if (charge.status === "successful" || charge.paid === true) {
                    payment.status = "paid";
                    payment.paid_at = new Date();
                    await payment.save();
                }
            } catch (omiseError) {
                console.error("Omise check error:", omiseError);
            }
        }
        
        res.status(200).json({
            message: "PromptPay payment retrieved successfully",
            payment
        });
    } catch (error) {
        console.error("Get PromptPay payment error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Check PromptPay status (for frontend compatibility with check-status.php)
const checkPromptPayStatus = async (req, res) => {
    try {
        const { id } = req.params;
        
        const payment = await Payment.findOne({ 
            _id: id, 
            user_id: req.user._id,
            payment_method: "promptpay"
        });
        
        if (!payment) {
            return res.status(404).json({ 
                success: false,
                message: "Payment not found" 
            });
        }
        
        // Check status from Omise
        if (payment.omise_charge_id) {
            try {
                const charge = await omise.charges.retrieve(payment.omise_charge_id);
                
                // Update status if changed
                if (charge.status === "successful" && payment.status !== "paid") {
                    payment.status = "paid";
                    payment.paid_at = new Date();
                    await payment.save();
                }
                
                return res.status(200).json({
                    success: true,
                    status: charge.status,
                    paid: charge.paid,
                    amount: payment.amount,
                    qr_code_url: payment.qr_code_url
                });
            } catch (omiseError) {
                console.error("Omise check error:", omiseError);
            }
        }
        
        res.status(200).json({
            success: true,
            status: payment.status,
            paid: payment.status === "paid",
            amount: payment.amount,
            qr_code_url: payment.qr_code_url
        });
    } catch (error) {
        console.error("Check PromptPay status error:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error" 
        });
    }
};

module.exports = {
    createPromptPayPayment,
    getUserPromptPayPayments,
    getPromptPayPaymentById,
    checkPromptPayStatus
};
