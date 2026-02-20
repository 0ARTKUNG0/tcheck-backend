const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controllers");

router.post("/signup", userController.SignUp);
router.post("/signin", userController.SignIn);
router.post("/signout", userController.signOut);
router.post("/update-username", userController.updateUsername);

module.exports = router;