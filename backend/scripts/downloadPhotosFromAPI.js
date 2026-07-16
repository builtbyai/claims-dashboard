/**
 * RoofLink Photo Downloader - Simplified approach using cookies
 *
 * This script extracts photos using the RoofLink API metadata
 * then uses curl with browser cookies to download files
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const databaseService = require('../services/databaseService');

const execAsync = promisify(exec);

const ROOFLINK_API_BASE = 'https://api.roof.link/api/light';
const BEARER_TOKEN = process.env.ROOFLINK_BEARER_TOKEN || '';
const PHOTOS_DIR = path.join(__dirname, '../../photos');

/**
 * Fetch all photo metadata for a job
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
 * Download a single photo using curl with cookies from Chrome
 */
async function downloadPhotoWithCurl(photoUrl, outputPath) {
  try {
    // Use curl with cookies from Chrome browser
    // This will use the authenticated session
    const curlCommand = `curl "${photoUrl}" -o "${outputPath}" --cookie-jar cookies.txt --cookie cookies.txt -L -s`;

    await execAsync(curlCommand);

    // Check if file was created and has content
    const stats = await fs.stat(outputPath);
    if (stats.size > 0) {
      return true;
    } else {
      await fs.unlink(outputPath);
      return false;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Download photos using simpler HTTP request with referer
 */
async function downloadPhotoSimple(photoUrl, outputPath) {
  try {
    const response = await axios.get(photoUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Referer': 'https://app.roof.link/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 30000,
    });

    await fs.writeFile(outputPath, response.data);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Main download function
 */
async function downloadJobPhotos(jobId, customerId) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Starting download for Job ID: ${jobId}`);
  console.log(`${'='.repeat(60)}\n`);

  // Fetch metadata
  const photos = await fetchPhotoMetadata(jobId);

  if (photos.length === 0) {
    console.log(`No photos found for job ${jobId}`);
    return { success: 0, failed: 0, total: 0 };
  }

  console.log(`\nTotal photos to download: ${photos.length}\n`);

  // Create job directory
  const jobDir = path.join(PHOTOS_DIR, `job_${jobId}`);
  await fs.mkdir(jobDir, { recursive: true });

  let successCount = 0;
  let failedCount = 0;

  // Download each photo
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const outputPath = path.join(jobDir, photo.name);

    console.log(`[${i + 1}/${photos.length}] Downloading: ${photo.name}`);

    // Try simple download first (works if S3 URLs are public with referer)
    let success = await downloadPhotoSimple(photo.url, outputPath);

    if (success) {
      console.log(`  ✓ Downloaded: ${photo.name}`);
      successCount++;

      // Save to database
      if (customerId) {
        try {
          await databaseService.addPhoto(customerId, {
            job_id: jobId,
            rooflink_photo_id: photo.id,
            original_url: photo.url,
            local_path: outputPath,
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
      console.error(`  ✗ Failed: ${photo.name}`);
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
  try {
    const jobId = process.argv[2];

    if (!jobId) {
      console.error('❌ Error: Job ID is required');
      console.log('\nUsage: node scripts/downloadPhotosFromAPI.js <jobId>');
      console.log('Example: node scripts/downloadPhotosFromAPI.js 3587409');
      process.exit(1);
    }

    // Find customer
    const customer = await databaseService.getCustomerByRoofLinkId(jobId);

    if (!customer) {
      console.warn(`⚠ Warning: No customer found in database for job ${jobId}`);
      console.log(`Downloading photos without database integration...\n`);
    }

    await downloadJobPhotos(jobId, customer ? customer.id : null);

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

module.exports = { downloadJobPhotos };
