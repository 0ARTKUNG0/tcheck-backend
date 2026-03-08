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
    qr_code_url: {
        type: String,
        required: true
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
