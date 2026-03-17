const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhook.controller");

// GET /api/webhook/test - Test endpoint (for checking if webhook is reachable)
router.get("/test", (req, res) => {
    res.json({ message: "Webhook endpoint is working", timestamp: new Date().toISOString() });
});

// POST /api/webhook/omise - Omise webhook endpoint
// No authentication required - called by Omise servers
router.post("/omise", webhookController.handleOmiseWebhook);

module.exports = router;