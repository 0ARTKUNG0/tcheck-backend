const { getAIProvider } = require('../services/ai/provider');
const User = require('../models/user.model');
const crypto = require('crypto');
const { chunkThaiText } = require('../utils/textSegmenter.util');
const { logUsage, logActivity } = require('../utils/logger.util.js');

const PAGE_BREAK_MARKER = '[---PAGE_BREAK---]';

function generateRequestId() {
    return crypto.randomBytes(16).toString('hex');
}

const adjustTone = async (req, res) => {
    const requestId = generateRequestId();
    console.log(`[${requestId}] Tone adjustment request initiated`);

    try {
        const { text, tone_type } = req.body;

        // --- Validation ---
        if (!text) {
            return res.status(400).json({
                code: "VALIDATION_ERROR",
                message: "Text is required"
            });
        }
        if (typeof text !== 'string') {
            return res.status(400).json({
                code: "VALIDATION_ERROR",
                message: "Text must be a string"
            });
        }

        const validTones = ['formal', 'casual'];
        if (!tone_type || !validTones.includes(tone_type)) {
            return res.status(400).json({
                code: "VALIDATION_ERROR",
                message: `tone_type is required and must be one of: ${validTones.join(', ')}`
            });
        }

        const userRole = req.userRole || "guest";
        const userId = req.user ? req.user._id.toString() : "guest";
        console.log(`[${requestId}] User role: ${userRole}, User ID: ${userId}`);

        // --- Token limit check (same logic as grammar) ---
        const tokenLimits = {
            guest: parseInt(process.env.TOKEN_LIMIT_GUEST) || 1000,
            "user-free": parseInt(process.env.TOKEN_LIMIT_USER_FREE) || 4000,
            "user-pro": parseInt(process.env.TOKEN_LIMIT_USER_PRO) || 10000,
            admin: parseInt(process.env.TOKEN_LIMIT_ADMIN) || 50000
        };
        const userTokenLimit = tokenLimits[userRole] || tokenLimits.guest;

        if (text.length > userTokenLimit) {
            return res.status(400).json({
                code: "TOKEN_LIMIT_EXCEEDED",
                message: `Text exceeds your token limit of ${userTokenLimit} characters. Your role (${userRole}) allows up to ${userTokenLimit} characters per request.`,
                currentLength: text.length,
                allowedLength: userTokenLimit,
                userRole: userRole
            });
        }

        const maxLength = parseInt(process.env.AI_MAX_TEXT_LENGTH) || 50000;
        if (text.length > maxLength) {
            return res.status(400).json({
                code: "VALIDATION_ERROR",
                message: `Text exceeds absolute maximum length of ${maxLength} characters`
            });
        }

        // --- Token balance check for authenticated users ---
        let user = null;
        if (req.user && req.user._id) {
            user = await User.findById(req.user._id);
            if (!user) {
                return res.status(404).json({
                    code: "USER_NOT_FOUND",
                    message: "User not found",
                    requestId: requestId
                });
            }

            if (user.remaining_tokens < text.length) {
                console.log(`[${requestId}] Insufficient tokens. User has ${user.remaining_tokens}, needs ${text.length}`);
                logActivity({
                    user_id: user._id,
                    user_name: user.user_name,
                    type: "token_limit_hit",
                    metadata: { remaining: user.remaining_tokens, required: text.length, source: "tone_adjust" }
                });
                return res.status(403).json({
                    code: "INSUFFICIENT_TOKENS",
                    message: "Insufficient tokens. Please upgrade your plan.",
                    remaining_tokens: user.remaining_tokens,
                    required_tokens: text.length,
                    requestId: requestId
                });
            }
            console.log(`[${requestId}] Token check passed. User has ${user.remaining_tokens} tokens, using ${text.length}`);
        }

        // --- Split by [---PAGE_BREAK---], process each page separately ---
        const pages = text.split(PAGE_BREAK_MARKER);
        console.log(`[${requestId}] Text split into ${pages.length} page(s) by PAGE_BREAK marker`);

        const provider = getAIProvider();
        console.log(`[${requestId}] Using AI provider: ${process.env.AI_PROVIDER || 'typhoon'}`);

        const adjustedPages = [];

        for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            const page = pages[pageIndex];

            // Skip empty pages (preserve them as empty strings)
            if (page.trim().length === 0) {
                adjustedPages.push(page);
                continue;
            }

            // Further chunk long pages using textSegmenter to respect AI token limits
            const chunks = chunkThaiText(page, 800);
            console.log(`[${requestId}] Page ${pageIndex + 1}: ${chunks.length} chunk(s) (${page.length} chars)`);

            const chunkPromises = chunks.map((chunk, chunkIndex) => {
                console.log(`[${requestId}] Processing page ${pageIndex + 1}, chunk ${chunkIndex + 1}/${chunks.length}`);
                return provider.adjustTone(chunk, tone_type);
            });

            const adjustedChunks = await Promise.all(chunkPromises);
            adjustedPages.push(adjustedChunks.join(''));
        }

        // Reassemble with the original PAGE_BREAK markers
        const adjustedText = adjustedPages.join(PAGE_BREAK_MARKER);

        // --- Deduct tokens after successful AI response ---
        if (user) {
            user.remaining_tokens -= text.length;
            await user.save();
            console.log(`[${requestId}] Deducted ${text.length} tokens. New balance: ${user.remaining_tokens}`);
            logUsage({
                user_id: user._id,
                action: "tone_adjust",
                tokens_used: text.length,
                text_length: text.length,
                tone_type: tone_type
            });
        }

        console.log(`[${requestId}] Tone adjustment completed. Original: ${text.length} chars, Adjusted: ${adjustedText.length} chars`);

        return res.status(200).json({
            adjusted_text: adjustedText,
            metadata: {
                original_length: text.length,
                adjusted_length: adjustedText.length,
                tone_type: tone_type,
                pages_processed: pages.length,
                provider: process.env.AI_PROVIDER || 'typhoon',
                requestId: requestId,
                userRole: userRole,
                tokenUsed: text.length,
                tokenRemaining: user ? user.remaining_tokens : null,
                rateLimits: {
                    requestsPerMinute: req.rateLimitInfo?.minuteLimit || 0,
                    requestsRemainingThisMinute: req.rateLimitInfo?.minuteRemaining || 0,
                    requestsPerSecond: req.rateLimitInfo?.secondLimit || 0,
                    resetTime: req.rateLimitInfo?.resetTime ? new Date(req.rateLimitInfo.resetTime).toISOString() : null
                }
            }
        });

    } catch (error) {
        console.error(`[${requestId}] Error in tone adjustment:`, error.message);

        if (error.message === "AI_TIMEOUT") {
            return res.status(504).json({
                code: "AI_TIMEOUT",
                message: "AI service took too long to respond",
                requestId: requestId
            });
        }
        if (error.message === "AI_RATE_LIMIT") {
            return res.status(429).json({
                code: "AI_RATE_LIMIT",
                message: "ระบบ AI มีผู้ใช้งานพร้อมกันจำนวนมาก โปรดรอสักครู่แล้วลองใหม่อีกครั้ง",
                requestId: requestId
            });
        }
        if (error.message === "AI_UPSTREAM_ERROR") {
            return res.status(502).json({
                code: "AI_UPSTREAM_ERROR",
                message: "AI service is currently unavailable",
                requestId: requestId
            });
        }

        return res.status(500).json({
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred",
            requestId: requestId
        });
    }
};

module.exports = {
    adjustTone
};
