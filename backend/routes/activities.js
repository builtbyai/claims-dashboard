const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../database/customers.db');

// Get all activities
router.get('/', (req, res) => {
  try {
    const db = new Database(DB_PATH, { readonly: true });

    const activities = db.prepare(`
      SELECT
        a.*,
        c.name as customer_name,
        c.property_address,
        c.job_id
      FROM customer_activities a
      LEFT JOIN customers c ON a.customer_id = c.id
      ORDER BY a.activity_date DESC
      LIMIT 100
    `).all();

    db.close();

    res.json({
      success: true,
      data: activities,
      count: activities.length,
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get activities by customer ID
router.get('/customer/:customerId', (req, res) => {
  try {
    const { customerId } = req.params;
    const db = new Database(DB_PATH, { readonly: true });

    const activities = db.prepare(`
      SELECT *
      FROM customer_activities
      WHERE customer_id = ?
      ORDER BY activity_date DESC
    `).all(customerId);

    db.close();

    res.json({
      success: true,
      data: activities,
      count: activities.length,
    });
  } catch (error) {
    console.error('Error fetching customer activities:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Create new activity
router.post('/', (req, res) => {
  try {
    const {
      customer_id,
      activity_type,
      activity_date,
      description,
      created_by,
      attachment_path,
      notes,
    } = req.body;

    if (!customer_id || !activity_type || !activity_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: customer_id, activity_type, activity_date',
      });
    }

    const db = new Database(DB_PATH);

    const result = db.prepare(`
      INSERT INTO customer_activities (
        customer_id, activity_type, activity_date, description,
        created_by, attachment_path, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      customer_id,
      activity_type,
      activity_date,
      description || null,
      created_by || null,
      attachment_path || null,
      notes || null
    );

    // Get the created activity
    const activity = db.prepare(`
      SELECT * FROM customer_activities WHERE id = ?
    `).get(result.lastInsertRowid);

    db.close();

    res.status(201).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update activity
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const db = new Database(DB_PATH);

    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      });
    }

    values.push(id);

    db.prepare(`
      UPDATE customer_activities
      SET ${fields.join(', ')}
      WHERE id = ?
    `).run(...values);

    const activity = db.prepare(`
      SELECT * FROM customer_activities WHERE id = ?
    `).get(id);

    db.close();

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Delete activity
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = new Database(DB_PATH);

    db.prepare('DELETE FROM customer_activities WHERE id = ?').run(id);
    db.close();

    res.json({
      success: true,
      message: 'Activity deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get activities by type
router.get('/type/:type', (req, res) => {
  try {
    const { type } = req.params;
    const db = new Database(DB_PATH, { readonly: true });

    const activities = db.prepare(`
      SELECT
        a.*,
        c.name as customer_name,
        c.property_address,
        c.job_id
      FROM customer_activities a
      LEFT JOIN customers c ON a.customer_id = c.id
      WHERE a.activity_type = ?
      ORDER BY a.activity_date DESC
      LIMIT 100
    `).all(type);

    db.close();

    res.json({
      success: true,
      data: activities,
      count: activities.length,
    });
  } catch (error) {
    console.error('Error fetching activities by type:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get activities by date range
router.get('/range/:startDate/:endDate', (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const db = new Database(DB_PATH, { readonly: true });

    const activities = db.prepare(`
      SELECT
        a.*,
        c.name as customer_name,
        c.property_address,
        c.job_id
      FROM customer_activities a
      LEFT JOIN customers c ON a.customer_id = c.id
      WHERE a.activity_date BETWEEN ? AND ?
      ORDER BY a.activity_date DESC
    `).all(startDate, endDate);

    db.close();

    res.json({
      success: true,
      data: activities,
      count: activities.length,
    });
  } catch (error) {
    console.error('Error fetching activities by date range:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
