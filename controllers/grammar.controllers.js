const { getAIProvider } = require('../services/ai/provider');
const crypto = require('crypto');

function generateRequestId() {
    return crypto.randomBytes(16).toString('hex');
}

const checkGrammar = async (req, res) => {
    const requestId = generateRequestId();
    console.log(`[${requestId}] Grammar check request initiated`);
    try {
        const { text, mode } = req.body;
        if (!text) {
            return res.status(400).json({
                error: "VALIDATION_ERROR",
                message: "Text is required"
            });
        }
        if (typeof text !== 'string') {
            return res.status(400).json({
                error: "VALIDATION_ERROR",
                message: "Text must be a string"
            });
        }

        const userRole = req.userRole || "guest";
        const userId = req.user ? req.user._id.toString() : "guest";
        console.log(`[${requestId}] User role: ${userRole}, User ID: ${userId}`);

        const tokenLimits = {
            guest: parseInt(process.env.TOKEN_LIMIT_GUEST) || 1000,
            "user-free": parseInt(process.env.TOKEN_LIMIT_USER_FREE) || 4000,
            "user-pro": parseInt(process.env.TOKEN_LIMIT_USER_PRO) || 10000,
            admin: parseInt(process.env.TOKEN_LIMIT_ADMIN) || 50000
        };
        const userTokenLimit = tokenLimits[userRole] || tokenLimits.guest;

        if (text.length > userTokenLimit) {
            return res.status(400).json({
                error: "TOKEN_LIMIT_EXCEEDED",
                message: `Text exceeds your token limit of ${userTokenLimit} characters. Your role (${userRole}) allows up to ${userTokenLimit} characters per request.`,
                currentLength: text.length,
                allowedLength: userTokenLimit,
                userRole: userRole
            });
        }

        const maxLength = parseInt(process.env.AI_MAX_TEXT_LENGTH) || 50000;
        if (text.length > maxLength) {
            return res.status(400).json({
                error: "VALIDATION_ERROR",
                message: `Text exceeds absolute maximum length of ${maxLength} characters`
            });
        }

        const validModes = ['strict', 'normal', 'casual'];
        const checkMode = mode || 'normal';
        if (!validModes.includes(checkMode)) {
            return res.status(400).json({
                error: "VALIDATION_ERROR",
                message: `Invalid mode. Must be one of: ${validModes.join(', ')}`
            });
        }

        console.log(`[${requestId}] Processing text (${text.length} chars) with mode: ${checkMode}`);

        const provider = getAIProvider();
        console.log(`[${requestId}] Using AI provider: ${process.env.AI_PROVIDER || 'typhoon'}`);

        const issues = await provider.checkGrammar(text, checkMode);
        console.log(`[${requestId}] Grammar check completed. Found ${issues.length} issues`);

        return res.status(200).json({
            issues: issues,
            metadata: {
                text_length: text.length,
                issues_found: issues.length,
                mode: checkMode,
                provider: process.env.AI_PROVIDER || 'typhoon',
                requestId: requestId,
                userRole: userRole,
                tokenLimit: userTokenLimit,
                tokenUsed: text.length,
                tokenRemaining: userTokenLimit - text.length,
                rateLimits: {
                    requestsPerMinute: req.rateLimitInfo?.minuteLimit || 0,
                    requestsRemainingThisMinute: req.rateLimitInfo?.minuteRemaining || 0,
                    requestsPerSecond: req.rateLimitInfo?.secondLimit || 0,
                    resetTime: req.rateLimitInfo?.resetTime ? new Date(req.rateLimitInfo.resetTime).toISOString() : null
                }
            }
        });

    } catch (error) {
        console.error(`[${requestId}] Error in grammar check:`, error.message);

        if (error.message === "AI_TIMEOUT") {
            return res.status(504).json({
                error: "AI_TIMEOUT",
                message: "AI service took too long to respond",
                requestId: requestId
            });
        }
        if (error.message === "AI_UPSTREAM_ERROR") {
            return res.status(502).json({
                error: "AI_UPSTREAM_ERROR",
                message: "AI service is currently unavailable",
                requestId: requestId
            });
        }
        if (error.message === "PARSE_ERROR") {
            return res.status(502).json({
                error: "PARSE_ERROR",
                message: "Failed to parse AI response",
                requestId: requestId
            });
        }

        return res.status(500).json({
            error: "INTERNAL_ERROR",
            message: "An unexpected error occurred",
            requestId: requestId
        });
    }
};

module.exports = {
    checkGrammar
};