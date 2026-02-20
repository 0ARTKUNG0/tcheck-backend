const mongoose = require("mongoose");
const {Schema, model} = mongoose;

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
        enum: ["admin", "user"],
        default: "user"
    },
    user_tier: {
        type: String,
        enum: ["user-free", "user-pro", null],
        default: "user-free"
    },
}, 
    {timestamps: true}
);

userSchema.pre("save", function (next) {
    if (this.user_role === "admin") {
        this.user_tier = null;
    }
    next();
});

const User = model("User", userSchema);
module.exports = User;