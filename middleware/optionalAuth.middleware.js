const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const JWT_SECRET = process.env.JWT_SECRET;

// Optional authentication - allows both authenticated and guest users
const optionalAuth = async (req, res, next) => {
    try {
        // Try to get token from cookies or Authorization header
        const token = req.cookies.token || req.headers.authorization?.replace("Bearer ", "");

        if (!token) {
            // No token - user is a guest
            req.user = null;
            req.userRole = "guest";
            return next();
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Fetch user from database
        const user = await User.findById(decoded.user_id).select("-user_password");

        if (!user) {
            // Token is valid but user not found - treat as guest
            req.user = null;
            req.userRole = "guest";
            return next();
        }

        // Authenticated user
        req.user = user;
        req.userRole = user.user_role;
        next();

    } catch (error) {
        // Token is invalid or expired - treat as guest
        req.user = null;
        req.userRole = "guest";
        next();
    }
};

module.exports = optionalAuth;