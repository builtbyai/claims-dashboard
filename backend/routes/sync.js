const express = require('express');
const router = express.Router();
const syncScheduler = require('../services/syncScheduler');
const rooflinkService = require('../services/rooflinkService');

// GET /api/sync/status - Get sync status
router.get('/status', (req, res) => {
  try {
    const status = syncScheduler.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sync/trigger - Manually trigger sync
router.post('/trigger', async (req, res) => {
  try {
    const result = await syncScheduler.triggerManualSync();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sync/start - Start automatic sync
router.post('/start', (req, res) => {
  try {
    syncScheduler.start();
    res.json({ message: 'Sync scheduler started', status: syncScheduler.getStatus() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sync/stop - Stop automatic sync
router.post('/stop', (req, res) => {
  try {
    syncScheduler.stop();
    res.json({ message: 'Sync scheduler stopped', status: syncScheduler.getStatus() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/sync/interval - Update sync interval
router.put('/interval', (req, res) => {
  try {
    const { intervalMs } = req.body;

    if (!intervalMs || intervalMs < 60000) {
      return res.status(400).json({ error: 'Interval must be at least 60000ms (1 minute)' });
    }

    syncScheduler.updateInterval(intervalMs);
    res.json({
      message: 'Sync interval updated',
      intervalMs,
      status: syncScheduler.getStatus()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sync/test - Test RoofLink connection
router.get('/test', async (req, res) => {
  try {
    const result = await syncScheduler.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sync/leads - Get leads from RoofLink (without syncing)
router.get('/leads', async (req, res) => {
  try {
    const leads = await rooflinkService.getAllLeads();
    res.json({
      count: leads.length,
      leads: leads
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== JOB MANAGEMENT ENDPOINTS ==========

// GET /api/sync/jobs/:jobId/details - Get full job details
router.get('/jobs/:jobId/details', async (req, res) => {
  try {
    const { jobId } = req.params;
    const details = await rooflinkService.getFullJobDetails(jobId);
    res.json(details);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sync/jobs/:jobId/notes - Get job notes
router.get('/jobs/:jobId/notes', async (req, res) => {
  try {
    const { jobId } = req.params;
    const notes = await rooflinkService.getJobNotes(jobId);
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sync/jobs/:jobId/notes - Add note to job
router.post('/jobs/:jobId/notes', async (req, res) => {
  try {
    const { jobId } = req.params;
    const noteData = req.body;
    const result = await rooflinkService.addJobNote(jobId, noteData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sync/jobs/:jobId/tasks - Get job tasks
router.get('/jobs/:jobId/tasks', async (req, res) => {
  try {
    const { jobId } = req.params;
    const tasks = await rooflinkService.getJobTasks(jobId);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sync/jobs/:jobId/documents - Get job documents
router.get('/jobs/:jobId/documents', async (req, res) => {
  try {
    const { jobId } = req.params;
    const documents = await rooflinkService.getJobDocuments(jobId);
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sync/jobs/:jobId/documents - Upload document to job
router.post('/jobs/:jobId/documents', async (req, res) => {
  try {
    const { jobId } = req.params;
    const documentData = req.body;
    const result = await rooflinkService.uploadJobDocument(jobId, documentData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sync/jobs/:jobId/timeline - Get job timeline
router.get('/jobs/:jobId/timeline', async (req, res) => {
  try {
    const { jobId } = req.params;
    const timeline = await rooflinkService.getJobTimeline(jobId);
    res.json(timeline);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sync/jobs/status/:status - Get jobs by status
router.get('/jobs/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const jobs = await rooflinkService.getJobsByStatus(status);
    res.json({ count: jobs.length, jobs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sync/jobs/supplements/needed - Get jobs needing supplements
router.get('/jobs/supplements/needed', async (req, res) => {
  try {
    const jobs = await rooflinkService.getJobsNeedingSupplements();
    res.json({ count: jobs.length, jobs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sync/jobs/search/customer - Search jobs by customer
router.get('/jobs/search/customer', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ error: 'Customer name parameter required' });
    }
    const jobs = await rooflinkService.searchJobsByCustomer(name);
    res.json({ count: jobs.length, jobs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sync/jobs/search/address - Search jobs by address
router.get('/jobs/search/address', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'Address parameter required' });
    }
    const jobs = await rooflinkService.searchJobsByAddress(address);
    res.json({ count: jobs.length, jobs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sync/jobs/recent/:days - Get recent jobs
router.get('/jobs/recent/:days', async (req, res) => {
  try {
    const days = parseInt(req.params.days) || 30;
    const jobs = await rooflinkService.getRecentJobs(days);
    res.json({ count: jobs.length, jobs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sync/jobs/recent - Get recent jobs (default 30 days)
router.get('/jobs/recent', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const jobs = await rooflinkService.getRecentJobs(days);
    res.json({ count: jobs.length, jobs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/sync/jobs/:jobId/status - Update job status
router.patch('/jobs/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status parameter required' });
    }
    const result = await rooflinkService.updateJobStatus(jobId, status);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/sync/jobs/:jobId/assign - Assign job to team member
router.patch('/jobs/:jobId/assign', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId parameter required' });
    }
    const result = await rooflinkService.assignJob(jobId, userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== SUPPLEMENTAL LINE ITEMS ENDPOINTS ==========

// GET /api/sync/estimates/:estimateId/supplements - Get supplemental line items
router.get('/estimates/:estimateId/supplements', async (req, res) => {
  try {
    const { estimateId } = req.params;
    const params = req.query;
    const items = await rooflinkService.getEstimateSupplementalItems(estimateId, params);
    res.json({ count: items.length, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sync/supplements/fields - Get supplemental item field configuration
router.get('/supplements/fields', async (req, res) => {
  try {
    const config = await rooflinkService.getSupplementalItemFieldsConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sync/estimates/:estimateId/supplements - Create supplemental line item
router.post('/estimates/:estimateId/supplements', async (req, res) => {
  try {
    const { estimateId } = req.params;
    const itemData = req.body;
    const result = await rooflinkService.createSupplementalItem(estimateId, itemData);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sync/estimates/:estimateId/supplements/bulk - Bulk create supplemental items
router.post('/estimates/:estimateId/supplements/bulk', async (req, res) => {
  try {
    const { estimateId } = req.params;
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array required' });
    }
    const result = await rooflinkService.createBulkSupplementalItems(estimateId, items);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/sync/supplements/:itemId - Update supplemental line item
router.patch('/supplements/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const itemData = req.body;
    const result = await rooflinkService.updateSupplementalItem(itemId, itemData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/sync/supplements/:itemId - Delete supplemental line item
router.delete('/supplements/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const result = await rooflinkService.deleteSupplementalItem(itemId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sync/supplements/:itemId/approve - Approve supplemental item
router.post('/supplements/:itemId/approve', async (req, res) => {
  try {
    const { itemId } = req.params;
    const result = await rooflinkService.approveSupplementalItem(itemId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sync/supplements/:itemId/reject - Reject supplemental item
router.post('/supplements/:itemId/reject', async (req, res) => {
  try {
    const { itemId } = req.params;
    const result = await rooflinkService.rejectSupplementalItem(itemId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sync/estimates/:estimateId/supplements/summary - Get supplemental items summary
router.get('/estimates/:estimateId/supplements/summary', async (req, res) => {
  try {
    const { estimateId } = req.params;
    const summary = await rooflinkService.getSupplementalItemsSummary(estimateId);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sync/estimates/:estimateId/full - Get estimate with all supplements
router.get('/estimates/:estimateId/full', async (req, res) => {
  try {
    const { estimateId } = req.params;
    const data = await rooflinkService.getEstimateWithSupplements(estimateId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== TEAM & DASHBOARD ENDPOINTS ==========

// GET /api/sync/team/members - Get team members
router.get('/team/members', async (req, res) => {
  try {
    const members = await rooflinkService.getTeamMembers();
    res.json({ count: members.length, members });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sync/team/:userId/jobs - Get jobs assigned to team member
router.get('/team/:userId/jobs', async (req, res) => {
  try {
    const { userId } = req.params;
    const jobs = await rooflinkService.getJobsByAssignee(userId);
    res.json({ count: jobs.length, jobs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sync/dashboard/stats - Get dashboard statistics
router.get('/dashboard/stats', async (req, res) => {
  try {
    const stats = await rooflinkService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
