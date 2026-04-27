const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/adminDashboard.controller");
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");

// ทุก route ต้อง verifyToken + isAdmin
router.use(verifyToken, isAdmin);

// Overview cards
router.get("/overview", ctrl.getOverview);

// User management
router.get("/users", ctrl.listUsers);
router.get("/users/:id", ctrl.getUserById);
router.patch("/users/:id", ctrl.updateUser);
router.delete("/users/:id", ctrl.deleteUser);
router.post("/users/:id/reset-tokens", ctrl.resetUserTokens);

// Charts
router.get("/charts/user-growth", ctrl.getUserGrowthChart);
router.get("/charts/ai-usage", ctrl.getAiUsageChart);
router.get("/charts/conversion-rate", ctrl.getConversionRateChart);

// Activity feed
router.get("/activity", ctrl.getActivityFeed);

module.exports = router;
