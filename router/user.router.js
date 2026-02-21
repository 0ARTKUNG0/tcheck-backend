const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controllers");
const { verifyToken } = require("../middleware/auth.middleware");

router.post("/signup", userController.SignUp);
router.post("/signin", userController.SignIn);
router.post("/signout", userController.signOut);
router.post("/update-username", verifyToken, userController.updateUsername);

module.exports = router;