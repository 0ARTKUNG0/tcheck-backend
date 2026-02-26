const mongoose = require("mongoose");
const { Schema, model } = mongoose;

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
        default: "",
        maxlength: 200000
    },
    deletedAt: {
        type: Date,
        default: null
    }
},
    { timestamps: true }
);

// Compound index for efficient queries
documentSchema.index({ ownerId: 1, updatedAt: -1 });

const Document = model("Document", documentSchema);
module.exports = Document;
