const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const whatsappService = require('../services/whatsapp');
const messageHandler = require('../handlers/messageHandler');

// Webhook verification (GET)
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    logger.info('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    logger.warn('❌ Webhook verification failed');
    res.status(403).send('Forbidden');
  }
});

// Webhook message handler (POST)
router.post('/', async (req, res) => {
  try {
    logger.info('📨 Received webhook payload:', JSON.stringify(req.body, null, 2));
    
    const { entry } = req.body;
    
    if (!entry || !entry[0]?.changes?.[0]?.value?.messages) {
      logger.info('📭 No messages in webhook payload');
      return res.status(200).send('OK');
    }

    const { messages, contacts } = entry[0].changes[0].value;
    
    for (const message of messages) {
      if (message.type === 'text') {
        const contact = contacts.find(c => c.wa_id === message.from);
        await messageHandler.handleIncomingMessage(message, contact);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    logger.error('❌ Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

module.exports = router;
