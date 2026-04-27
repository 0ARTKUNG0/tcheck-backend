/**
 * Admin Dashboard Controller
 * รวม endpoint ทั้งหมดสำหรับหน้า Admin Dashboard
 *
 * ทุก endpoint ต้อง verifyToken + isAdmin (จัดการที่ router)
 */

const mongoose = require("mongoose");
const User = require("../models/user.model.js");
const ActivityLog = require("../models/activityLog.model.js");
const UsageLog = require("../models/usageLog.model.js");
const Payment = require("../models/payment.model.js");
const { logActivity } = require("../utils/logger.util.js");
const { startOfToday, daysAgo, fillDateGaps } = require("../utils/dashboard.util.js");

// ตรวจสอบว่า id เป็น ObjectId ที่ถูกต้องก่อนใช้ query
function isValidObjectId(id) {
    return typeof id === "string" && mongoose.Types.ObjectId.isValid(id) && /^[a-f\d]{24}$/i.test(id);
}

/**
 * GET /api/dashboard/admin/overview
 * คืน 5 cards: total_users, active_users (last 7d), pro_users, ai_calls_today, banned_users
 */
const getOverview = async (req, res) => {
    try {
        const today = startOfToday();
        const sevenDaysAgo = daysAgo(7);

        const [totalUsers, activeUsers, proUsers, aiCallsToday, bannedUsers] = await Promise.all([
            User.countDocuments({ is_deleted: { $ne: true } }),
            User.countDocuments({ is_deleted: { $ne: true }, last_active_at: { $gte: sevenDaysAgo } }),
            User.countDocuments({ is_deleted: { $ne: true }, user_role: "user-pro" }),
            UsageLog.countDocuments({ createdAt: { $gte: today } }),
            User.countDocuments({ is_deleted: { $ne: true }, is_banned: true })
        ]);

        return res.status(200).json({
            total_users: totalUsers,
            active_users: activeUsers,
            pro_users: proUsers,
            ai_calls_today: aiCallsToday,
            banned_users: bannedUsers
        });
    } catch (error) {
        console.error("[adminDashboard.getOverview]", error);
        return res.status(500).json({ code: "INTERNAL_ERROR", message: "Failed to load overview" });
    }
};

/**
 * GET /api/dashboard/admin/users?page=1&limit=20&search=&role=&banned=
 * paginated list ของ user (ไม่รวม soft-deleted)
 */
const listUsers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
        const role = typeof req.query.role === "string" ? req.query.role : "";
        const banned = req.query.banned;

        const filter = { is_deleted: { $ne: true } };
        if (search) {
            // escape regex
            const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.$or = [
                { user_name: { $regex: safe, $options: "i" } },
                { user_email: { $regex: safe, $options: "i" } }
            ];
        }
        if (role && ["user-free", "user-pro", "admin"].includes(role)) {
            filter.user_role = role;
        }
        if (banned === "true") filter.is_banned = true;
        if (banned === "false") filter.is_banned = false;

        const [users, total] = await Promise.all([
            User.find(filter)
                .select("-user_password")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments(filter)
        ]);

        return res.status(200).json({
            data: users,
            pagination: {
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("[adminDashboard.listUsers]", error);
        return res.status(500).json({ code: "INTERNAL_ERROR", message: "Failed to load users" });
    }
};

/**
 * GET /api/dashboard/admin/users/:id
 * คืนรายละเอียด user รายเดียว + stats พื้นฐาน
 */
const getUserById = async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({
                code: "VALIDATION_ERROR",
                message: "Invalid user id format"
            });
        }
        const user = await User.findOne({ _id: req.params.id, is_deleted: { $ne: true } })
            .select("-user_password")
            .lean();
        if (!user) {
            return res.status(404).json({ code: "NOT_FOUND", message: "User not found" });
        }

        // Stats เพิ่มเติม
        const [totalAiCalls, totalPayments, recentActivity] = await Promise.all([
            UsageLog.countDocuments({ user_id: user._id }),
            Payment.countDocuments({ user_id: user._id, status: "paid" }),
            ActivityLog.find({ user_id: user._id }).sort({ createdAt: -1 }).limit(10).lean()
        ]);

        return res.status(200).json({
            user,
            stats: {
                total_ai_calls: totalAiCalls,
                total_payments: totalPayments
            },
            recent_activity: recentActivity
        });
    } catch (error) {
        console.error("[adminDashboard.getUserById]", error);
        return res.status(500).json({
            code: "INTERNAL_ERROR",
            message: "Failed to load user",
            debug: process.env.NODE_ENV === "production" ? undefined : error.message
        });
    }
};

