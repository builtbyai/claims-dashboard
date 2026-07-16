const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * Kanban Stages:
 * - needs_supplement: Needs supplement (80+ photos or identified need)
 * - supplement_sent: Supplement has been sent to insurance
 * - under_review: Insurance is reviewing the supplement
 * - approved: Supplement approved by insurance
 * - scheduled: Job scheduled for installation
 * - completed: Job completed
 */

const VALID_STAGES = [
  'needs_supplement',
  'supplement_sent',
  'under_review',
  'approved',
  'scheduled',
  'completed',
];

/**
 * GET /api/kanban/board
 * Get all customers organized by Kanban stage
 */
router.get('/board', async (req, res, next) => {
  try {
    const customers = await db.all(`
      SELECT
        id,
        name,
        property_address,
        city,
        state,
        kanban_stage,
        status,
        photo_count,
        supplement_sent_date,
        date_roof_scheduled,
        date_roof_completed,
        insurance_company,
        estimate_total,
        last_email_date,
        last_email_subject,
        last_email_from,
        has_unread_email,
        job_id,
        created_at,
        updated_at
      FROM customers
      ORDER BY
        CASE kanban_stage
          WHEN 'needs_supplement' THEN 1
          WHEN 'supplement_sent' THEN 2
          WHEN 'under_review' THEN 3
          WHEN 'approved' THEN 4
          WHEN 'scheduled' THEN 5
          WHEN 'completed' THEN 6
          ELSE 7
        END,
        updated_at DESC
    `);

    // Group by stage
    const board = VALID_STAGES.reduce((acc, stage) => {
      acc[stage] = customers.filter(c => c.kanban_stage === stage || (!c.kanban_stage && stage === 'needs_supplement'));
      return acc;
    }, {});

    res.json({
      success: true,
      board,
      totalCustomers: customers.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/kanban/:customerId/stage
 * Update customer's Kanban stage
 */
router.patch('/:customerId/stage', async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { stage } = req.body;

    if (!stage) {
      return res.status(400).json({
        success: false,
        error: 'Stage is required',
      });
    }

    if (!VALID_STAGES.includes(stage)) {
      return res.status(400).json({
        success: false,
        error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}`,
      });
    }

    // Check if customer exists
    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [customerId]);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    // Update stage
    await db.run(
      `UPDATE customers SET kanban_stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [stage, customerId]
    );

    // Auto-update related fields based on stage
    if (stage === 'supplement_sent' && !customer.supplement_sent_date) {
      await db.run(
        `UPDATE customers SET supplement_sent_date = ? WHERE id = ?`,
        [new Date().toISOString().split('T')[0], customerId]
      );
    } else if (stage === 'scheduled' && !customer.date_roof_scheduled) {
      // Don't auto-set date, but mark status
      await db.run(
        `UPDATE customers SET status = 'scheduled' WHERE id = ?`,
        [customerId]
      );
    } else if (stage === 'completed' && !customer.date_roof_completed) {
      await db.run(
        `UPDATE customers SET date_roof_completed = ?, status = 'completed' WHERE id = ?`,
        [new Date().toISOString().split('T')[0], customerId]
      );
    }

    // Get updated customer
    const updatedCustomer = await db.get('SELECT * FROM customers WHERE id = ?', [customerId]);

    res.json({
      success: true,
      message: `Customer moved to ${stage}`,
      customer: updatedCustomer,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/kanban/stats
 * Get Kanban board statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = {};

    for (const stage of VALID_STAGES) {
      const result = await db.get(
        `SELECT COUNT(*) as count FROM customers WHERE kanban_stage = ?`,
        [stage]
      );
      stats[stage] = result.count;
    }

    // Get customers without a stage
    const noStageResult = await db.get(
      `SELECT COUNT(*) as count FROM customers WHERE kanban_stage IS NULL OR kanban_stage = ''`
    );
    stats.no_stage = noStageResult.count;

    // Calculate workflow metrics
    const supplementingSince = await db.all(`
      SELECT
        id,
        name,
        supplement_sent_date,
        CAST((julianday('now') - julianday(supplement_sent_date)) AS INTEGER) as days_supplementing
      FROM customers
      WHERE supplement_sent_date IS NOT NULL
        AND date_roof_completed IS NULL
      ORDER BY days_supplementing DESC
      LIMIT 10
    `);

    // Urgent items (80+ photos or supplementing > 7 days)
    const urgentResult = await db.get(`
      SELECT COUNT(*) as count
      FROM customers
      WHERE (
        photo_count >= 80
        OR (
          supplement_sent_date IS NOT NULL
          AND CAST((julianday('now') - julianday(supplement_sent_date)) AS INTEGER) > 7
          AND date_roof_completed IS NULL
        )
      )
    `);

    res.json({
      success: true,
      stats,
      metrics: {
        supplementingSince,
        urgentCount: urgentResult.count,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/kanban/bulk-move
 * Move multiple customers to a new stage
 */
router.post('/bulk-move', async (req, res, next) => {
  try {
    const { customerIds, stage } = req.body;

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Customer IDs array is required',
      });
    }

    if (!VALID_STAGES.includes(stage)) {
      return res.status(400).json({
        success: false,
        error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}`,
      });
    }

    const placeholders = customerIds.map(() => '?').join(',');
    const query = `
      UPDATE customers
      SET kanban_stage = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `;

    await db.run(query, [stage, ...customerIds]);

    res.json({
      success: true,
      message: `${customerIds.length} customers moved to ${stage}`,
      movedCount: customerIds.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/kanban/timeline/:customerId
 * Get stage transition timeline for a customer
 */
router.get('/timeline/:customerId', async (req, res, next) => {
  try {
    const { customerId } = req.params;

    // Get customer with all date fields
    const customer = await db.get(`
      SELECT
        id,
        name,
        created_at,
        supplement_sent_date,
        date_roof_scheduled,
        date_roof_completed,
        kanban_stage,
        updated_at
      FROM customers
      WHERE id = ?
    `, [customerId]);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    // Build timeline
    const timeline = [];

    timeline.push({
      stage: 'created',
      label: 'Customer Created',
      date: customer.created_at,
      icon: 'add',
    });

    if (customer.supplement_sent_date) {
      timeline.push({
        stage: 'supplement_sent',
        label: 'Supplement Sent',
        date: customer.supplement_sent_date,
        icon: 'send',
      });
    }

    if (customer.date_roof_scheduled) {
      timeline.push({
        stage: 'scheduled',
        label: 'Install Scheduled',
        date: customer.date_roof_scheduled,
        icon: 'calendar',
      });
    }

    if (customer.date_roof_completed) {
      timeline.push({
        stage: 'completed',
        label: 'Install Completed',
        date: customer.date_roof_completed,
        icon: 'check',
      });
    }

    // Sort by date
    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        currentStage: customer.kanban_stage,
      },
      timeline,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
