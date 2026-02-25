const jwt = require("jsonwebtoken");
const User = require("../models/user.model.js");

const verifyToken = async (req, res, next) => {
    try {
        // Extract token from cookies or Authorization header
        let token = req.cookies.token;
        
        if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        }
        
        if (!token) {
            return res.status(401).json({ message: "No token provided, authorization denied" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Fetch user from database to ensure it exists and populate user info
        const user = await User.findById(decoded.user_id).select("-user_password");
        
        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }
        
        req.user = user;
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Token has expired" });
        }
        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({ message: "Invalid token" });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Middleware to check if user has admin role
const isAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: "Access denied. No user authenticated." });
    }
    
    if (req.user.user_role !== "admin") {
        return res.status(403).json({ message: "Access denied. Admin role required." });
    }
    
    next();
};

// Middleware to check if user has specific role
const hasRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Access denied. No user authenticated." });
        }
        
        if (!roles.includes(req.user.user_role)) {
            return res.status(403).json({ message: `Access denied. Requires one of the following roles: ${roles.join(", ")}.` });
        }
        
        next();
    };
};

module.exports = { verifyToken, isAdmin, hasRole };
