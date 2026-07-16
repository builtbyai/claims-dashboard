const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analyticsService');
const { authenticateJWT, optionalAuth } = require('../middleware/auth');

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get comprehensive dashboard statistics
 * @access  Public (optionally authenticated for enhanced features)
 */
router.get('/dashboard', optionalAuth, async (req, res) => {
  try {
    const stats = await analyticsService.getDashboardStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats', details: error.message });
  }
});

/**
 * @route   GET /api/analytics/kpis
 * @desc    Get key performance indicators
 * @access  Public
 */
router.get('/kpis', optionalAuth, async (req, res) => {
  try {
    const kpis = await analyticsService.getKPIs();
    res.json({
      success: true,
      data: kpis,
    });
  } catch (error) {
    console.error('KPIs error:', error);
    res.status(500).json({ error: 'Failed to get KPIs', details: error.message });
  }
});

/**
 * @route   GET /api/analytics/trends
 * @desc    Get trends over time
 * @access  Public
 */
router.get('/trends', optionalAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const trends = await analyticsService.getTrends(days);
    res.json({
      success: true,
      days,
      data: trends,
    });
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({ error: 'Failed to get trends', details: error.message });
  }
});

/**
 * @route   GET /api/analytics/insurance-companies
 * @desc    Get insurance company statistics
 * @access  Public
 */
router.get('/insurance-companies', optionalAuth, async (req, res) => {
  try {
    const stats = await analyticsService.getInsuranceCompanyStats();
    res.json({
      success: true,
      count: stats.length,
      data: stats,
    });
  } catch (error) {
    console.error('Insurance stats error:', error);
    res.status(500).json({ error: 'Failed to get insurance stats', details: error.message });
  }
});

/**
 * @route   GET /api/analytics/photos
 * @desc    Get photo analytics
 * @access  Public
 */
router.get('/photos', optionalAuth, async (req, res) => {
  try {
    const analytics = await analyticsService.getPhotoAnalytics();
    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Photo analytics error:', error);
    res.status(500).json({ error: 'Failed to get photo analytics', details: error.message });
  }
});

/**
 * @route   GET /api/analytics/approval-rate
 * @desc    Get supplement approval rate
 * @access  Public
 */
router.get('/approval-rate', optionalAuth, async (req, res) => {
  try {
    const rate = await analyticsService.getSupplementApprovalRate();
    res.json({
      success: true,
      data: rate,
    });
  } catch (error) {
    console.error('Approval rate error:', error);
    res.status(500).json({ error: 'Failed to get approval rate', details: error.message });
  }
});

/**
 * @route   GET /api/analytics/report
 * @desc    Generate analytics report
 * @access  Private
 */
router.get('/report', authenticateJWT, async (req, res) => {
  try {
    const { start, end, format = 'json' } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates are required' });
    }

    const report = await analyticsService.generateReport(start, end, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics_report_${start}_to_${end}.csv`);
      res.send(report);
    } else {
      res.json({
        success: true,
        data: report,
      });
    }
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
});

/**
 * @route   GET /api/analytics/realtime
 * @desc    Get real-time analytics (live updates)
 * @access  Public
 */
router.get('/realtime', async (req, res) => {
  try {
    const [kpis, trends7] = await Promise.all([
      analyticsService.getKPIs(),
      analyticsService.getTrends(7),
    ]);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        kpis: kpis.kpis,
        recent_trend: trends7[0] || null,
      },
    });
  } catch (error) {
    console.error('Real-time analytics error:', error);
    res.status(500).json({ error: 'Failed to get real-time analytics', details: error.message });
  }
});

module.exports = router;
