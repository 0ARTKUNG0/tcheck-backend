const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/subscription.controller");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

// GET /api/subscription/status - ดูสถานะ subscription ของตัวเอง (ทุก role ที่ login)
router.get("/status", verifyToken, subscriptionController.getSubscriptionStatus);

// POST /api/subscription/grant-pro - อัปเกรด user เป็น Pro (admin เท่านั้น)
// ใช้สำหรับ: manual upgrade, refund compensation, testing
// Body: { user_id: string, days?: number (default 30) }
router.post("/grant-pro", verifyToken, isAdmin, subscriptionController.grantProManual);

module.exports = router;
