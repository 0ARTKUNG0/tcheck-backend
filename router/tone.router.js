const express = require("express");
const router = express.Router();
const toneController = require("../controllers/tone.controller");
const { verifyToken, hasRole } = require("../middleware/auth.middleware");
const rateLimitMiddleware = require("../middleware/rateLimit.middleware");

// Tone adjustment route - Pro users and Admins only
// Guest and Free users cannot access this feature (premium feature)
router.post(
    "/adjust",
    verifyToken,                          // Must be logged in
    hasRole(["user-pro", "admin"]),       // Pro or Admin only
    rateLimitMiddleware,                  // Rate limiting based on role
    toneController.adjustTone
);

module.exports = router;
