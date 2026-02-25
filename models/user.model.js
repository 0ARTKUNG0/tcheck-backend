const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const userSchema = new Schema({
    user_name: {
        type: String,
        required: true
    },
    user_email: {
        type: String,
        required: true,
        unique: true
    },
    user_password: {
        type: String,
        required: true
    },
    user_role: {
        type: String,
        enum: ["user-free", "user-pro", "admin"],
        default: "user-free"
    }
},
    { timestamps: true }
);

const User = model("User", userSchema);
module.exports = User;