/**
 * PATCH /api/dashboard/admin/users/:id
 * Body: { user_role?, is_banned? }
 * เปลี่ยน role หรือ ban/unban
 */
const updateUser = async (req, res) => {
    try {
        const { user_role, is_banned } = req.body;
        const updates = {};

        if (user_role !== undefined) {
            if (!["user-free", "user-pro", "admin"].includes(user_role)) {
                return res.status(400).json({
                    code: "VALIDATION_ERROR",
                    message: "Invalid user_role"
                });
            }
            updates.user_role = user_role;
        }
        if (is_banned !== undefined) {
            if (typeof is_banned !== "boolean") {
                return res.status(400).json({
                    code: "VALIDATION_ERROR",
                    message: "is_banned must be boolean"
                });
            }
            updates.is_banned = is_banned;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                code: "VALIDATION_ERROR",
                message: "Nothing to update"
            });
        }

        const user = await User.findOneAndUpdate(
            { _id: req.params.id, is_deleted: { $ne: true } },
            { $set: updates },
            { new: true }
        ).select("-user_password");

        if (!user) {
            return res.status(404).json({ code: "NOT_FOUND", message: "User not found" });
        }

        // Log activity ถ้ามีการแบน
        if (updates.is_banned === true) {
            logActivity({
                user_id: user._id,
                user_name: user.user_name,
                type: "user_banned",
                metadata: { admin_id: req.user._id }
            });
        }

        return res.status(200).json({
            message: "User updated successfully",
            user
        });
    } catch (error) {
        console.error("[adminDashboard.updateUser]", error);
        return res.status(500).json({ code: "INTERNAL_ERROR", message: "Failed to update user" });
    }
};

/**
 * DELETE /api/dashboard/admin/users/:id
 * Soft delete - ไม่ลบ document จริง แค่ตั้ง is_deleted = true
 */
const deleteUser = async (req, res) => {
    try {
        // ป้องกัน admin ลบตัวเอง
        if (req.user._id.toString() === req.params.id) {
            return res.status(400).json({
                code: "VALIDATION_ERROR",
                message: "Cannot delete your own account"
            });
        }

        const user = await User.findOneAndUpdate(
            { _id: req.params.id, is_deleted: { $ne: true } },
            { $set: { is_deleted: true, is_banned: true } },
            { new: true }
        ).select("-user_password");

        if (!user) {
            return res.status(404).json({ code: "NOT_FOUND", message: "User not found" });
        }

        logActivity({
            user_id: user._id,
            user_name: user.user_name,
            type: "user_deleted",
            metadata: { admin_id: req.user._id }
        });

        return res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("[adminDashboard.deleteUser]", error);
        return res.status(500).json({ code: "INTERNAL_ERROR", message: "Failed to delete user" });
    }
};

/**
 * POST /api/dashboard/admin/users/:id/reset-tokens
 * Reset remaining_tokens ให้ user ตาม role
 */
const resetUserTokens = async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.params.id, is_deleted: { $ne: true } });
        if (!user) {
            return res.status(404).json({ code: "NOT_FOUND", message: "User not found" });
        }

        const tokenLimits = {
            "user-free": parseInt(process.env.TOKEN_LIMIT_USER_FREE) || 4000,
            "user-pro": parseInt(process.env.TOKEN_LIMIT_USER_PRO) || 10000,
            admin: parseInt(process.env.TOKEN_LIMIT_ADMIN) || 50000
        };
        user.remaining_tokens = tokenLimits[user.user_role] || tokenLimits["user-free"];
        await user.save();

        return res.status(200).json({
            message: "Tokens reset successfully",
            remaining_tokens: user.remaining_tokens
        });
    } catch (error) {
        console.error("[adminDashboard.resetUserTokens]", error);
        return res.status(500).json({ code: "INTERNAL_ERROR", message: "Failed to reset tokens" });
    }
};

