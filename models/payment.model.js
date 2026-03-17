const mongoose = require("mongoose");
const {Schema, model} = mongoose;

const paymentSchema = new Schema({
    user_id: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        default: ""
    },
    // Payment method: promptpay, card
    payment_method: {
        type: String,
        enum: ["promptpay", "card"],
        required: true
    },
    // For PromptPay (QR Code)
    qr_code_url: {
        type: String
    },
    // For Card payments
    card_brand: {
        type: String
    },
    card_last_digits: {
        type: String
    },
    // Omise references
    omise_charge_id: {
        type: String
    },
    omise_source_id: {
        type: String
    },
    status: {
        type: String,
        enum: ["pending", "paid", "expired", "cancelled"],
        default: "pending"
    },
    paid_at: {
        type: Date
    },
    expires_at: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
}, {
    timestamps: true
});

const Payment = model("Payment", paymentSchema);
module.exports = Payment;
