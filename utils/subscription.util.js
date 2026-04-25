const User = require("../models/user.model.js");

/**
 * Grant Pro access to a user for a specified number of days
 * @param {string} userId - The user ID
 * @param {number} days - Number of days to grant Pro access
 * @returns {Promise<Object>} - Updated user object
 */
const grantProAccess = async (userId, days = 30) => {
    try {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

        const user = await User.findByIdAndUpdate(
            userId,
            {
                user_role: "user-pro",
                pro_expires_at: expiresAt,
                subscription_status: "active"
            },
            { new: true }
        );

        if (!user) {
            throw new Error("User not found");
        }

        console.log(`✅ Pro access granted to user ${userId} until ${expiresAt.toISOString()}`);
        return user;
    } catch (error) {
        console.error(`❌ Failed to grant Pro access to user ${userId}:`, error.message);
        throw error;
    }
};

/**
 * Check if a user's Pro subscription is still active
 * If expired, downgrade to user-free
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - User with updated status
 */
const checkAndUpdateSubscriptionStatus = async (userId) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            throw new Error("User not found");
        }

        // If user is not pro, no need to check
        if (user.user_role !== "user-pro") {
            return user;
        }

        const now = new Date();

        // If pro_expires_at is set and has passed
        if (user.pro_expires_at && new Date(user.pro_expires_at) < now) {
            const updatedUser = await User.findByIdAndUpdate(
                userId,
                {
                    user_role: "user-free",
                    subscription_status: "expired",
                    pro_expires_at: null
                },
                { new: true }
            );

            console.log(`⚠️ User ${userId} Pro subscription expired, downgraded to user-free`);
            return updatedUser;
        }

        return user;
    } catch (error) {
        console.error(`❌ Failed to check subscription status for user ${userId}:`, error.message);
        throw error;
    }
};

module.exports = {
    grantProAccess,
    checkAndUpdateSubscriptionStatus
};
