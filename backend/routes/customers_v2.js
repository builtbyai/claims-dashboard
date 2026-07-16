const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to master database
const dbPath = path.join(__dirname, '../database/master.db');
const db = new sqlite3.Database(dbPath);

/**
 * GET /api/customers - Get all customers with full extracted data
 */
router.get('/', (req, res) => {
  const { stage, search, page = 1, limit = 50 } = req.query;

  let sql = `
    SELECT
      c.*,
      COUNT(DISTINCT p.id) as actual_photo_count,
      COUNT(DISTINCT d.id) as document_count
    FROM customers c
    LEFT JOIN photos p ON c.id = p.customer_id
    LEFT JOIN documents d ON c.id = d.customer_id
    WHERE 1=1
  `;

  const params = [];

  if (stage) {
    sql += ` AND c.kanban_stage = ?`;
    params.push(stage);
  }

  if (search) {
    sql += ` AND (c.name LIKE ? OR c.claim_number LIKE ? OR c.policy_number LIKE ?)`;
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  sql += ` GROUP BY c.id ORDER BY c.name`;
  sql += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM customers WHERE 1=1';
    const countParams = [];

    if (stage) {
      countSql += ' AND kanban_stage = ?';
      countParams.push(stage);
    }

    if (search) {
      countSql += ' AND (name LIKE ? OR claim_number LIKE ? OR policy_number LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }

    db.get(countSql, countParams, (err, countRow) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countRow.total,
          pages: Math.ceil(countRow.total / parseInt(limit))
        }
      });
    });
  });
});

/**
 * GET /api/customers/:id - Get full customer details
 */
router.get('/:id', (req, res) => {
  const sql = `
    SELECT
      c.*,
      COUNT(DISTINCT p.id) as actual_photo_count,
      COUNT(DISTINCT d.id) as document_count
    FROM customers c
    LEFT JOIN photos p ON c.id = p.customer_id
    LEFT JOIN documents d ON c.id = d.customer_id
    WHERE c.id = ?
    GROUP BY c.id
  `;

  db.get(sql, [req.params.id], (err, customer) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({
      success: true,
      data: customer
    });
  });
});

/**
 * GET /api/customers/:id/photos - Get all photos for customer
 */
router.get('/:id/photos', (req, res) => {
  const sql = `
    SELECT * FROM photos
    WHERE customer_id = ?
    ORDER BY is_primary DESC, display_order ASC
  `;

  db.all(sql, [req.params.id], (err, photos) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json({
      success: true,
      data: photos,
      count: photos.length
    });
  });
});

/**
 * GET /api/customers/:id/documents - Get all documents for customer
 */
router.get('/:id/documents', (req, res) => {
  const sql = `
    SELECT * FROM documents
    WHERE customer_id = ?
    ORDER BY document_type, file_name
  `;

  db.all(sql, [req.params.id], (err, documents) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json({
      success: true,
      data: documents,
      count: documents.length
    });
  });
});

/**
 * GET /api/customers/:id/transactions - Get financial transactions
 */
router.get('/:id/transactions', (req, res) => {
  const sql = `
    SELECT * FROM financial_transactions
    WHERE customer_id = ?
    ORDER BY transaction_date DESC
  `;

  db.all(sql, [req.params.id], (err, transactions) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json({
      success: true,
      data: transactions,
      count: transactions.length
    });
  });
});

/**
 * GET /api/customers/stats/dashboard - Get dashboard statistics
 */
router.get('/stats/dashboard', (req, res) => {
  const sql = `
    SELECT
      COUNT(*) as total_customers,
      SUM(rcv_amount) as total_rcv,
      SUM(collected_amount) as total_collected,
      SUM(outstanding_balance) as total_outstanding,
      AVG(collection_percentage) as avg_collection_rate,
      COUNT(CASE WHEN kanban_stage = 'complete' THEN 1 END) as completed_jobs,
      COUNT(CASE WHEN kanban_stage = 'needs_supplement' THEN 1 END) as needs_supplement,
      COUNT(CASE WHEN kanban_stage = 'submitted' THEN 1 END) as submitted,
      COUNT(CASE WHEN kanban_stage = 'approved' THEN 1 END) as approved,
      COUNT(CASE WHEN kanban_stage = 'scheduled' THEN 1 END) as scheduled,
      COUNT(CASE WHEN kanban_stage = 'installed' THEN 1 END) as installed
    FROM customers
  `;

  db.get(sql, [], (err, stats) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json({
      success: true,
      data: stats
    });
  });
});

/**
 * PATCH /api/customers/:id - Update customer
 */
router.patch('/:id', (req, res) => {
  const updates = req.body;
  const allowedFields = [
    'name', 'property_address', 'city', 'state', 'zip',
    'phone', 'email', 'kanban_stage', 'install_date',
    'completion_date', 'collected_amount', 'supplement_amount'
  ];

  const updateFields = Object.keys(updates)
    .filter(key => allowedFields.includes(key))
    .map(key => `${key} = ?`)
    .join(', ');

  if (!updateFields) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const updateValues = Object.keys(updates)
    .filter(key => allowedFields.includes(key))
    .map(key => updates[key]);

  const sql = `UPDATE customers SET ${updateFields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

  db.run(sql, [...updateValues, req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Return updated customer
    db.get('SELECT * FROM customers WHERE id = ?', [req.params.id], (err, customer) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({
        success: true,
        data: customer
      });
    });
  });
});

/**
 * POST /api/sync/trigger - Manually trigger data sync
 */
router.post('/sync/trigger', async (req, res) => {
  try {
    const CustomerDataExtractor = require('../services/customerDataExtractor');
    const PhotoService = require('../services/photoService');

    const results = {
      customer_extraction: null,
      photo_processing: null,
      errors: []
    };

    // Run customer data extraction
    try {
      const extractor = new CustomerDataExtractor();
      await extractor.connect();
      results.customer_extraction = await extractor.processAllCustomers();
      await extractor.close();
    } catch (error) {
      results.errors.push(`Customer extraction error: ${error.message}`);
    }

    // Run photo processing
    try {
      const photoService = new PhotoService();
      await photoService.connect();
      results.photo_processing = await photoService.processAllCustomers();
      await photoService.close();
    } catch (error) {
      results.errors.push(`Photo processing error: ${error.message}`);
    }

    res.json({
      success: results.errors.length === 0,
      message: 'Data sync completed',
      results: results
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sync/status - Get last sync status
 */
router.get('/sync/status', (req, res) => {
  const sql = `
    SELECT * FROM sync_log
    ORDER BY start_time DESC
    LIMIT 10
  `;

  db.all(sql, [], (err, logs) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json({
      success: true,
      data: logs
    });
  });
});

module.exports = router;
