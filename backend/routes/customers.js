const express = require('express');
const router = express.Router();
const db = require('../services/databaseService');
const fs = require('../services/fileSystemService');
const { notifyCustomerUpdate } = require('../services/websocketService');

// GET /api/customers/search - Search customers (must be before /:id)
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const results = await db.searchCustomers(q);
    res.json({
      data: results,
      count: results.length
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/customers/stats - Get dashboard statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await db.getDashboardStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GET /api/customers - List all customers with pagination and filtering
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    const customers = await db.getAllCustomers(
      parseInt(page),
      parseInt(limit),
      status,
      search
    );
    const total = await db.getCustomerCount(status, search);

    res.json({
      data: customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/customers/:id - Get customer detail
router.get('/:id', async (req, res, next) => {
  try {
    const customer = await db.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// GET /api/customers/:id/activities - Get customer timeline
router.get('/:id/activities', async (req, res, next) => {
  try {
    const activities = await db.getCustomerActivities(req.params.id);
    res.json({
      data: activities,
      count: activities.length
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/customers/:id/folders - Get folder structure
router.get('/:id/folders', async (req, res, next) => {
  try {
    const customer = await db.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const folderInfo = await fs.getFolderStructure(customer.folder_path);
    res.json({
      customerId: customer.id,
      customerName: customer.name,
      basePath: customer.folder_path,
      folders: folderInfo
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/customers/:id - Update customer
router.patch('/:id', async (req, res, next) => {
  try {
    const result = await db.updateCustomer(req.params.id, req.body);

    if (result.changes > 0) {
      const updatedCustomer = await db.getCustomerById(req.params.id);

      // Notify via WebSocket
      notifyCustomerUpdate(updatedCustomer);

      res.json(updatedCustomer);
    } else {
      res.status(404).json({ error: 'Customer not found' });
    }
  } catch (error) {
    next(error);
  }
});

// PATCH /api/customers/:id/kanban - Update customer Kanban stage
router.patch('/:id/kanban', async (req, res, next) => {
  try {
    const { kanban_stage } = req.body;

    if (!kanban_stage) {
      return res.status(400).json({ error: 'kanban_stage is required' });
    }

    const result = await db.updateCustomer(req.params.id, { kanban_stage });

    if (result.changes > 0) {
      const updatedCustomer = await db.getCustomerById(req.params.id);

      // Notify via WebSocket
      notifyCustomerUpdate(updatedCustomer);

      res.json(updatedCustomer);
    } else {
      res.status(404).json({ error: 'Customer not found' });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
