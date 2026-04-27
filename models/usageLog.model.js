const mongoose = require("mongoose");
const { Schema, model } = mongoose;

/**
 * Usage Log - บันทึกการใช้งาน AI ทุกครั้ง
 * ใช้สำหรับ:
 * - Admin Dashboard: "AI Calls Today" card + AI Usage Breakdown chart
 * - User Dashboard: stats, recent activity (อนาคต)
 */
const usageLogSchema = new Schema(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        // ประเภทของ AI call
        action: {
            type: String,
            enum: ["grammar_check", "tone_adjust"],
            required: true,
            index: true
        },
        // จำนวน token ที่ใช้ (= text length)
        tokens_used: {
            type: Number,
            default: 0
        },
        // จำนวน issue ที่เจอ (สำหรับ grammar)
        issues_found: {
            type: Number,
            default: 0
        },
        // ความยาวของข้อความ
        text_length: {
            type: Number,
            default: 0
        },
        // tone_type ถ้าเป็น tone_adjust ("formal" | "casual")
        tone_type: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

// Index สำหรับ time-series queries (charts)
usageLogSchema.index({ createdAt: -1 });
usageLogSchema.index({ user_id: 1, createdAt: -1 });

const UsageLog = model("UsageLog", usageLogSchema);
module.exports = UsageLog;
