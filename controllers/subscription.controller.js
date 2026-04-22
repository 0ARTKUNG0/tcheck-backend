const { grantProAccess } = require("../utils/subscription.util.js");
const User = require("../models/user.model.js");

/**
 * POST /api/subscription/grant-pro
 * Admin endpoint สำหรับอัปเกรด user เป็น Pro แบบ manual
 * ใช้สำหรับ: testing, refund compensation, giveaway
 *
 * Body: { user_id: string, days?: number }
 */
const grantProManual = async (req, res) => {
    const { user_id, days } = req.body;

    // Input validation (ป้องกัน NoSQL injection)
    if (!user_id || typeof user_id !== "string") {
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "user_id (string) is required"
        });
    }

    const grantDays = days !== undefined ? days : 30;
    if (typeof grantDays !== "number" || grantDays <= 0 || grantDays > 3650) {
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "days must be a positive number (max 3650)"
        });
    }

    try {
        const user = await grantProAccess(user_id, grantDays);

        return res.status(200).json({
            message: "Pro access granted successfully",
            data: {
                user_id: user._id,
                user_email: user.user_email,
                user_role: user.user_role,
                pro_expires_at: user.pro_expires_at,
                subscription_status: user.subscription_status
            }
        });
    } catch (error) {
        if (error.message.includes("user not found")) {
            return res.status(404).json({
                code: "USER_NOT_FOUND",
                message: "User not found"
            });
        }
        console.error("[GRANT_PRO_MANUAL] Error:", error);
        return res.status(500).json({
            code: "INTERNAL_ERROR",
            message: "Internal server error"
        });
    }
};

/**
 * GET /api/subscription/status
 * ให้ user เช็คสถานะ subscription ของตัวเอง
 */
const getSubscriptionStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select(
            "user_role pro_expires_at subscription_status"
        );

        if (!user) {
            return res.status(404).json({
                code: "NOT_FOUND",
                message: "User not found"
            });
        }

        const now = new Date();
        const isActive = user.user_role === "user-pro"
            && user.pro_expires_at
            && user.pro_expires_at > now;

        return res.status(200).json({
            user_role: user.user_role,
            subscription_status: user.subscription_status,
            pro_expires_at: user.pro_expires_at,
            is_active: isActive,
            days_remaining: isActive
                ? Math.ceil((user.pro_expires_at - now) / (1000 * 60 * 60 * 24))
                : 0
        });
    } catch (error) {
        console.error("[GET_SUBSCRIPTION_STATUS] Error:", error);
        return res.status(500).json({
            code: "INTERNAL_ERROR",
            message: "Internal server error"
        });
    }
};

module.exports = {
    grantProManual,
    getSubscriptionStatus
};
