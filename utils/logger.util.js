const ActivityLog = require("../models/activityLog.model.js");
const UsageLog = require("../models/usageLog.model.js");

/**
 * บันทึก activity ของ user (สำหรับ Admin Activity Feed)
 * เรียกใช้แบบ fire-and-forget - ไม่ block flow ปกติถ้า log ล้มเหลว
 *
 * @param {Object} params
 * @param {string} params.user_id - _id ของ user
 * @param {string} params.user_name - ชื่อ user (สำรองไว้กรณี user ถูกลบ)
 * @param {string} params.type - ประเภท: user_signup, user_upgraded_pro, payment_received, token_limit_hit, user_banned, user_deleted
 * @param {Object} [params.metadata] - ข้อมูลเพิ่มเติม เช่น {amount, payment_method}
 */
async function logActivity({ user_id, user_name, type, metadata = {} }) {
    try {
        if (!user_id || !user_name || !type) {
            console.warn("[logActivity] Missing required fields");
            return;
        }
        await ActivityLog.create({ user_id, user_name, type, metadata });
    } catch (err) {
        // ไม่ throw - ป้องกันไม่ให้ logging ทำลาย flow หลัก
        console.error("[logActivity] Error:", err.message);
    }
}

/**
 * บันทึกการใช้งาน AI (สำหรับ Admin Charts + AI Calls Today card)
 * เรียกใช้แบบ fire-and-forget
 *
 * @param {Object} params
 * @param {string} params.user_id
 * @param {string} params.action - "grammar_check" | "tone_adjust"
 * @param {number} [params.tokens_used]
 * @param {number} [params.issues_found]
 * @param {number} [params.text_length]
 * @param {string} [params.tone_type] - "formal" | "casual" (สำหรับ tone_adjust)
 */
async function logUsage({ user_id, action, tokens_used = 0, issues_found = 0, text_length = 0, tone_type = null }) {
    try {
        if (!user_id || !action) {
            console.warn("[logUsage] Missing required fields");
            return;
        }
        await UsageLog.create({
            user_id,
            action,
            tokens_used,
            issues_found,
            text_length,
            tone_type
        });
    } catch (err) {
        console.error("[logUsage] Error:", err.message);
    }
}

module.exports = {
    logActivity,
    logUsage
};
