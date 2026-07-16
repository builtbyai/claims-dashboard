const express = require('express');
const router = express.Router();
const rooflinkService = require('../services/rooflinkService');
const databaseService = require('../services/databaseService');
const path = require('path');

// GET /api/rooflink-photos/:jobId - Get all photos for a specific job from RoofLink API
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const photos = await rooflinkService.getJobPhotos(jobId);
    res.json({ success: true, jobId, count: photos.length, photos });
  } catch (error) {
    console.error(`Error fetching photos for job ${req.params.jobId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/rooflink-photos/:jobId/local - Get local downloaded photos for a job
router.get('/:jobId/local', async (req, res) => {
  try {
    const { jobId } = req.params;
    const photosDir = path.join(__dirname, '../../photos');
    const localPhotos = await rooflinkService.getLocalJobPhotos(jobId, photosDir);
    res.json({ success: true, jobId, count: localPhotos.length, photos: localPhotos });
  } catch (error) {
    console.error(`Error getting local photos for job ${req.params.jobId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/rooflink-photos/:jobId/download - Download all photos for a specific job
router.post('/:jobId/download', async (req, res) => {
  try {
    const { jobId } = req.params;
    const photosDir = path.join(__dirname, '../../photos');

    console.log(`Starting photo download for job ${jobId}...`);

    // Find customer by job_id to get customer ID
    const customer = await databaseService.getCustomerByRoofLinkId(jobId);

    // Download photos with database saving enabled if customer found
    const downloadedPhotos = await rooflinkService.downloadJobPhotos(
      jobId,
      photosDir,
      customer ? databaseService : null,
      customer ? customer.id : null
    );

    // Update customer photo count in database
    if (customer) {
      await databaseService.updateCustomer(customer.id, {
        photo_count: downloadedPhotos.length,
      });
    }

    res.json({
      success: true,
      jobId,
      customerId: customer ? customer.id : null,
      downloaded: downloadedPhotos.length,
      photos: downloadedPhotos,
    });
  } catch (error) {
    console.error(`Error downloading photos for job ${req.params.jobId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/rooflink-photos/sync-all - Sync photos for all customers
router.post('/sync-all', async (req, res) => {
  try {
    console.log('Starting photo sync for all customers...');
    const photosDir = path.join(__dirname, '../../photos');
    const results = await rooflinkService.syncAllCustomerPhotos(databaseService, photosDir);

    res.json({
      success: true,
      message: 'Photo sync completed',
      results,
    });
  } catch (error) {
    console.error('Error syncing all customer photos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/rooflink-photos/sync-status - Get sync status (for progress tracking)
router.get('/sync-status', (req, res) => {
  // This could be enhanced with a proper job queue system
  res.json({
    success: true,
    message: 'Sync status endpoint - implement job queue for detailed status',
  });
});

module.exports = router;
