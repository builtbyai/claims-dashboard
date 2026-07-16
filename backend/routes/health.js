const express = require('express');
const router = express.Router();
const db = require('../services/databaseService');
const { getActiveConnections } = require('../services/websocketService');

router.get('/', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'disconnected',
    websocket: {
      status: 'active',
      connections: getActiveConnections()
    },
    memory: {
      used: process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal
    }
  };

  try {
    const count = await db.getCustomerCount();
    health.database = 'connected';
    health.customerCount = count;
    res.json(health);
  } catch (error) {
    health.status = 'unhealthy';
    health.database = 'error';
    health.error = error.message;
    res.status(503).json(health);
  }
});

module.exports = router;
