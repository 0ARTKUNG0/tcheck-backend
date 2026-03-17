const express = require("express");
const router = express.Router();
const promptpayController = require("../controllers/promptpay.controller");
const { verifyToken } = require("../middleware/auth.middleware");

// All PromptPay routes require authentication
router.use(verifyToken);

// POST /api/payment/promptpay/create - Create new PromptPay payment with QR code
router.post("/create", promptpayController.createPromptPayPayment);

// GET /api/payment/promptpay/status/:id - Check PromptPay status (for frontend compatibility)
router.get("/status/:id", promptpayController.checkPromptPayStatus);

// GET /api/payment/promptpay/history - Get user's PromptPay payment history
router.get("/history", promptpayController.getUserPromptPayPayments);

// GET /api/payment/promptpay/:id - Get PromptPay payment details by ID
router.get("/:id", promptpayController.getPromptPayPaymentById);

module.exports = router;
