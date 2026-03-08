const Payment = require("../models/payment.model.js");
const User = require("../models/user.model.js");

// Create new payment with fixed QR code image
const createPayment = async (req, res) => {
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
        
        // Fixed QR code image path - place your PromptPay QR image here
        const qrCodeUrl = "/uploads/qr-codes/promptpay-qr.jpg";
        
        // Create payment record
        const payment = new Payment({
            user_id: req.user._id,
            amount: amount,
            description: description || "Upgrade to Pro",
            qr_code_url: qrCodeUrl,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });
        
        await payment.save();
        
        res.status(201).json({
            message: "Payment created successfully. Please scan the QR code to pay.",
            payment: {
                id: payment._id,
                amount: payment.amount,
                description: payment.description,
                qr_code_url: payment.qr_code_url,
                status: payment.status,
                expires_at: payment.expires_at
            }
        });
    } catch (error) {
        console.error("Create payment error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get all payments for current user
const getUserPayments = async (req, res) => {
    try {
        const payments = await Payment.find({ user_id: req.user._id })
            .sort("-createdAt")
            .select("-__v");
        
        res.status(200).json({
            message: "Payments retrieved successfully",
            count: payments.length,
            payments
        });
    } catch (error) {
        console.error("Get payments error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get single payment by ID
const getPaymentById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const payment = await Payment.findOne({ 
            _id: id, 
            user_id: req.user._id 
        });
        
        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }
        
        res.status(200).json({
            message: "Payment retrieved successfully",
            payment
        });
    } catch (error) {
        console.error("Get payment error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Verify payment (admin only or manual verification)
const verifyPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!["pending", "paid", "expired", "cancelled"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }
        
        const payment = await Payment.findById(id);
        
        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }
        
        payment.status = status;
        
        if (status === "paid") {
            payment.paid_at = new Date();
        }
        
        await payment.save();
        
        res.status(200).json({
            message: "Payment verified successfully",
            payment
        });
    } catch (error) {
        console.error("Verify payment error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    createPayment,
    getUserPayments,
    getPaymentById,
    verifyPayment
};
