const express = require("express");
const router = express.Router();
const documentController = require("../controllers/document.controllers");
const { verifyToken, hasRole } = require("../middleware/auth.middleware");

// All routes require authentication and user role (user-free, user-pro, or admin)
const requireUser = [verifyToken, hasRole(["user-free", "user-pro", "admin"])];

//Post /api/docs/ - สร้างเอกสาร
router.post("/", requireUser, documentController.createDocument);
//Get /api/docs/ - ดึงเอกสาร
router.get("/", requireUser, documentController.getDocuments);
//Get /api/docs/:id - ดึงเอกสาร
router.get("/:id", requireUser, documentController.getDocument);
//Patch /api/docs/:id - แก้ไขเอกสาร
router.patch("/:id", requireUser, documentController.updateDocument);
//Delete /api/docs/:id - ลบเอกสาร
router.delete("/:id", requireUser, documentController.deleteDocument);

module.exports = router;
