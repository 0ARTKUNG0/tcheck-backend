const mongoose = require("mongoose");
const { Schema, model } = mongoose;

/**
 * Activity Log - บันทึกกิจกรรมสำคัญในระบบ
 * ใช้สำหรับ Admin Dashboard "Recent Activity Feed"
 */
const activityLogSchema = new Schema(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        // ชื่อผู้ใช้ตอน log (เก็บไว้เผื่อ user เปลี่ยนชื่อหรือถูกลบ)
        user_name: {
            type: String,
            required: true
        },
        // ประเภทของ activity
        type: {
            type: String,
            enum: [
                "user_signup",          // สมัครสมาชิกใหม่
                "user_upgraded_pro",    // อัปเกรดเป็น Pro
                "payment_received",     // ได้รับเงิน
                "token_limit_hit",      // ใช้ token หมด
                "user_banned",          // ถูกแบน
                "user_deleted"          // ถูกลบ
            ],
            required: true,
            index: true
        },
        // ข้อมูลเพิ่มเติม เช่น amount, payment_method
        metadata: {
            type: Schema.Types.Mixed,
            default: {}
        }
    },
    { timestamps: true }
);

// Index สำหรับ sort ตาม createdAt (recent activity)
activityLogSchema.index({ createdAt: -1 });

const ActivityLog = model("ActivityLog", activityLogSchema);
module.exports = ActivityLog;
