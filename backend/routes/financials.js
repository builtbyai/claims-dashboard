const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');
const DataExtractor = require('../services/dataExtractor');
const PhotoIndexer = require('../services/photoIndexer');

const dbPath = path.join(__dirname, '..', 'database', 'customers.db');

/**
 * GET /api/financials/summary
 * Get overall financial metrics
 */
router.get('/summary', (req, res) => {
  try {
    const db = new Database(dbPath);

    const summary = db.prepare(`
      SELECT
        COUNT(*) as total_jobs,
        COALESCE(SUM(rcv_amount), 0) as total_rcv,
        COALESCE(SUM(collected_amount), 0) as total_collected,
        COALESCE(SUM(rcv_amount - collected_amount), 0) as total_outstanding,
        AVG(CASE WHEN collected_amount > 0 THEN (collected_amount * 100.0 / rcv_amount) END) as avg_collection_rate,
        COUNT(CASE WHEN collected_amount = 0 AND rcv_amount > 0 THEN 1 END) as jobs_awaiting_payment,
        COALESCE(SUM(CASE WHEN collected_amount = 0 AND rcv_amount > 0 THEN rcv_amount END), 0) as amount_awaiting_payment
      FROM customers
      WHERE rcv_amount IS NOT NULL AND rcv_amount > 0
    `).get();

    // Get jobs by status
    const jobsByStatus = db.prepare(`
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(rcv_amount), 0) as total_rcv
      FROM customers
      WHERE rcv_amount IS NOT NULL
      GROUP BY status
    `).all();

    // Get recent activity
    const recentActivity = db.prepare(`
      SELECT
        homeowner_name,
        property_address,
        rcv_amount,
        collected_amount,
        status,
        last_updated
      FROM customers
      WHERE rcv_amount IS NOT NULL
      ORDER BY last_updated DESC
      LIMIT 10
    `).all();

    db.close();

    res.json({
      success: true,
      summary,
      jobsByStatus,
      recentActivity
    });

  } catch (error) {
    console.error('Error getting financial summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/financials/by-customer/:id
 * Get financial details for a specific customer
 */
router.get('/by-customer/:id', (req, res) => {
  try {
    const db = new Database(dbPath);
    const customerId = req.params.id;

    const customer = db.prepare(`
      SELECT
        c.*,
        pi.photo_count as indexed_photo_count,
        pi.install_date_from_photos,
        pi.photos_by_date
      FROM customers c
      LEFT JOIN photo_inventory pi ON LOWER(pi.customer_name) LIKE '%' || LOWER(c.homeowner_name) || '%'
      WHERE c.id = ? OR c.job_id = ?
    `).get(customerId, customerId);

    if (!customer) {
      db.close();
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Parse photos_by_date if available
    if (customer.photos_by_date) {
      try {
        customer.photos_by_date = JSON.parse(customer.photos_by_date);
      } catch (e) {
        customer.photos_by_date = {};
      }
    }

    // Calculate metrics
    customer.outstanding_balance = (customer.rcv_amount || 0) - (customer.collected_amount || 0);
    customer.collection_rate = customer.rcv_amount > 0
      ? ((customer.collected_amount / customer.rcv_amount) * 100).toFixed(2)
      : 0;

    db.close();

    res.json({
      success: true,
      customer
    });

  } catch (error) {
    console.error('Error getting customer financials:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/financials/by-insurance
 * Get financial breakdown by insurance company
 */
router.get('/by-insurance', (req, res) => {
  try {
    const db = new Database(dbPath);

    const breakdown = db.prepare(`
      SELECT
        insurance_company,
        COUNT(*) as job_count,
        COALESCE(SUM(rcv_amount), 0) as total_rcv,
        COALESCE(SUM(collected_amount), 0) as total_collected,
        COALESCE(SUM(rcv_amount - collected_amount), 0) as total_outstanding,
        AVG(CASE WHEN collected_amount > 0 THEN (collected_amount * 100.0 / rcv_amount) END) as avg_collection_rate
      FROM customers
      WHERE rcv_amount IS NOT NULL
      GROUP BY insurance_company
      ORDER BY total_rcv DESC
    `).all();

    db.close();

    res.json({
      success: true,
      breakdown
    });

  } catch (error) {
    console.error('Error getting insurance breakdown:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/financials/outstanding
 * Get jobs with outstanding balances
 */
router.get('/outstanding', (req, res) => {
  try {
    const db = new Database(dbPath);

    const jobs = db.prepare(`
      SELECT
        id,
        job_id,
        homeowner_name,
        property_address,
        insurance_company,
        rcv_amount,
        collected_amount,
        (rcv_amount - collected_amount) as outstanding_balance,
        days_supplementing,
        status,
        last_updated
      FROM customers
      WHERE rcv_amount IS NOT NULL
        AND (rcv_amount - collected_amount) > 0
      ORDER BY (rcv_amount - collected_amount) DESC
    `).all();

    db.close();

    res.json({
      success: true,
      jobs,
      totalOutstanding: jobs.reduce((sum, job) => sum + job.outstanding_balance, 0)
    });

  } catch (error) {
    console.error('Error getting outstanding jobs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/financials/collection-timeline
 * Get payment timeline data
 */
router.get('/collection-timeline', (req, res) => {
  try {
    const db = new Database(dbPath);

    // Get install dates and payment data
    const timeline = db.prepare(`
      SELECT
        homeowner_name,
        property_address,
        install_date,
        supplement_date,
        rcv_amount,
        collected_amount,
        days_supplementing,
        status
      FROM customers
      WHERE install_date IS NOT NULL
        OR supplement_date IS NOT NULL
      ORDER BY
        COALESCE(install_date, supplement_date) DESC
    `).all();

    // Group by month
    const byMonth = {};

    timeline.forEach(job => {
      const date = job.install_date || job.supplement_date;
      if (date) {
        const monthKey = date.substring(0, 7); // YYYY-MM

        if (!byMonth[monthKey]) {
          byMonth[monthKey] = {
            month: monthKey,
            jobs: 0,
            totalRcv: 0,
            totalCollected: 0
          };
        }

        byMonth[monthKey].jobs++;
        byMonth[monthKey].totalRcv += job.rcv_amount || 0;
        byMonth[monthKey].totalCollected += job.collected_amount || 0;
      }
    });

    db.close();

    res.json({
      success: true,
      timeline,
      byMonth: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month))
    });

  } catch (error) {
    console.error('Error getting collection timeline:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/financials/sync
 * Trigger manual data sync
 */
router.post('/sync', async (req, res) => {
  try {
    console.log('🔄 Manual sync triggered...');

    // Run data extraction
    const dataExtractor = new DataExtractor();
    const extractResult = await dataExtractor.extractAllData();

    // Run photo indexing
    const photoIndexer = new PhotoIndexer();
    const indexResult = await photoIndexer.indexAllPhotos();

    // Calculate days supplementing
    const db = new Database(dbPath);
    dataExtractor.calculateDaysSupplementing(db);

    // Log sync
    dataExtractor.logSync(db, {
      ...extractResult,
      photosIndexed: indexResult.totalPhotos
    });

    db.close();

    res.json({
      success: true,
      dataExtraction: extractResult,
      photoIndexing: indexResult
    });

  } catch (error) {
    console.error('Error during manual sync:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/financials/sync-status
 * Get last sync status
 */
router.get('/sync-status', (req, res) => {
  try {
    const db = new Database(dbPath);

    const lastSync = db.prepare(`
      SELECT * FROM sync_log
      ORDER BY created_at DESC
      LIMIT 1
    `).get();

    db.close();

    res.json({
      success: true,
      lastSync: lastSync || null
    });

  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/financials/high-priority
 * Get high priority jobs (>80 photos or overdue)
 */
router.get('/high-priority', (req, res) => {
  try {
    const db = new Database(dbPath);

    const highPriority = db.prepare(`
      SELECT
        c.*,
        pi.photo_count as indexed_photo_count
      FROM customers c
      LEFT JOIN photo_inventory pi ON LOWER(pi.customer_name) LIKE '%' || LOWER(c.homeowner_name) || '%'
      WHERE
        (c.photo_count >= 80 OR pi.photo_count >= 80)
        OR c.days_supplementing > 30
      ORDER BY
        COALESCE(pi.photo_count, c.photo_count) DESC,
        c.days_supplementing DESC
    `).all();

    db.close();

    res.json({
      success: true,
      jobs: highPriority
    });

  } catch (error) {
    console.error('Error getting high priority jobs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/financials/monthly-revenue
 * Get monthly revenue breakdown
 */
router.get('/monthly-revenue', (req, res) => {
  try {
    const db = new Database(dbPath);

    const monthlyRevenue = db.prepare(`
      SELECT
        strftime('%Y-%m', supplement_date) as month,
        COUNT(*) as job_count,
        COALESCE(SUM(rcv_amount), 0) as total_rcv,
        COALESCE(SUM(collected_amount), 0) as total_collected,
        COALESCE(SUM(rcv_amount - collected_amount), 0) as outstanding
      FROM customers
      WHERE supplement_date IS NOT NULL
        AND rcv_amount IS NOT NULL
      GROUP BY strftime('%Y-%m', supplement_date)
      ORDER BY month DESC
      LIMIT 12
    `).all();

    db.close();

    res.json({
      success: true,
      monthlyRevenue: monthlyRevenue.reverse()
    });

  } catch (error) {
    console.error('Error getting monthly revenue:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
