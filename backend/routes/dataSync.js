const express = require('express');
const router = express.Router();
const dataSyncService = require('../services/dataSync');

/**
 * @route   GET /api/data-sync/status
 * @desc    Get data sync service status
 * @access  Public
 */
router.get('/status', async (req, res) => {
  try {
    const status = dataSyncService.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

/**
 * @route   POST /api/data-sync/trigger
 * @desc    Manually trigger a sync cycle
 * @access  Public
 */
router.post('/trigger', async (req, res) => {
  try {
    await dataSyncService.performSync();
    res.json({
      message: 'Sync triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error triggering sync:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

/**
 * @route   POST /api/data-sync/start
 * @desc    Start the sync service
 * @access  Public
 */
router.post('/start', async (req, res) => {
  try {
    await dataSyncService.start();
    res.json({
      message: 'Sync service started',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error starting sync service:', error);
    res.status(500).json({ error: 'Failed to start sync service' });
  }
});

/**
 * @route   POST /api/data-sync/stop
 * @desc    Stop the sync service
 * @access  Public
 */
router.post('/stop', (req, res) => {
  try {
    dataSyncService.stop();
    res.json({
      message: 'Sync service stopped',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error stopping sync service:', error);
    res.status(500).json({ error: 'Failed to stop sync service' });
  }
});

module.exports = router;
