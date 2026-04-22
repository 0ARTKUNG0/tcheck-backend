const express = require("express");
const router = express.Router();
const grammarController = require("../controllers/grammar.controller");
const optionalAuth = require("../middleware/optionalAuth.middleware");
const rateLimitMiddleware = require("../middleware/rateLimit.middleware");

// Grammar check route - allows both guest and authenticated users
// Guest users get limited tokens, authenticated users get more based on their tier
router.post(
    "/check",
    optionalAuth,  // Optional authentication - guests can also use
    rateLimitMiddleware,
    grammarController.checkGrammar
);

module.exports = router;