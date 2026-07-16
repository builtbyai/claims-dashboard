/**
 * RoofLink Photo Downloader Script
 *
 * Downloads all photos for RoofLink jobs using the authenticated API
 * Saves photos to local storage and updates database with metadata
 *
 * Usage: node scripts/downloadRoofLinkPhotos.js [jobId]
 *
 * If no jobId provided, downloads photos for all jobs in the database
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const databaseService = require('../services/databaseService');

// RoofLink API configuration
const ROOFLINK_API_BASE = 'https://api.roof.link/api/light';
const BEARER_TOKEN = process.env.ROOFLINK_BEARER_TOKEN || ''; // From authenticated session
const PHOTOS_DIR = path.join(__dirname, '../../photos');

/**
 * Fetch all photos for a specific job (handles pagination)
 */
async function fetchJobPhotos(jobId) {
  const allPhotos = [];
  let page = 1;
  let hasMore = true;

  console.log(`Fetching photos for job ${jobId}...`);

  while (hasMore) {
    try {
      const response = await axios.get(`${ROOFLINK_API_BASE}/photos/`, {
        params: { job: jobId, page },
        headers: {
          'Authorization': `Bearer ${BEARER_TOKEN}`,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'x-platform-version': 'light',
        },
      });

      const { count, results, next } = response.data;

      allPhotos.push(...results);
      console.log(`  Page ${page}: Fetched ${results.length} photos (${allPhotos.length}/${count} total)`);

      hasMore = !!next;
      page++;

      // Rate limiting - wait 500ms between requests
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`  Error fetching page ${page}:`, error.message);
      hasMore = false;
    }
  }

  console.log(`Total photos fetched for job ${jobId}: ${allPhotos.length}`);
  return allPhotos;
}

/**
 * Download a single photo from URL to local storage
 */
async function downloadPhoto(photoUrl, jobId, photoId, filename) {
  try {
    // Create job-specific directory
    const jobDir = path.join(PHOTOS_DIR, `job_${jobId}`);
    await fs.mkdir(jobDir, { recursive: true });

    // Generate local file path
    const localPath = path.join(jobDir, filename);

    // Download photo
    const response = await axios.get(photoUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
      },
    });

    // Save to disk
    await fs.writeFile(localPath, response.data);
    console.log(`    ✓ Downloaded: ${filename}`);

    return localPath;
  } catch (error) {
    console.error(`    ✗ Failed to download ${filename}:`, error.message);
    return null;
  }
}

/**
 * Download all photos for a job
 */
async function downloadJobPhotos(jobId, customerId) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Starting download for Job ID: ${jobId}`);
  console.log(`${'='.repeat(60)}\n`);

  // Fetch photo metadata from RoofLink API
  const photos = await fetchJobPhotos(jobId);

  if (photos.length === 0) {
    console.log(`No photos found for job ${jobId}`);
    return { success: 0, failed: 0, total: 0 };
  }

  let successCount = 0;
  let failedCount = 0;

  // Download each photo
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    console.log(`  [${i + 1}/${photos.length}] Processing: ${photo.name}`);

    // Download from original URL (highest quality)
    const localPath = await downloadPhoto(
      photo.url,
      jobId,
      photo.id,
      photo.name
    );

    if (localPath) {
      successCount++;

      // Save to database if customer ID provided
      if (customerId) {
        try {
          await databaseService.addPhoto(customerId, {
            job_id: jobId,
            rooflink_photo_id: photo.id,
            original_url: photo.url,
            local_path: localPath,
            filename: photo.name,
            name: photo.name,
            description: photo.description,
            category: photo.tags && photo.tags.length > 0 ? photo.tags[0] : null,
            tags: photo.tags,
            metadata: {
              date_created: photo.date_created,
              created_by: photo.created_by,
              thumb_url: photo.thumb_url,
              preview_url: photo.preview_url,
              is_video: photo.is_video,
            },
          });
        } catch (dbError) {
          console.error(`    ⚠ Database save failed:`, dbError.message);
        }
      }
    } else {
      failedCount++;
    }

    // Rate limiting - wait 200ms between downloads
    if (i < photos.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Update customer photo count
  if (customerId && successCount > 0) {
    try {
      await databaseService.updateCustomer(customerId, {
        photo_count: successCount,
      });
    } catch (error) {
      console.error(`Failed to update customer photo count:`, error.message);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Job ${jobId} Download Summary:`);
  console.log(`  ✓ Success: ${successCount}`);
  console.log(`  ✗ Failed: ${failedCount}`);
  console.log(`  Total: ${photos.length}`);
  console.log(`${'='.repeat(60)}\n`);

  return { success: successCount, failed: failedCount, total: photos.length };
}

/**
 * Download photos for all jobs in database
 */
async function downloadAllJobPhotos() {
  console.log('\n🔍 Finding all jobs in database...\n');

  // Get all customers with job_ids
  const customers = await databaseService.getAllCustomers(1, 1000);
  const jobCustomers = customers.filter(c => c.job_id);

  console.log(`Found ${jobCustomers.length} customers with job IDs\n`);

  const results = {
    totalJobs: jobCustomers.length,
    successfulJobs: 0,
    failedJobs: 0,
    totalPhotos: 0,
    successfulPhotos: 0,
    failedPhotos: 0,
  };

  for (let i = 0; i < jobCustomers.length; i++) {
    const customer = jobCustomers[i];
    console.log(`\n[${i + 1}/${jobCustomers.length}] Customer: ${customer.name}`);

    try {
      const jobResult = await downloadJobPhotos(customer.job_id, customer.id);
      results.successfulJobs++;
      results.totalPhotos += jobResult.total;
      results.successfulPhotos += jobResult.success;
      results.failedPhotos += jobResult.failed;
    } catch (error) {
      console.error(`Failed to download photos for job ${customer.job_id}:`, error.message);
      results.failedJobs++;
    }

    // Wait between jobs to avoid rate limiting
    if (i < jobCustomers.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next job...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Jobs Processed: ${results.successfulJobs}/${results.totalJobs}`);
  console.log(`Total Photos: ${results.totalPhotos}`);
  console.log(`  ✓ Successfully Downloaded: ${results.successfulPhotos}`);
  console.log(`  ✗ Failed Downloads: ${results.failedPhotos}`);
  console.log('='.repeat(60) + '\n');

  return results;
}

/**
 * Main execution
 */
async function main() {
  try {
    const jobId = process.argv[2];

    if (jobId) {
      // Download photos for specific job
      console.log(`Mode: Single Job Download`);

      // Find customer by job_id
      const customer = await databaseService.getCustomerByRoofLinkId(jobId);

      if (!customer) {
        console.warn(`⚠ Warning: No customer found in database for job ${jobId}`);
        console.log(`Downloading photos without database integration...\n`);
      }

      await downloadJobPhotos(jobId, customer ? customer.id : null);
    } else {
      // Download photos for all jobs
      console.log(`Mode: All Jobs Download`);
      await downloadAllJobPhotos();
    }

    console.log('✅ Photo download complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { fetchJobPhotos, downloadJobPhotos, downloadAllJobPhotos };
