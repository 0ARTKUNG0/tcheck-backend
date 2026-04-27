const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/userDashboard.controller");
const { verifyToken } = require("../middleware/auth.middleware");

// ทุก route ต้อง verifyToken (เป็น dashboard ของตัวเอง)
router.use(verifyToken);

// GET /api/dashboard/user/stats - ข้อมูลทั้งหมดสำหรับหน้า user dashboard
router.get("/stats", ctrl.getUserStats);

module.exports = router;
