const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const correctionSchema = new Schema({
    span: { type: String, required: true },
    replacement: { type: String, required: true },
    reason: { type: String, required: true },
    correctedAt: { type: Date, default: Date.now }
}, { _id: false });

const documentSchema = new Schema({
    ownerId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        default: "เอกสารไม่มีชื่อ",
        maxlength: 80
    },
    content: {
        type: String,
        required: true,
        default: ""
    },
    corrections: {
        type: [correctionSchema],
        default: []
    }
},
    { timestamps: true }
);

// Compound index for efficient queries
documentSchema.index({ ownerId: 1, updatedAt: -1 });

const Document = model("Document", documentSchema);
module.exports = Document;
