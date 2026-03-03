const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const JWT_SECRET = process.env.JWT_SECRET;

const optionalAuth = async (req, res, next) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.replace("Bearer ", "");

        if (!token) {
            req.user = null;
            req.userRole = "guest";
            return next();
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.user_id).select("-user_password");

        if (!user) {
            req.user = null;
            req.userRole = "guest";
            return next();
        }

        req.user = user;
        req.userRole = user.user_role;
        next();

    } catch (error) {
        req.user = null;
        req.userRole = "guest";
        next();
    }
};

module.exports = optionalAuth;