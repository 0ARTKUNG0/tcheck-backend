const express = require("express");
const router = express.Router();
const toneController = require("../controllers/tone.controller");
const optionalAuth = require("../middleware/optionalAuth.middleware");
const rateLimitMiddleware = require("../middleware/rateLimit.middleware");

// Tone adjustment route - allows both guest and authenticated users
// Guest users get limited tokens, authenticated users get more based on their tier
router.post(
    "/adjust",
    optionalAuth,         // Optional authentication - guests can also use
    rateLimitMiddleware,  // Rate limiting based on role
    toneController.adjustTone
);

module.exports = router;
