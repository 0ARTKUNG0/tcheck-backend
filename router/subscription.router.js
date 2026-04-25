const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/subscription.controller");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

// GET /api/subscription/status - Check own subscription status
router.get("/status", verifyToken, subscriptionController.getSubscriptionStatus);

// POST /api/subscription/grant-pro - Admin only: grant Pro access to a user
router.post("/grant-pro", verifyToken, isAdmin, subscriptionController.grantPro);

module.exports = router;
