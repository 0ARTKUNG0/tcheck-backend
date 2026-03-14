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
    },
    remaining_tokens: {
        type: Number,
        default: function() {
            if (this.user_role === "user-pro") {
                return parseInt(process.env.TOKEN_LIMIT_USER_PRO) || 10000;
            } else if (this.user_role === "admin") {
                return parseInt(process.env.TOKEN_LIMIT_ADMIN) || 50000;
            } else {
                // user-free or default
                return parseInt(process.env.TOKEN_LIMIT_USER_FREE) || 4000;
            }
        }
    }
},
    { timestamps: true }
);

const User = model("User", userSchema);
module.exports = User;