/**
 * GET /api/dashboard/admin/charts/user-growth?days=30
 * จำนวน user ใหม่ต่อวัน (สำหรับ line chart)
 */
const getUserGrowthChart = async (req, res) => {
    try {
        const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 30));
        const since = daysAgo(days - 1);

        const result = await User.aggregate([
            { $match: { is_deleted: { $ne: true }, createdAt: { $gte: since } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            }
        ]);

        return res.status(200).json({
            days,
            data: fillDateGaps(result, days)
        });
    } catch (error) {
        console.error("[adminDashboard.getUserGrowthChart]", error);
        return res.status(500).json({ code: "INTERNAL_ERROR", message: "Failed to load chart" });
    }
};

/**
 * GET /api/dashboard/admin/charts/ai-usage?days=7
 * จำนวน AI calls ต่อวัน แยกตาม action (grammar_check vs tone_adjust)
 */
const getAiUsageChart = async (req, res) => {
    try {
        const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 7));
        const since = daysAgo(days - 1);

        const result = await UsageLog.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        action: "$action"
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        // แยกผลลัพธ์เป็น 2 series
        const grammarRaw = result
            .filter(r => r._id.action === "grammar_check")
            .map(r => ({ _id: r._id.date, count: r.count }));
        const toneRaw = result
            .filter(r => r._id.action === "tone_adjust")
            .map(r => ({ _id: r._id.date, count: r.count }));

        return res.status(200).json({
            days,
            grammar_check: fillDateGaps(grammarRaw, days),
            tone_adjust: fillDateGaps(toneRaw, days)
        });
    } catch (error) {
        console.error("[adminDashboard.getAiUsageChart]", error);
        return res.status(500).json({ code: "INTERNAL_ERROR", message: "Failed to load chart" });
    }
};

/**
 * GET /api/dashboard/admin/charts/conversion-rate?days=30
 * อัตราการแปลง user-free เป็น user-pro (% ของ user ทั้งหมด)
 */
const getConversionRateChart = async (req, res) => {
    try {
        const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 30));
        const since = daysAgo(days - 1);

        // นับ upgrade events ต่อวัน
        const upgradeRaw = await ActivityLog.aggregate([
            {
                $match: {
                    type: "user_upgraded_pro",
                    createdAt: { $gte: since }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            }
        ]);

        // overall conversion (snapshot ปัจจุบัน)
        const [totalUsers, totalPro] = await Promise.all([
            User.countDocuments({ is_deleted: { $ne: true } }),
            User.countDocuments({ is_deleted: { $ne: true }, user_role: "user-pro" })
        ]);
        const overallRate = totalUsers > 0 ? (totalPro / totalUsers) * 100 : 0;

        return res.status(200).json({
            days,
            upgrades_per_day: fillDateGaps(upgradeRaw, days),
            overall: {
                total_users: totalUsers,
                pro_users: totalPro,
                conversion_rate: Math.round(overallRate * 100) / 100
            }
        });
    } catch (error) {
        console.error("[adminDashboard.getConversionRateChart]", error);
        return res.status(500).json({ code: "INTERNAL_ERROR", message: "Failed to load chart" });
    }
};

/**
 * GET /api/dashboard/admin/activity?limit=20
 * Activity feed ล่าสุด (signup, upgrade, payment, ban, delete, etc.)
 */
const getActivityFeed = async (req, res) => {
    try {
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

        const activities = await ActivityLog.find({})
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return res.status(200).json({ data: activities });
    } catch (error) {
        console.error("[adminDashboard.getActivityFeed]", error);
        return res.status(500).json({ code: "INTERNAL_ERROR", message: "Failed to load activity feed" });
    }
};

module.exports = {
    getOverview,
    listUsers,
    getUserById,
    updateUser,
    deleteUser,
    resetUserTokens,
    getUserGrowthChart,
    getAiUsageChart,
    getConversionRateChart,
    getActivityFeed
};
