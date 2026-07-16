const express = require('express');
const router = express.Router();
const supplementDetectionService = require('../services/supplementDetectionService');
const { authenticateJWT, optionalAuth, authorizeRoles } = require('../middleware/auth');

/**
 * @route   POST /api/detection/analyze/:jobId
 * @desc    Analyze a specific job for supplement needs
 * @access  Public
 */
router.post('/analyze/:jobId', optionalAuth, async (req, res) => {
  try {
    const { jobId } = req.params;
    const analysis = await supplementDetectionService.analyzeJobForSupplement(parseInt(jobId));

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze job', details: error.message });
  }
});

/**
 * @route   POST /api/detection/generate/:jobId
 * @desc    Auto-generate supplement items for a job
 * @access  Private (authenticated users only)
 */
router.post('/generate/:jobId', authenticateJWT, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { estimateId } = req.body;

    if (!estimateId) {
      return res.status(400).json({ error: 'estimateId is required' });
    }

    // First analyze
    const analysis = await supplementDetectionService.analyzeJobForSupplement(parseInt(jobId));

    // Then generate if needed
    const result = await supplementDetectionService.autoGenerateSupplementItems(
      parseInt(jobId),
      estimateId,
      analysis
    );

    res.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: 'Failed to generate supplement items', details: error.message });
  }
});

/**
 * @route   POST /api/detection/scan
 * @desc    Scan all jobs for supplement needs
 * @access  Private (admin only)
 */
router.post('/scan', authenticateJWT, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const results = await supplementDetectionService.scanAllJobsForSupplements();

    res.json({
      success: true,
      message: `Scanned ${results.scannedCount} jobs, found ${results.needsSupplementCount} needing supplements`,
      data: results,
    });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Failed to scan jobs', details: error.message });
  }
});

/**
 * @route   GET /api/detection/history
 * @desc    Get detection history
 * @access  Public
 */
router.get('/history', optionalAuth, async (req, res) => {
  try {
    const { jobId } = req.query;
    const history = await supplementDetectionService.getDetectionHistory(jobId ? parseInt(jobId) : null);

    res.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to get detection history', details: error.message });
  }
});

/**
 * @route   GET /api/detection/rules
 * @desc    Get detection rules configuration
 * @access  Public
 */
router.get('/rules', (req, res) => {
  try {
    const rules = supplementDetectionService.detectionRules;

    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    console.error('Rules error:', error);
    res.status(500).json({ error: 'Failed to get rules', details: error.message });
  }
});

/**
 * @route   PATCH /api/detection/rules
 * @desc    Update detection rules
 * @access  Private (admin only)
 */
router.patch('/rules', authenticateJWT, authorizeRoles('admin'), async (req, res) => {
  try {
    const updates = req.body;

    // Update rules (merge with existing)
    Object.assign(supplementDetectionService.detectionRules, updates);

    res.json({
      success: true,
      message: 'Detection rules updated',
      data: supplementDetectionService.detectionRules,
    });
  } catch (error) {
    console.error('Update rules error:', error);
    res.status(500).json({ error: 'Failed to update rules', details: error.message });
  }
});

module.exports = router;
