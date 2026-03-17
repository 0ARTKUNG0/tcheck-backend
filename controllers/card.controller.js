const Payment = require("../models/payment.model.js");
const User = require("../models/user.model.js");
const omise = require("omise")({
    publicKey: process.env.OMISE_PUBLIC_KEY,
    secretKey: process.env.OMISE_SECRET_KEY
});

// Create new card payment (Credit/Debit)
const createCardPayment = async (req, res) => {
    try {
        const { amount, description, card_token } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "Amount must be greater than 0" });
        }
        
        if (!card_token) {
            return res.status(400).json({ message: "Card token is required" });
        }
        
        // Verify user exists
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Create Omise Charge with card token
        const charge = await omise.charges.create({
            amount: amount * 100, // Convert to satang
            currency: 'THB',
            card: card_token,
            description: description || "Card Payment",
            capture: true // Auto capture
        });
        
        // Create payment record
        const payment = new Payment({
            user_id: req.user._id,
            amount: amount,
            description: description || "Card Payment",
            omise_charge_id: charge.id,
            payment_method: "card",
            card_brand: charge.card?.brand,
            card_last_digits: charge.card?.last_digits,
            status: charge.status === "successful" ? "paid" : "pending",
            paid_at: charge.status === "successful" ? new Date() : null
        });
        
        await payment.save();
        
        res.status(201).json({
            message: charge.status === "successful" 
                ? "Card payment successful" 
                : "Card payment pending",
            payment: {
                id: payment._id,
                amount: payment.amount,
                description: payment.description,
                omise_charge_id: payment.omise_charge_id,
                payment_method: "card",
                card_brand: payment.card_brand,
                card_last_digits: payment.card_last_digits,
                status: payment.status,
                paid_at: payment.paid_at
            }
        });
    } catch (error) {
        console.error("Create card payment error:", error);
        res.status(500).json({ 
            message: "Card payment failed", 
            error: error.message 
        });
    }
};

// Get all card payments for current user
const getUserCardPayments = async (req, res) => {
    try {
        const payments = await Payment.find({ 
            user_id: req.user._id,
            payment_method: "card"
        })
            .sort("-createdAt")
            .select("-__v");
        
        res.status(200).json({
            message: "Card payments retrieved successfully",
            count: payments.length,
            payments
        });
    } catch (error) {
        console.error("Get card payments error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get single card payment by ID
const getCardPaymentById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const payment = await Payment.findOne({ 
            _id: id, 
            user_id: req.user._id,
            payment_method: "card"
        });
        
        if (!payment) {
            return res.status(404).json({ message: "Card payment not found" });
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
            message: "Card payment retrieved successfully",
            payment
        });
    } catch (error) {
        console.error("Get card payment error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Charge card (alias for createCardPayment - for frontend compatibility)
const chargeCard = async (req, res) => {
    try {
        const { amount, token, description } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "Amount must be greater than 0" });
        }
        
        if (!token) {
            return res.status(400).json({ message: "Token is required" });
        }
        
        // Verify user exists
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Create Omise Charge with card token
        const charge = await omise.charges.create({
            amount: amount, // Frontend sends in satang already
            currency: 'THB',
            card: token,
            description: description || "Card Payment",
            capture: true
        });
        
        // Create payment record
        const payment = new Payment({
            user_id: req.user._id,
            amount: amount / 100, // Convert to baht for storage
            description: description || "Card Payment",
            omise_charge_id: charge.id,
            payment_method: "card",
            card_brand: charge.card?.brand,
            card_last_digits: charge.card?.last_digits,
            status: charge.status === "successful" ? "paid" : "pending",
            paid_at: charge.status === "successful" ? new Date() : null
        });
        
        await payment.save();
        
        res.status(201).json({
            success: true,
            message: charge.status === "successful" 
                ? "Payment successful" 
                : "Payment pending",
            charge_id: charge.id,
            status: charge.status,
            amount: amount,
            currency: 'THB'
        });
    } catch (error) {
        console.error("Charge card error:", error);
        res.status(500).json({ 
            success: false,
            message: "Payment failed", 
            error: error.message 
        });
    }
};

module.exports = {
    createCardPayment,
    chargeCard,
    getUserCardPayments,
    getCardPaymentById
};
