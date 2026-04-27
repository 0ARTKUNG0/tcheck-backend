/**
 * User Dashboard Controller
 * รวม endpoint สำหรับหน้า User Dashboard (ของผู้ใช้แต่ละคน)
 *
 * ทุก endpoint ต้อง verifyToken (จัดการที่ router)
 */

const User = require("../models/user.model.js");
const UsageLog = require("../models/usageLog.model.js");
const { daysAgo, fillDateGaps } = require("../utils/dashboard.util.js");

/**
 * GET /api/dashboard/user/stats
 * คืนข้อมูลทั้งหมดที่หน้า dashboard ของผู้ใช้ต้องใช้
 *  - 4 cards (total_checks, total_corrections, tokens_used, account_type)
 *  - Token quota (used/limit/percentage + quota table by role)
 *  - 7-day usage chart + summary (total, avg, max)
 */
const getUserStats = async (req, res) => {
    try {
        const userId = req.user._id;

        // Token limits (ใช้ค่าเดียวกับ grammar/tone controller)
        const tokenLimits = {
            guest: parseInt(process.env.TOKEN_LIMIT_GUEST) || 1000,
            "user-free": parseInt(process.env.TOKEN_LIMIT_USER_FREE) || 4000,
            "user-pro": parseInt(process.env.TOKEN_LIMIT_USER_PRO) || 10000,
            admin: parseInt(process.env.TOKEN_LIMIT_ADMIN) || 50000
        };

        // โหลด user fresh จาก DB เพื่อให้ remaining_tokens เป็นค่าล่าสุด
        const user = await User.findById(userId).select("user_role remaining_tokens user_name user_email");
        if (!user) {
            return res.status(404).json({ code: "NOT_FOUND", message: "User not found" });
        }

        const userLimit = tokenLimits[user.user_role] || tokenLimits["user-free"];
        const tokensUsed = Math.max(0, userLimit - (user.remaining_tokens || 0));
        const usagePercent = userLimit > 0 ? Math.round((tokensUsed / userLimit) * 1000) / 10 : 0;

        // 7-day window
        const since7Days = daysAgo(6); // วันนี้ + 6 วันก่อนหน้า = 7 วัน

        // รัน aggregations พร้อมกันเพื่อความเร็ว
        const [totalChecksAgg, dailyUsageAgg] = await Promise.all([
            // Total checks + total corrections (all-time)
            UsageLog.aggregate([
                { $match: { user_id: userId } },
                {
                    $group: {
                        _id: null,
                        total_checks: { $sum: 1 },
                        total_corrections: { $sum: { $ifNull: ["$issues_found", 0] } },
                        grammar_checks: {
                            $sum: { $cond: [{ $eq: ["$action", "grammar_check"] }, 1, 0] }
                        },
                        tone_adjusts: {
                            $sum: { $cond: [{ $eq: ["$action", "tone_adjust"] }, 1, 0] }
                        }
                    }
                }
            ]),
            // 7-day daily usage (count ต่อวัน)
            UsageLog.aggregate([
                { $match: { user_id: userId, createdAt: { $gte: since7Days } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        const totals = totalChecksAgg[0] || {
            total_checks: 0,
            total_corrections: 0,
            grammar_checks: 0,
            tone_adjusts: 0
        };

        // Fill gaps + คำนวณ summary
        const last7Days = fillDateGaps(dailyUsageAgg, 7);
        const total7 = last7Days.reduce((sum, d) => sum + d.value, 0);
        const max7 = last7Days.reduce((m, d) => Math.max(m, d.value), 0);
        const avg7 = Math.round((total7 / 7) * 10) / 10;

        return res.status(200).json({
            // Card 1
            total_checks: totals.total_checks,
            // Card 2
            total_corrections: totals.total_corrections,
            // Card 3 + 4 (และส่วน Token Quota)
            quota: {
                used: tokensUsed,
                limit: userLimit,
                remaining: user.remaining_tokens || 0,
                percent_used: usagePercent,
                user_role: user.user_role,
                // ตารางโควต้าตามประเภทสมาชิก (สำหรับ UI ตารางด้านล่าง)
                limits_by_role: {
                    guest: tokenLimits.guest,
                    "user-free": tokenLimits["user-free"],
                    "user-pro": tokenLimits["user-pro"],
                    admin: tokenLimits.admin
                }
            },
            // กราฟ 7 วัน
            last_7_days: last7Days,
            summary_7_days: {
                total: total7,
                avg_per_day: avg7,
                max_per_day: max7
            },
            // เพิ่มเติม - แยก grammar vs tone (ถ้า frontend อยากใช้)
            breakdown: {
                grammar_checks: totals.grammar_checks,
                tone_adjusts: totals.tone_adjusts
            }
        });
    } catch (error) {
        console.error("[userDashboard.getUserStats]", error);
        return res.status(500).json({
            code: "INTERNAL_ERROR",
            message: "Failed to load user stats",
            debug: process.env.NODE_ENV === "production" ? undefined : error.message
        });
    }
};

module.exports = {
    getUserStats
};
