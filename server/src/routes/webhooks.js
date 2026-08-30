const express = require('express');
const router = express.Router();
const { handleGoogleFormWebhook } = require('../controllers/webhookController');

// Public route — secured via WEBHOOK_SECRET in request body
router.post('/google-form', handleGoogleFormWebhook);

module.exports = router;
