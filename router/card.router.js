const express = require("express");
const router = express.Router();
const cardController = require("../controllers/card.controller");
const { verifyToken } = require("../middleware/auth.middleware");

// All Card routes require authentication
router.use(verifyToken);

// POST /api/payment/card/charge - Charge card (for frontend compatibility)
router.post("/charge", cardController.chargeCard);

// POST /api/payment/card/create - Create new card payment
router.post("/create", cardController.createCardPayment);

// GET /api/payment/card/history - Get user's card payment history
router.get("/history", cardController.getUserCardPayments);

// GET /api/payment/card/:id - Get card payment details by ID
router.get("/:id", cardController.getCardPaymentById);

module.exports = router;
