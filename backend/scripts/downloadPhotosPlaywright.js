/**
 * RoofLink Photo Downloader using Playwright
 *
 * Downloads photos using authenticated browser session
 * since S3 URLs require browser cookies/authentication
 */

const { chromium } = require('playwright');
const databaseService = require('../services/databaseService');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;

const PHOTOS_DIR = path.join(__dirname, '../../photos');
const ROOFLINK_LOGIN_URL = 'https://integrate.rooflink.com';
const ROOFLINK_API_BASE = 'https://api.roof.link/api/light';
const BEARER_TOKEN = process.env.ROOFLINK_BEARER_TOKEN || '';

/**
 * Fetch photo metadata from RoofLink API
 */
async function fetchPhotoMetadata(jobId) {
  const allPhotos = [];
  let page = 1;
  let hasMore = true;

  console.log(`Fetching photo metadata for job ${jobId}...`);

  while (hasMore) {
    try {
      const response = await axios.get(`${ROOFLINK_API_BASE}/photos/`, {
        params: { job: jobId, page },
        headers: {
          'Authorization': `Bearer ${BEARER_TOKEN}`,
          'Accept': 'application/json',
        },
      });

      const { count, results, next } = response.data;
      allPhotos.push(...results);
      console.log(`  Page ${page}: ${results.length} photos (${allPhotos.length}/${count} total)`);

      hasMore = !!next;
      page++;

      if (hasMore) await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`  Error fetching page ${page}:`, error.message);
      hasMore = false;
    }
  }

  return allPhotos;
}

/**
 * Download photos for a specific job using authenticated browser
 */
async function downloadJobPhotosWithBrowser(jobId, customerId) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Starting browser-based download for Job ID: ${jobId}`);
  console.log(`${'='.repeat(60)}\n`);

  // Fetch metadata first
  const photos = await fetchPhotoMetadata(jobId);

  if (photos.length === 0) {
    console.log(`No photos found for job ${jobId}`);
    return { success: 0, failed: 0, total: 0 };
  }

  console.log(`\nTotal photos to download: ${photos.length}\n`);

  // Create job directory
  const jobDir = path.join(PHOTOS_DIR, `job_${jobId}`);
  await fs.mkdir(jobDir, { recursive: true });

  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  let successCount = 0;
  let failedCount = 0;

  try {
    // Login to RoofLink
    console.log('Logging in to RoofLink...');
    await page.goto(ROOFLINK_LOGIN_URL);
    await page.fill('input[type="email"]', 'supplement@summit-roofing.example');
    await page.fill('input[type="password"]', 'cyf0Kju7');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    console.log('✓ Logged in successfully\n');

    // Download each photo
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      console.log(`[${i + 1}/${photos.length}] Downloading: ${photo.name}`);

      try {
        // Navigate to the original URL to trigger download with auth
        const response = await page.goto(photo.url, { waitUntil: 'networkidle' });

        if (response && response.ok()) {
          const buffer = await response.body();
          const localPath = path.join(jobDir, photo.name);
          await fs.writeFile(localPath, buffer);
          console.log(`  ✓ Downloaded: ${photo.name}`);
          successCount++;

          // Save to database
          if (customerId) {
            try {
              await databaseService.addPhoto(customerId, {
                job_id: jobId,
                rooflink_photo_id: photo.id,
                original_url: photo.url,
                local_path: localPath,
                filename: photo.name,
                metadata: {
                  date_created: photo.date_created,
                  created_by: photo.created_by,
                  thumb_url: photo.thumb_url,
                  preview_url: photo.preview_url,
                  is_video: photo.is_video,
                  tags: photo.tags,
                },
              });
            } catch (dbError) {
              console.error(`  ⚠ Database save failed:`, dbError.message);
            }
          }
        } else {
          console.error(`  ✗ Failed: HTTP ${response?.status()}`);
          failedCount++;
        }
      } catch (error) {
        console.error(`  ✗ Failed:`, error.message);
        failedCount++;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Update customer photo count
    if (customerId && successCount > 0) {
      try {
        await databaseService.updateCustomer(customerId, { photo_count: successCount });
      } catch (error) {
        console.error(`Failed to update photo count:`, error.message);
      }
    }

  } finally {
    await browser.close();
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Download Summary:`);
  console.log(`  ✓ Success: ${successCount}`);
  console.log(`  ✗ Failed: ${failedCount}`);
  console.log(`  Total: ${photos.length}`);
  console.log(`${'='.repeat(60)}\n`);

  return { success: successCount, failed: failedCount, total: photos.length };
}

/**
 * Main execution
 */
async function main() {
  const jobId = process.argv[2];

  if (!jobId) {
    console.error('❌ Error: Job ID is required');
    console.log('\nUsage: node scripts/downloadPhotosPlaywright.js <jobId>');
    console.log('Example: node scripts/downloadPhotosPlaywright.js 3587409');
    process.exit(1);
  }

  try {
    // Find customer by job_id
    const customer = await databaseService.getCustomerByRoofLinkId(jobId);

    if (!customer) {
      console.warn(`⚠ Warning: No customer found in database for job ${jobId}`);
    }

    const result = await downloadJobPhotosWithBrowser(jobId, customer ? customer.id : null);

    console.log('\n' + '='.repeat(60));
    console.log('Download Summary:');
    console.log('='.repeat(60));
    console.log(result.message);
    console.log('='.repeat(60) + '\n');

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

module.exports = { downloadJobPhotosWithBrowser };
