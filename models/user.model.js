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
        // ไม่ required เพราะผู้ใช้ที่ login ด้วย Google ไม่มีรหัสผ่าน
        required: false
    },
    // Google OAuth - sub claim จาก Google (unique identifier)
    google_id: {
        type: String,
        unique: true,
        sparse: true,  // sparse: ยอมให้ null ซ้ำกันได้ (สำหรับ user ที่ไม่ได้ใช้ Google)
        index: true
    },
    // ผู้ให้บริการ auth: "local" = email/password, "google" = Google OAuth
    auth_provider: {
        type: String,
        enum: ["local", "google"],
        default: "local"
    },
    // รูปโปรไฟล์จาก Google (URL)
    profile_picture: {
        type: String,
        default: null
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
    },
    pro_expires_at: {
        type: Date,
        default: null
    },
    subscription_status: {
        type: String,
        enum: ["none", "active", "expired", "cancelled"],
        default: "none"
    },
    omise_customer_id: {
        type: String,
        default: null
    },
    // สถานะแบน - true = ถูกแบน, ไม่สามารถใช้งาน API ได้
    is_banned: {
        type: Boolean,
        default: false,
        index: true
    },
    // Soft delete - true = ถูกลบแล้ว, ไม่แสดงใน query ปกติ
    is_deleted: {
        type: Boolean,
        default: false,
        index: true
    },
    // วัน/เวลาที่ใช้งานล่าสุด (อัปเดตจาก middleware)
    last_active_at: {
        type: Date,
        default: Date.now,
        index: true
    }
},
    { timestamps: true }
);

const User = model("User", userSchema);
module.exports = User;
