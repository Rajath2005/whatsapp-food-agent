const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./utils/logger');
const whatsappRoutes = require('./routes/whatsapp');
const { initializeDatabase } = require('./services/database');
const { initializeSessionStore } = require('./services/sessionStore');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
// Exposes: /webhook (handled by whatsappRoutes)
app.use('/webhook', whatsappRoutes);

// Example API routes
// Exposes: /inventory
app.get('/inventory', (req, res) => {
  res.json({ items: [] }); // Replace with actual inventory logic
});

// Exposes: /faqs
app.get('/faqs', (req, res) => {
  res.json({ faqs: [] }); // Replace with actual FAQ logic
});

// Exposes: /orders
app.post('/orders', (req, res) => {
  res.status(201).json({ message: 'Order created', order: req.body }); // Replace with actual order logic
});

// Health check endpoint
// Exposes: /health
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'WhatsApp Food Ordering Agent'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Catch unmatched routes and send 404 Not Found
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found', message: 'The requested resource was not found.' });
});

// Example: Proper catch-all middleware route for Express.js v5+
// app.use('/*', someMiddleware);
// or
// app.use(/.*/, someMiddleware);

// Initialize services and start server
async function startServer() {
  try {
    await initializeDatabase();
    await initializeSessionStore();
    
    app.listen(PORT, () => {
      logger.info(`🚀 WhatsApp Food Ordering Agent running on port ${PORT}`);
      logger.info(`📱 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();