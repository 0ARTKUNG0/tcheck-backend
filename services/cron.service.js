const cron = require('node-cron');
const User = require('../models/user.model');

/**
 * Daily Token Reset Service
 *
 * Resets all users' remaining_tokens to their role-based maximum capacity
 * Runs every midnight (00:00) Thailand Time (Asia/Bangkok timezone)
 */

function initializeCronJobs() {
    // Daily token reset at midnight Thailand Time
    const resetTokensJob = cron.schedule('0 0 * * *', async () => {
        const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });
        console.log(`[CRON] Starting daily token reset job at ${now} (Thailand Time)`);

        try {
            // Get token limits from environment variables
            const tokenLimits = {
                'user-free': parseInt(process.env.TOKEN_LIMIT_USER_FREE) || 4000,
                'user-pro': parseInt(process.env.TOKEN_LIMIT_USER_PRO) || 10000,
                'admin': parseInt(process.env.TOKEN_LIMIT_ADMIN) || 50000
            };

            // Reset tokens for each role separately
            const results = {};

            for (const [role, limit] of Object.entries(tokenLimits)) {
                const result = await User.updateMany(
                    { user_role: role },
                    { $set: { remaining_tokens: limit } }
                );
                results[role] = result.modifiedCount;
                console.log(`[CRON] Reset ${result.modifiedCount} ${role} users to ${limit} tokens`);
            }

            const totalReset = Object.values(results).reduce((sum, count) => sum + count, 0);
            console.log(`[CRON] Daily token reset completed. Total users reset: ${totalReset}`);
            console.log(`[CRON] Breakdown: user-free: ${results['user-free']}, user-pro: ${results['user-pro']}, admin: ${results['admin']}`);

        } catch (error) {
            console.error('[CRON] Error during daily token reset:', error.message);
            console.error('[CRON] Stack trace:', error.stack);
        }
    }, {
        timezone: 'Asia/Bangkok'
    });

    console.log('✅ Cron job initialized: Daily token reset at midnight (Asia/Bangkok timezone)');

    return {
        resetTokensJob
    };
}

module.exports = { initializeCronJobs };
