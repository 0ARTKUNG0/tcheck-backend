const User = require("../models/user.model.js");

/**
 * Grant Pro access to a user after successful payment.
 * ใช้จาก webhook (Omise) หรือ admin endpoint
 *
 * - อัปเกรด role เป็น "user-pro"
 * - ตั้งวันหมดอายุ (ต่ออายุจากวันหมดเดิมถ้ายังไม่หมด, หรือจากวันนี้ถ้าหมดแล้ว)
 * - รีเซ็ต remaining_tokens เป็นโควต้า Pro
 * - เปลี่ยน subscription_status เป็น "active"
 *
 * @param {string} userId - _id ของ user
 * @param {number} days - จำนวนวันที่ให้ Pro (default: 30)
 * @returns {Promise<User>} user object หลังอัปเดต
 * @throws Error ถ้าไม่เจอ user
 */
async function grantProAccess(userId, days = 30) {
    if (!userId) {
        throw new Error("grantProAccess: userId is required");
    }
    if (typeof days !== "number" || days <= 0) {
        throw new Error("grantProAccess: days must be a positive number");
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new Error(`grantProAccess: user not found (id: ${userId})`);
    }

    // admin ไม่ต้องเปลี่ยน role แต่ขยายวันหมดอายุได้
    const now = new Date();

    // ถ้ายังไม่หมดอายุ → ต่อจากวันหมดเดิม
    // ถ้าหมดแล้ว (หรือไม่เคยเป็น Pro) → เริ่มจากวันนี้
    const baseDate = (user.pro_expires_at && user.pro_expires_at > now)
        ? user.pro_expires_at
        : now;

    const newExpiry = new Date(baseDate);
    newExpiry.setDate(newExpiry.getDate() + days);

    // อัปเดต role ถ้ายังไม่ใช่ admin
    if (user.user_role !== "admin") {
        user.user_role = "user-pro";
    }

    user.pro_expires_at = newExpiry;
    user.subscription_status = "active";

    // รีเซ็ต token เป็นโควต้า Pro (ใหม่ไปเลย)
    user.remaining_tokens = parseInt(process.env.TOKEN_LIMIT_USER_PRO) || 10000;

    await user.save();

    console.log(`[GRANT_PRO] User ${user.user_email} → Pro until ${newExpiry.toISOString()}`);

    return user;
}

/**
 * ตรวจสอบว่า user ยังมี Pro access อยู่ไหม (ตามวันหมดอายุ)
 * @param {User} user - mongoose user object
 * @returns {boolean}
 */
function hasActivePro(user) {
    if (!user) return false;
    if (user.user_role === "admin") return true;
    if (user.user_role !== "user-pro") return false;
    if (!user.pro_expires_at) return false;
    return user.pro_expires_at > new Date();
}

/**
 * ดาวน์เกรด user ที่ Pro หมดอายุกลับเป็น user-free
 * ใช้จาก cron job รายวัน
 * @returns {Promise<number>} จำนวน user ที่ถูกดาวน์เกรด
 */
async function downgradeExpiredProUsers() {
    const now = new Date();
    const result = await User.updateMany(
        {
            user_role: "user-pro",
            pro_expires_at: { $ne: null, $lt: now }
        },
        {
            $set: {
                user_role: "user-free",
                subscription_status: "expired",
                remaining_tokens: parseInt(process.env.TOKEN_LIMIT_USER_FREE) || 4000
            }
        }
    );

    if (result.modifiedCount > 0) {
        console.log(`[DOWNGRADE] Downgraded ${result.modifiedCount} expired Pro users to Free`);
    }

    return result.modifiedCount;
}

module.exports = {
    grantProAccess,
    hasActivePro,
    downgradeExpiredProUsers
};
