const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controllers");
const { verifyToken, isAdmin, hasRole } = require("../middleware/auth.middleware");

//POST /api/user/signup - สมัครสมาชิกผู้ใช้ใหม่
router.post("/signup", userController.SignUp);
//POST /api/user/signin - ล็อกอิน
router.post("/signin", userController.SignIn);
//POST /api/user/signout - ล็อกเอาออก
router.post("/signout", userController.signOut);
//POST /api/user/update-username - แก้ไขชื่อผู้ใช้
router.post("/update-username", verifyToken, userController.updateUsername);

// Protected routes
//GET /api/user/profile - ดูโปรไฟล์ผู้ใช้    
router.get("/profile", verifyToken, userController.getUserProfile);

// Example routes with role-based access control
//GET /api/user/admin/users - ดูรายการผู้ใช้ทั้งหมด (เฉพาะแอดมิน)
router.get("/admin/users", verifyToken, isAdmin, userController.getAllUsers);

// Role-restricted route
//PUT /api/user/admin/update-role - แก้ไขบทบาท (เฉพาะแอดมิน)
router.put("/admin/update-role", verifyToken, hasRole(["admin"]), userController.updateUserRole);

module.exports = router;