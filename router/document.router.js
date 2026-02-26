const express = require("express");
const router = express.Router();
const documentController = require("../controllers/document.controllers");
const { verifyToken, hasRole } = require("../middleware/auth.middleware");

// All routes require authentication and user role (user-free, user-pro, or admin)
const requireUser = [verifyToken, hasRole(["user-free", "user-pro", "admin"])];

router.post("/", requireUser, documentController.createDocument);
router.get("/", requireUser, documentController.getDocuments);
router.get("/:id", requireUser, documentController.getDocument);
router.patch("/:id", requireUser, documentController.updateDocument);
router.delete("/:id", requireUser, documentController.deleteDocument);

module.exports = router;
