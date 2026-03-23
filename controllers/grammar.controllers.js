const { getAIProvider } = require('../services/ai/provider');
const User = require('../models/user.model');
const crypto = require('crypto');
const { chunkThaiText } = require('../utils/textSegmenter.util');

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

        const validModes = ['strict', 'normal', 'casual'];
        const checkMode = mode || 'normal';
        if (!validModes.includes(checkMode)) {
            return res.status(400).json({
                code: "VALIDATION_ERROR",
                message: `Invalid mode. Must be one of: ${validModes.join(', ')}`
            });
        }

        console.log(`[${requestId}] Processing text (${text.length} chars) with mode: ${checkMode}`);

        // Check and deduct tokens for authenticated users
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

            // Check if user has enough tokens
            if (user.remaining_tokens < text.length) {
                console.log(`[${requestId}] Insufficient tokens. User has ${user.remaining_tokens}, needs ${text.length}`);
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

        const provider = getAIProvider();
        console.log(`[${requestId}] Using AI provider: ${process.env.AI_PROVIDER || 'typhoon'}`);

        // แบ่งข้อความเป็นชิ้นเล็กๆ เพื่อประมวลผลแบบขนาน (Chunk text for parallel processing)
        const chunks = chunkThaiText(text, 400);
        console.log(`[${requestId}] Text split into ${chunks.length} chunks for parallel processing`);

        // ประมวลผลทุก chunk พร้อมกันด้วย Promise.all (Process all chunks in parallel)
        const chunkPromises = chunks.map((chunk, index) => {
            console.log(`[${requestId}] Processing chunk ${index + 1}/${chunks.length} (${chunk.length} chars)`);
            return provider.checkGrammar(chunk, checkMode);
        });

        const chunkResults = await Promise.all(chunkPromises);
        console.log(`[${requestId}] All chunks processed. Merging results...`);

        // รวมผลลัพธ์จากทุก chunk และปรับ offset ให้ตรงกับข้อความต้นฉบับ
        // (Merge results from all chunks and adjust offsets to match original text)
        let currentOffset = 0;
        const allIssues = [];

        for (let i = 0; i < chunkResults.length; i++) {
            const chunkResult = chunkResults[i];
            const chunkIssues = Array.isArray(chunkResult) ? chunkResult : (chunkResult?.issues || []);

            // คำนวณ offset ของ chunk นี้ (Calculate offset for this chunk)
            // offset = ความยาวรวมของ chunks ทั้งหมดก่อนหน้านี้
            if (i > 0) {
                currentOffset += chunks[i - 1].length;
            }

            // ปรับ start และ end index ของแต่ละ issue โดยบวก currentOffset
            // (Adjust start and end index of each issue by adding currentOffset)
            const adjustedIssues = chunkIssues.map(issue => ({
                ...issue,
                start: issue.start + currentOffset,
                end: issue.end + currentOffset
            }));

            allIssues.push(...adjustedIssues);
        }

        console.log(`[${requestId}] Grammar check completed. Found ${allIssues.length} issues total`);
        const issues = allIssues;

        // Deduct tokens for authenticated users after successful AI response
        if (user) {
            user.remaining_tokens -= text.length;
            await user.save();
            console.log(`[${requestId}] Deducted ${text.length} tokens. New balance: ${user.remaining_tokens}`);
        }

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
        console.error(`[${requestId}] Error in grammar check:`, error.message);

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
                message: "ระบบ AI มีผู้ใช้งานพร้อมกันจำนวนมาก โปรดรอสักครู่แล้วกดตรวจสอบใหม่อีกครั้ง",
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
        if (error.message === "PARSE_ERROR") {
            return res.status(502).json({
                code: "PARSE_ERROR",
                message: "Failed to parse AI response",
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
    checkGrammar
};