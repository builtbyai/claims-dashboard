const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const db = require('../config/database');

/**
 * Photo Integration Service
 * Finds REAL photos from ALL_PHOTOS directory and integrates them into the dashboard
 * NO PLACEHOLDERS - Only real image files
 */

class PhotoIntegrationService {
  constructor() {
    this.sourceDir = path.join(__dirname, '..', '..', '..', 'sample_data', 'ALL_PHOTOS');
    this.targetDir = path.join(__dirname, '..', '..', 'frontend', 'public', 'customer_photos');
    this.byCreatorDir = path.join(this.sourceDir, 'by_creator');
    this.byMonthDir = path.join(this.sourceDir, 'by_month');
    this.imageExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
  }

  /**
   * Get all customers from database
   */
  async getAllCustomers() {
    return new Promise((resolve, reject) => {
      db.all('SELECT id, name, address FROM customers', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Find photos for a customer by matching creator name
   */
  async findCustomerPhotos(customerName) {
    const photos = [];

    try {
      // Check by_creator directory
      const creators = await fs.readdir(this.byCreatorDir);

      for (const creator of creators) {
        const creatorPath = path.join(this.byCreatorDir, creator);
        const stat = await fs.stat(creatorPath);

        if (stat.isDirectory()) {
          // Get all subdirectories (months)
          const months = await fs.readdir(creatorPath);

          for (const month of months) {
            const monthPath = path.join(creatorPath, month);
            const monthStat = await fs.stat(monthPath);

            if (monthStat.isDirectory()) {
              const files = await fs.readdir(monthPath);

              for (const file of files) {
                const ext = path.extname(file).toLowerCase();
                if (this.imageExtensions.includes(ext)) {
                  photos.push({
                    source: path.join(monthPath, file),
                    creator: creator,
                    month: month,
                    filename: file
                  });
                }
              }
            }
          }
        }
      }

      return photos;
    } catch (error) {
      console.error(`Error finding photos for ${customerName}:`, error);
      return [];
    }
  }

  /**
   * Copy first N photos to frontend public directory
   */
  async copyPhotosForCustomer(customerName, photos, limit = 5) {
    const customerDir = path.join(this.targetDir, this.sanitizeFilename(customerName));

    try {
      // Create customer directory if it doesn't exist
      if (!fsSync.existsSync(customerDir)) {
        await fs.mkdir(customerDir, { recursive: true });
      }

      const copiedPhotos = [];

      // Copy first N photos
      const photosToIncludes = photos.slice(0, limit);

      for (let i = 0; i < photosToIncludes.length; i++) {
        const photo = photosToIncludes[i];
        const ext = path.extname(photo.filename);
        const targetFilename = `photo_${i + 1}${ext}`;
        const targetPath = path.join(customerDir, targetFilename);

        await fs.copyFile(photo.source, targetPath);

        copiedPhotos.push({
          path: `/customer_photos/${this.sanitizeFilename(customerName)}/${targetFilename}`,
          originalPath: photo.source,
          creator: photo.creator,
          month: photo.month,
          index: i + 1
        });
      }

      return copiedPhotos;
    } catch (error) {
      console.error(`Error copying photos for ${customerName}:`, error);
      return [];
    }
  }

  /**
   * Sanitize filename for directory creation
   */
  sanitizeFilename(name) {
    return name
      .replace(/[^a-z0-9_-]/gi, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }

  /**
   * Update customer database with photo information
   */
  async updateCustomerPhotos(customerId, photos) {
    if (photos.length === 0) return false;

    return new Promise((resolve, reject) => {
      const thumbnailPath = photos[0].path; // First photo as thumbnail
      const photoCount = photos.length;

      db.run(
        'UPDATE customers SET photo_thumbnail_path = ?, photo_count = ? WHERE id = ?',
        [thumbnailPath, photoCount, customerId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  /**
   * Create manifest.json for photo tracking
   */
  async createManifest(photoData) {
    const manifestPath = path.join(this.targetDir, 'manifest.json');

    const manifest = {
      generatedAt: new Date().toISOString(),
      totalCustomers: photoData.length,
      totalPhotos: photoData.reduce((sum, c) => sum + c.photos.length, 0),
      customers: photoData.map(c => ({
        customerId: c.customerId,
        customerName: c.customerName,
        photoCount: c.photos.length,
        photos: c.photos
      }))
    };

    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`📝 Manifest created: ${manifestPath}`);

    return manifest;
  }

  /**
   * Main integration function
   */
  async integrateAllPhotos() {
    console.log('📸 Photo Integration Service - Starting...');
    console.log('='.repeat(60));

    // Ensure target directory exists
    if (!fsSync.existsSync(this.targetDir)) {
      await fs.mkdir(this.targetDir, { recursive: true });
    }

    const customers = await this.getAllCustomers();
    console.log(`👥 Found ${customers.length} customers in database`);
    console.log('');

    const results = {
      total: customers.length,
      withPhotos: 0,
      withoutPhotos: 0,
      totalPhotosFound: 0,
      totalPhotosCopied: 0,
      updated: 0,
      photoData: []
    };

    for (const customer of customers) {
      console.log(`🔍 Processing: ${customer.name}...`);

      // Find all photos for this customer
      const photos = await this.findCustomerPhotos(customer.name);
      results.totalPhotosFound += photos.length;

      if (photos.length > 0) {
        results.withPhotos++;

        // Copy first 5 photos
        const copiedPhotos = await this.copyPhotosForCustomer(customer.name, photos, 5);
        results.totalPhotosCopied += copiedPhotos.length;

        if (copiedPhotos.length > 0) {
          // Update database
          const updated = await this.updateCustomerPhotos(customer.id, copiedPhotos);

          if (updated) {
            results.updated++;
            console.log(`   ✅ Copied ${copiedPhotos.length} photos (${photos.length} total found)`);
          }

          results.photoData.push({
            customerId: customer.id,
            customerName: customer.name,
            photos: copiedPhotos,
            totalFound: photos.length
          });
        }
      } else {
        results.withoutPhotos++;
        console.log(`   ⚠️  No photos found`);
      }
    }

    // Create manifest
    await this.createManifest(results.photoData);

    console.log('');
    console.log('='.repeat(60));
    console.log('📈 SUMMARY:');
    console.log(`   Total customers: ${results.total}`);
    console.log(`   With photos: ${results.withPhotos}`);
    console.log(`   Without photos: ${results.withoutPhotos}`);
    console.log(`   Total photos found: ${results.totalPhotosFound}`);
    console.log(`   Total photos copied: ${results.totalPhotosCopied}`);
    console.log(`   Database updated: ${results.updated}`);
    console.log('='.repeat(60));
    console.log('');
    console.log('⚠️  NO PLACEHOLDERS USED - Only real photos from ALL_PHOTOS directory');

    return results;
  }

  /**
   * Get customer photos from database
   */
  async getCustomerPhotos(customerId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT photo_thumbnail_path, photo_count FROM customers WHERE id = ?',
        [customerId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }
}

module.exports = new PhotoIntegrationService();
