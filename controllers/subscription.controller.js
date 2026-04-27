const User = require("../models/user.model.js");
const { grantProAccess, checkAndUpdateSubscriptionStatus } = require("../utils/subscription.util.js");
const { logActivity } = require("../utils/logger.util.js");

// GET /api/subscription/status
const getSubscriptionStatus = async (req, res) => {
    try {
        const user = await checkAndUpdateSubscriptionStatus(req.user._id);

        const now = new Date();
        const isActive = user.user_role === "user-pro" && user.pro_expires_at && new Date(user.pro_expires_at) > now;
        const daysRemaining = isActive
            ? Math.ceil((new Date(user.pro_expires_at) - now) / (1000 * 60 * 60 * 24))
            : 0;

        res.status(200).json({
            user_role: user.user_role,
            subscription_status: user.subscription_status,
            pro_expires_at: user.pro_expires_at,
            is_active: isActive,
            days_remaining: daysRemaining
        });
    } catch (error) {
        console.error("Get subscription status error:", error);
        res.status(500).json({ message: "Failed to get subscription status" });
    }
};

// POST /api/subscription/grant-pro (admin only)
const grantPro = async (req, res) => {
    try {
        const { user_id, days } = req.body;

        if (!user_id || !days || typeof days !== "number" || days <= 0) {
            return res.status(400).json({
                message: "user_id and positive days are required"
            });
        }

        const user = await grantProAccess(user_id, days);

        // Log activity สำหรับ admin dashboard (manual grant by admin)
        logActivity({
            user_id: user._id,
            user_name: user.user_name,
            type: "user_upgraded_pro",
            metadata: { days, source: "admin_manual_grant", granted_by: req.user?._id }
        });

        res.status(200).json({
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
        console.error("Grant Pro error:", error);
        res.status(500).json({ message: error.message || "Failed to grant Pro access" });
    }
};

module.exports = {
    getSubscriptionStatus,
    grantPro
};
