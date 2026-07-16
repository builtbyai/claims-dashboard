/**
 * Comprehensive Photo Download Script using Playwright
 * Downloads all photos for all customers from RoofLink and organizes them
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const Database = require('better-sqlite3');

const ROOFLINK_URL = 'https://roof.link/login';
const PHOTOS_BASE_PATH = path.join(__dirname, '../../photos');
const DB_PATH = path.join(__dirname, '../../database/customers.db');

// RoofLink credentials (replace with environment variables in production)
const ROOFLINK_EMAIL = process.env.ROOFLINK_EMAIL || 'supplement@summit-roofing.example';
const ROOFLINK_PASSWORD = process.env.ROOFLINK_PASSWORD || '';  // Set this in .env file

console.log('🚀 Playwright Photo Download Script');
console.log('=====================================\n');

class PhotoDownloader {
  constructor() {
    this.browser = null;
    this.page = null;
    this.db = null;
    this.downloadedCount = 0;
    this.failedCount = 0;
    this.totalPhotos = 0;
  }

  async initialize() {
    console.log('🔧 Initializing Playwright...');

    // Initialize database
    this.db = new Database(DB_PATH);

    // Launch browser
    this.browser = await chromium.launch({
      headless: false,  // Set to true for production
      slowMo: 100,  // Slow down by 100ms for stability
    });

    this.page = await this.browser.newPage();

    // Set viewport
    await this.page.setViewportSize({ width: 1920, height: 1080 });

    console.log('✅ Playwright initialized\n');
  }

  async login() {
    console.log('🔐 Logging into RoofLink...');

    try {
      await this.page.goto(ROOFLINK_URL, { waitUntil: 'networkidle' });

      // Fill login form
      await this.page.fill('input[type="email"]', ROOFLINK_EMAIL);
      await this.page.fill('input[type="password"]', ROOFLINK_PASSWORD);

      // Click login button
      await this.page.click('button[type="submit"]');

      // Wait for navigation
      await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });

      console.log('✅ Successfully logged in\n');
      return true;
    } catch (error) {
      console.error('❌ Login failed:', error.message);
      return false;
    }
  }

  async getCustomersWithJobIds() {
    console.log('📋 Fetching customers with job IDs from database...');

    const customers = this.db.prepare(`
      SELECT id, name, job_id, property_address
      FROM customers
      WHERE job_id IS NOT NULL
      ORDER BY name
    `).all();

    console.log(`✅ Found ${customers.length} customers with job IDs\n`);
    return customers;
  }

  async downloadCustomerPhotos(customer) {
    console.log(`\n📸 Downloading photos for: ${customer.name} (Job #${customer.job_id})`);

    try {
      const jobUrl = `https://roof.link/jobs/${customer.job_id}`;
      await this.page.goto(jobUrl, { waitUntil: 'networkidle' });

      // Click on Photos tab
      await this.page.click('text=Photos');
      await this.page.waitForTimeout(2000);

      // Get all photo elements
      const photoElements = await this.page.$$('[data-photo-id]');

      if (photoElements.length === 0) {
        console.log(`  ⚠️  No photos found for ${customer.name}`);
        return 0;
      }

      console.log(`  Found ${photoElements.length} photos`);

      // Create customer photo directory
      const customerPhotoDir = path.join(PHOTOS_BASE_PATH, `job_${customer.job_id}`);
      await fs.mkdir(customerPhotoDir, { recursive: true });

      let downloaded = 0;

      for (let i = 0; i < photoElements.length; i++) {
        try {
          const photoElement = photoElements[i];

          // Get photo data
          const photoId = await photoElement.getAttribute('data-photo-id');
          const photoUrl = await photoElement.getAttribute('data-photo-url') ||
                          await photoElement.getAttribute('src');

          if (!photoUrl) continue;

          // Click to open full-size image
          await photoElement.click();
          await this.page.waitForTimeout(500);

          // Get full-size image URL
          const fullSizeImg = await this.page.$('img[data-full-size]');
          const fullSizeUrl = fullSizeImg ?
            await fullSizeImg.getAttribute('src') :
            photoUrl;

          // Download the image
          const response = await this.page.evaluate(async (url) => {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
          }, fullSizeUrl);

          // Save image
          const base64Data = response.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');

          const ext = fullSizeUrl.match(/\.(jpg|jpeg|png|gif)/) ? fullSizeUrl.match(/\.(jpg|jpeg|png|gif)/)[1] : 'jpg';
          const filename = `photo_${i + 1}_${photoId || Date.now()}.${ext}`;
          const filepath = path.join(customerPhotoDir, filename);

          await fs.writeFile(filepath, buffer);

          downloaded++;
          this.downloadedCount++;

          // Close modal if open
          const closeButton = await this.page.$('[data-close-modal]');
          if (closeButton) await closeButton.click();

          await this.page.waitForTimeout(300);

          process.stdout.write(`\r  Downloaded: ${downloaded}/${photoElements.length}`);
        } catch (error) {
          console.error(`\n  ❌ Failed to download photo ${i + 1}:`, error.message);
          this.failedCount++;
        }
      }

      console.log(`\n  ✅ Downloaded ${downloaded} photos for ${customer.name}`);

      // Update database
      this.db.prepare(`
        UPDATE customers
        SET photo_count = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(downloaded, customer.id);

      return downloaded;
    } catch (error) {
      console.error(`  ❌ Failed to download photos for ${customer.name}:`, error.message);
      this.failedCount++;
      return 0;
    }
  }

  async downloadAllPhotos() {
    const customers = await this.getCustomersWithJobIds();

    for (const customer of customers) {
      const count = await this.downloadCustomerPhotos(customer);
      this.totalPhotos += count;

      // Add delay between customers to avoid rate limiting
      await this.page.waitForTimeout(2000);
    }
  }

  async saveHAR() {
    console.log('\n💾 Saving HAR (HTTP Archive) file...');

    try {
      const harPath = path.join(__dirname, 'rooflink_photo_download.har');

      // Enable HAR recording
      await this.page.context().routeFromHAR(harPath, { update: true });

      console.log(`✅ HAR file saved to: ${harPath}\n`);
    } catch (error) {
      console.error('❌ Failed to save HAR file:', error.message);
    }
  }

  generateSummary() {
    console.log('\n📊 Download Summary');
    console.log('===================');
    console.log(`Total Photos Downloaded: ${this.downloadedCount}`);
    console.log(`Failed Downloads: ${this.failedCount}`);
    console.log(`Total Customers Processed: ${this.db.prepare('SELECT COUNT(*) as count FROM customers WHERE job_id IS NOT NULL').get().count}`);
    console.log(`Customers with Photos: ${this.db.prepare('SELECT COUNT(*) as count FROM customers WHERE photo_count > 0').get().count}`);
    console.log('\n✅ Photo download complete!\n');
  }

  async cleanup() {
    console.log('🧹 Cleaning up...');

    if (this.db) this.db.close();
    if (this.browser) await this.browser.close();

    console.log('✅ Cleanup complete\n');
  }
}

// Alternative: API-based photo download (faster)
class APIPhotoDownloader {
  constructor() {
    this.apiKey = process.env.ROOFLINK_API_KEY || '';
    this.apiUrl = 'https://integrate.rooflink.com/roof_link_endpoints/api/light';
    this.db = null;
  }

  async initialize() {
    console.log('🔧 Initializing API photo downloader...');
    this.db = new Database(DB_PATH);
    console.log('✅ API downloader initialized\n');
  }

  async downloadPhotoFromAPI(photoUrl, savePath) {
    const response = await fetch(photoUrl, {
      headers: {
        'Referer': 'https://roof.link/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download photo: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await fs.writeFile(savePath, Buffer.from(buffer));
  }

  async fetchJobPhotos(jobId) {
    const response = await fetch(`${this.apiUrl}/photos?job_id=${jobId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return await response.json();
  }

  async downloadCustomerPhotosAPI(customer) {
    console.log(`\n📸 Downloading photos via API for: ${customer.name} (Job #${customer.job_id})`);

    try {
      const photosData = await this.fetchJobPhotos(customer.job_id);
      const photos = photosData.photos || [];

      if (photos.length === 0) {
        console.log(`  ⚠️  No photos found for ${customer.name}`);
        return 0;
      }

      console.log(`  Found ${photos.length} photos`);

      // Create customer photo directory
      const customerPhotoDir = path.join(PHOTOS_BASE_PATH, `job_${customer.job_id}`);
      await fs.mkdir(customerPhotoDir, { recursive: true });

      let downloaded = 0;

      for (let i = 0; i < photos.length; i++) {
        try {
          const photo = photos[i];
          const photoUrl = photo.url || photo.image_url;

          if (!photoUrl) continue;

          const ext = photoUrl.match(/\.(jpg|jpeg|png|gif)/) ? photoUrl.match(/\.(jpg|jpeg|png|gif)/)[1] : 'jpg';
          const filename = `${photo.category || 'photo'}_${i + 1}_${photo.id || Date.now()}.${ext}`;
          const filepath = path.join(customerPhotoDir, filename);

          await this.downloadPhotoFromAPI(photoUrl, filepath);

          downloaded++;
          process.stdout.write(`\r  Downloaded: ${downloaded}/${photos.length}`);

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`\n  ❌ Failed to download photo ${i + 1}:`, error.message);
        }
      }

      console.log(`\n  ✅ Downloaded ${downloaded} photos for ${customer.name}`);

      // Update database
      this.db.prepare(`
        UPDATE customers
        SET photo_count = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(downloaded, customer.id);

      return downloaded;
    } catch (error) {
      console.error(`  ❌ Failed to download photos for ${customer.name}:`, error.message);
      return 0;
    }
  }

  async downloadAll() {
    const customers = this.db.prepare(`
      SELECT id, name, job_id, property_address
      FROM customers
      WHERE job_id IS NOT NULL
      ORDER BY name
    `).all();

    console.log(`📋 Found ${customers.length} customers with job IDs\n`);

    for (const customer of customers) {
      await this.downloadCustomerPhotosAPI(customer);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  cleanup() {
    if (this.db) this.db.close();
  }
}

// Main execution
async function main() {
  const usePlaywright = process.argv.includes('--playwright');
  const useAPI = process.argv.includes('--api') || !usePlaywright;

  if (useAPI) {
    console.log('Using API-based photo download (faster)\n');
    const downloader = new APIPhotoDownloader();

    try {
      await downloader.initialize();
      await downloader.downloadAll();
      downloader.cleanup();
    } catch (error) {
      console.error('❌ Download failed:', error);
      downloader.cleanup();
      process.exit(1);
    }
  } else {
    console.log('Using Playwright-based photo download (visual automation)\n');
    const downloader = new PhotoDownloader();

    try {
      await downloader.initialize();

      const loginSuccess = await downloader.login();
      if (!loginSuccess) {
        console.error('❌ Cannot proceed without login');
        await downloader.cleanup();
        process.exit(1);
      }

      await downloader.downloadAllPhotos();
      await downloader.saveHAR();
      downloader.generateSummary();
      await downloader.cleanup();
    } catch (error) {
      console.error('❌ Download failed:', error);
      await downloader.cleanup();
      process.exit(1);
    }
  }
}

main();
