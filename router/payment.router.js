const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");
const { verifyToken } = require("../middleware/auth.middleware");

// All payment routes require authentication
router.use(verifyToken);

// POST /api/payment/create - Create new payment with QR code
router.post("/create", paymentController.createPayment);

// GET /api/payment/history - Get user's payment history
router.get("/history", paymentController.getUserPayments);

// GET /api/payment/:id - Get payment details by ID
router.get("/:id", paymentController.getPaymentById);

// PUT /api/payment/:id/verify - Verify payment (admin only)
router.put("/:id/verify", paymentController.verifyPayment);

module.exports = router;
