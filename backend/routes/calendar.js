const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * GET /api/calendar/events
 * Get all calendar events (scheduled and completed installs)
 */
router.get('/events', async (req, res, next) => {
  try {
    const { start, end } = req.query;

    let query = `
      SELECT
        id,
        name,
        property_address,
        city,
        state,
        date_roof_scheduled,
        date_roof_completed,
        roofing_crew,
        photo_count,
        status,
        estimate_total
      FROM customers
      WHERE date_roof_scheduled IS NOT NULL OR date_roof_completed IS NOT NULL
    `;

    const params = [];

    // Filter by date range if provided
    if (start && end) {
      query += ` AND (
        (date_roof_scheduled >= ? AND date_roof_scheduled <= ?)
        OR (date_roof_completed >= ? AND date_roof_completed <= ?)
      )`;
      params.push(start, end, start, end);
    }

    query += ` ORDER BY COALESCE(date_roof_scheduled, date_roof_completed) ASC`;

    const events = await db.all(query, params);

    // Transform to calendar event format
    const calendarEvents = events.map(customer => {
      const isCompleted = !!customer.date_roof_completed;
      const eventDate = isCompleted
        ? customer.date_roof_completed
        : customer.date_roof_scheduled;

      return {
        id: customer.id,
        title: customer.name,
        date: eventDate,
        type: isCompleted ? 'completed' : 'scheduled',
        customer: {
          id: customer.id,
          name: customer.name,
          address: `${customer.property_address}, ${customer.city}, ${customer.state}`,
          crew: customer.roofing_crew,
          photoCount: customer.photo_count,
          status: customer.status,
          estimateTotal: customer.estimate_total,
        },
      };
    });

    res.json({
      success: true,
      count: calendarEvents.length,
      events: calendarEvents,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/calendar/upcoming
 * Get upcoming scheduled installs
 */
router.get('/upcoming', async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const today = new Date().toISOString().split('T')[0];

    const query = `
      SELECT
        id,
        name,
        property_address,
        city,
        state,
        date_roof_scheduled,
        roofing_crew,
        photo_count,
        status
      FROM customers
      WHERE date_roof_scheduled >= ?
        AND date_roof_completed IS NULL
      ORDER BY date_roof_scheduled ASC
      LIMIT ?
    `;

    const upcomingInstalls = await db.all(query, [today, parseInt(limit)]);

    res.json({
      success: true,
      count: upcomingInstalls.length,
      installs: upcomingInstalls,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/calendar/completed
 * Get recent completed installs
 */
router.get('/completed', async (req, res, next) => {
  try {
    const { limit = 10, days = 30 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const query = `
      SELECT
        id,
        name,
        property_address,
        city,
        state,
        date_roof_completed,
        roofing_crew,
        photo_count,
        status
      FROM customers
      WHERE date_roof_completed >= ?
      ORDER BY date_roof_completed DESC
      LIMIT ?
    `;

    const completedInstalls = await db.all(query, [cutoffDateStr, parseInt(limit)]);

    res.json({
      success: true,
      count: completedInstalls.length,
      installs: completedInstalls,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/calendar/schedule
 * Schedule an install for a customer
 */
router.post('/schedule', async (req, res, next) => {
  try {
    const { customerId, date, crew } = req.body;

    if (!customerId || !date) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID and date are required',
      });
    }

    // Validate date format
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
      });
    }

    const updateFields = ['date_roof_scheduled = ?'];
    const params = [date];

    if (crew) {
      updateFields.push('roofing_crew = ?');
      params.push(crew);
    }

    params.push(customerId);

    const query = `
      UPDATE customers
      SET ${updateFields.join(', ')},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await db.run(query, params);

    // Get updated customer
    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [customerId]);

    res.json({
      success: true,
      message: 'Install scheduled successfully',
      customer,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/calendar/:customerId/complete
 * Mark an install as completed
 */
router.patch('/:customerId/complete', async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { completionDate } = req.body;

    const date = completionDate || new Date().toISOString().split('T')[0];

    const query = `
      UPDATE customers
      SET date_roof_completed = ?,
          status = 'completed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await db.run(query, [date, customerId]);

    // Get updated customer
    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [customerId]);

    res.json({
      success: true,
      message: 'Install marked as completed',
      customer,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/calendar/stats
 * Get calendar statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get upcoming count
    const upcomingResult = await db.get(`
      SELECT COUNT(*) as count
      FROM customers
      WHERE date_roof_scheduled >= ?
        AND date_roof_completed IS NULL
    `, [today]);

    // Get completed this month
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    const firstOfMonthStr = firstOfMonth.toISOString().split('T')[0];

    const completedThisMonthResult = await db.get(`
      SELECT COUNT(*) as count
      FROM customers
      WHERE date_roof_completed >= ?
    `, [firstOfMonthStr]);

    // Get overdue (scheduled but not completed and past scheduled date)
    const overdueResult = await db.get(`
      SELECT COUNT(*) as count
      FROM customers
      WHERE date_roof_scheduled < ?
        AND date_roof_completed IS NULL
    `, [today]);

    res.json({
      success: true,
      stats: {
        upcoming: upcomingResult.count,
        completedThisMonth: completedThisMonthResult.count,
        overdue: overdueResult.count,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
