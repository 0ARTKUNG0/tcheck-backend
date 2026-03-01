// Simple in-memory rate limiting (consider using Redis for production)
const requestCounts = new Map();
const requestHistory = new Map(); // Track request times for per-second limiting

// Helper function to clean up old entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requestCounts.entries()) {
        if (now - data.resetTime > 60000) { // Clean entries older than 1 minute
            requestCounts.delete(key);
        }
    }
    // Clean up request history older than 1 minute
    for (const [key, times] of requestHistory.entries()) {
        const filtered = times.filter(time => now - time < 60000);
        if (filtered.length === 0) {
            requestHistory.delete(key);
        } else {
            requestHistory.set(key, filtered);
        }
    }
}, 60000); // Run cleanup every minute

const rateLimitMiddleware = (req, res, next) => {
    // Get user role (set by optionalAuth middleware)
    const userRole = req.userRole || "guest";

    // Get rate limit configuration based on user role (per minute)
    const minuteLimits = {
        guest: parseInt(process.env.AI_RATE_LIMIT_GUEST) || 5,
        "user-free": parseInt(process.env.AI_RATE_LIMIT_FREE) || 10,
        "user-pro": parseInt(process.env.AI_RATE_LIMIT_PRO) || 30,
        admin: parseInt(process.env.AI_RATE_LIMIT_ADMIN) || 100
    };

    // Per-second limits (for Typhoon API compatibility)
    const secondLimits = {
        guest: 1,  // 1 request per second for guests
        "user-free": 2,  // 2 requests per second for free users
        "user-pro": 4,  // 4 requests per second for pro users
        admin: 5  // 5 requests per second for admin (Typhoon's max)
    };

    const minuteLimit = minuteLimits[userRole] || minuteLimits.guest;
    const secondLimit = secondLimits[userRole] || secondLimits.guest;
    const windowMs = parseInt(process.env.AI_RATE_WINDOW_MS) || 60000; // Default: 1 minute

    // Use user ID if authenticated, otherwise use IP address
    const identifier = req.user ? req.user._id.toString() : req.ip;
    const now = Date.now();

    // Check per-second rate limit
    let history = requestHistory.get(identifier) || [];
    const oneSecondAgo = now - 1000;
    const recentRequests = history.filter(time => time > oneSecondAgo);

    if (recentRequests.length >= secondLimit) {
        return res.status(429).json({
            error: "RATE_LIMITED_PER_SECOND",
            message: `Too many requests per second. Maximum ${secondLimit} requests/second allowed for ${userRole} users.`,
            retryAfter: 1
        });
    }

    // Check per-minute rate limit
    let rateLimitData = requestCounts.get(identifier);

    if (!rateLimitData || now > rateLimitData.resetTime) {
        // Create new window
        rateLimitData = {
            count: 1,
            resetTime: now + windowMs
        };
        requestCounts.set(identifier, rateLimitData);
    } else {
        // Increment count in current window
        rateLimitData.count++;
    }

    // Check if minute limit exceeded
    if (rateLimitData.count > minuteLimit) {
        const retryAfter = Math.ceil((rateLimitData.resetTime - now) / 1000);

        return res.status(429).json({
            error: "RATE_LIMITED_PER_MINUTE",
            message: `Too many requests per minute. Maximum ${minuteLimit} requests/minute allowed for ${userRole} users. Please try again in ${retryAfter} seconds.`,
            retryAfter: retryAfter,
            limit: minuteLimit,
            remaining: 0,
            reset: new Date(rateLimitData.resetTime).toISOString()
        });
    }

    // Update request history
    history.push(now);
    requestHistory.set(identifier, history.filter(time => now - time < 60000)); // Keep only last minute

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit-Minute', minuteLimit);
    res.setHeader('X-RateLimit-Remaining-Minute', minuteLimit - rateLimitData.count);
    res.setHeader('X-RateLimit-Limit-Second', secondLimit);
    res.setHeader('X-RateLimit-Reset', new Date(rateLimitData.resetTime).toISOString());

    // Store rate limit info in request for controller to use
    req.rateLimitInfo = {
        minuteLimit: minuteLimit,
        minuteRemaining: minuteLimit - rateLimitData.count,
        secondLimit: secondLimit,
        resetTime: rateLimitData.resetTime
    };

    next();
};

module.exports = rateLimitMiddleware;