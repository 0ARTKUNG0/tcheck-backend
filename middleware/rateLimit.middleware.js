const requestCounts = new Map();
const requestHistory = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requestCounts.entries()) {
        if (now - data.resetTime > 60000) {
            requestCounts.delete(key);
        }
    }
    for (const [key, times] of requestHistory.entries()) {
        const filtered = times.filter(time => now - time < 60000);
        if (filtered.length === 0) {
            requestHistory.delete(key);
        } else {
            requestHistory.set(key, filtered);
        }
    }
}, 60000);

const rateLimitMiddleware = (req, res, next) => {
    const userRole = req.userRole || "guest";

    const minuteLimits = {
        guest: parseInt(process.env.AI_RATE_LIMIT_GUEST) || 5,
        "user-free": parseInt(process.env.AI_RATE_LIMIT_FREE) || 10,
        "user-pro": parseInt(process.env.AI_RATE_LIMIT_PRO) || 30,
        admin: parseInt(process.env.AI_RATE_LIMIT_ADMIN) || 100
    };

    const secondLimits = {
        guest: 1,
        "user-free": 2,
        "user-pro": 4,
        admin: 5
    };

    const minuteLimit = minuteLimits[userRole] || minuteLimits.guest;
    const secondLimit = secondLimits[userRole] || secondLimits.guest;
    const windowMs = parseInt(process.env.AI_RATE_WINDOW_MS) || 60000;
    const identifier = req.user ? req.user._id.toString() : req.ip;
    const now = Date.now();

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

    let rateLimitData = requestCounts.get(identifier);
    if (!rateLimitData || now > rateLimitData.resetTime) {
        rateLimitData = {
            count: 1,
            resetTime: now + windowMs
        };
        requestCounts.set(identifier, rateLimitData);
    } else {
        rateLimitData.count++;
    }

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

    history.push(now);
    requestHistory.set(identifier, history.filter(time => now - time < 60000));

    res.setHeader('X-RateLimit-Limit-Minute', minuteLimit);
    res.setHeader('X-RateLimit-Remaining-Minute', minuteLimit - rateLimitData.count);
    res.setHeader('X-RateLimit-Limit-Second', secondLimit);
    res.setHeader('X-RateLimit-Reset', new Date(rateLimitData.resetTime).toISOString());

    req.rateLimitInfo = {
        minuteLimit: minuteLimit,
        minuteRemaining: minuteLimit - rateLimitData.count,
        secondLimit: secondLimit,
        resetTime: rateLimitData.resetTime
    };

    next();
};

module.exports = rateLimitMiddleware;