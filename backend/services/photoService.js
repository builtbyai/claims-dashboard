const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

/**
 * PHOTO SERVICE
 *
 * Manages customer photos:
 * - Scans customer profile directories for photos
 * - Copies photos to public directory for frontend access
 * - Creates thumbnails
 * - Updates database with photo information
 * - Generates photo manifest
 */

class PhotoService {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '../../database/master.db');
    this.customerProfilesPath = './data/customer_profiles';
    this.publicPhotosPath = path.join(__dirname, '../../frontend/public/customer_photos');
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Ensure public photos directory exists
   */
  ensurePhotosDirectory(customerId) {
    const customerPhotoDir = path.join(this.publicPhotosPath, customerId.toString());

    if (!fs.existsSync(this.publicPhotosPath)) {
      fs.mkdirSync(this.publicPhotosPath, { recursive: true });
    }

    if (!fs.existsSync(customerPhotoDir)) {
      fs.mkdirSync(customerPhotoDir, { recursive: true });
    }

    return customerPhotoDir;
  }

  /**
   * Find photos in customer profile directory
   */
  findCustomerPhotos(customerFolder) {
    const photos = [];
    const photosDir = path.join(customerFolder, 'CUSTOMER_FILES', '02_PHOTOS');

    if (!fs.existsSync(photosDir)) {
      return photos;
    }

    const walkDir = (dir) => {
      const files = fs.readdirSync(dir);

      files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (/\.(jpg|jpeg|png|gif)$/i.test(file)) {
          photos.push({
            fileName: file,
            filePath: fullPath,
            fileSize: stat.size
          });
        }
      });
    };

    walkDir(photosDir);
    return photos;
  }

  /**
   * Copy photo to public directory
   */
  copyPhotoToPublic(sourcePath, customerId, fileName) {
    try {
      const destDir = this.ensurePhotosDirectory(customerId);
      const destPath = path.join(destDir, fileName);

      fs.copyFileSync(sourcePath, destPath);

      // Return relative path for frontend
      return `/customer_photos/${customerId}/${fileName}`;
    } catch (error) {
      console.error(`Error copying photo ${fileName}:`, error.message);
      return null;
    }
  }

  /**
   * Generate placeholder image using SVG
   */
  generatePlaceholderImage(customerId, customerName, index) {
    const colors = [
      { bg: '#1976d2', text: '#ffffff' },
      { bg: '#dc004e', text: '#ffffff' },
      { bg: '#4caf50', text: '#ffffff' },
      { bg: '#ff9800', text: '#ffffff' },
      { bg: '#9c27b0', text: '#ffffff' }
    ];

    const color = colors[index % colors.length];
    const initials = customerName
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="${color.bg}"/>
  <text x="50%" y="40%" font-family="Arial, sans-serif" font-size="80" fill="${color.text}" text-anchor="middle" dominant-baseline="middle">
    ${initials}
  </text>
  <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="20" fill="${color.text}" text-anchor="middle" dominant-baseline="middle">
    ${customerName}
  </text>
  <text x="50%" y="75%" font-family="Arial, sans-serif" font-size="16" fill="${color.text}" text-anchor="middle" dominant-baseline="middle" opacity="0.7">
    Photo ${index + 1}
  </text>
</svg>`;

    const destDir = this.ensurePhotosDirectory(customerId);
    const fileName = `placeholder_${index + 1}.svg`;
    const destPath = path.join(destDir, fileName);

    fs.writeFileSync(destPath, svg, 'utf8');

    return `/customer_photos/${customerId}/${fileName}`;
  }

  /**
   * Process photos for a single customer
   */
  async processCustomerPhotos(customer) {
    const customerFolder = path.join(
      this.customerProfilesPath,
      customer.normalized_name.toUpperCase().replace(/ /g, '_')
    );

    console.log(`Processing photos for: ${customer.name}`);

    // Find actual photos
    let photos = this.findCustomerPhotos(customerFolder);
    let photoCount = photos.length;

    // If no actual photos found, generate placeholders based on photo_count from database
    if (photoCount === 0 && customer.photo_count > 0) {
      console.log(`  No actual photos found, generating ${Math.min(customer.photo_count, 3)} placeholders`);

      const placeholderCount = Math.min(customer.photo_count, 3);
      photos = [];

      for (let i = 0; i < placeholderCount; i++) {
        const photoPath = this.generatePlaceholderImage(customer.id, customer.name, i);
        photos.push({
          fileName: `placeholder_${i + 1}.svg`,
          filePath: photoPath,
          fileSize: 0,
          isPlaceholder: true
        });
      }
    } else {
      // Copy up to 3 actual photos
      const photosToProcess = photos.slice(0, 3);

      photos = photosToProcess.map(photo => {
        const publicPath = this.copyPhotoToPublic(photo.filePath, customer.id, photo.fileName);
        return {
          fileName: photo.fileName,
          filePath: publicPath,
          fileSize: photo.fileSize,
          isPlaceholder: false
        };
      });
    }

    // Insert photos into database
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];

      await new Promise((resolve, reject) => {
        this.db.run(`
          INSERT INTO photos (
            customer_id, file_name, file_path, file_size,
            category, is_primary, display_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          customer.id,
          photo.fileName,
          photo.filePath,
          photo.fileSize,
          photo.isPlaceholder ? 'placeholder' : 'actual',
          i === 0 ? 1 : 0,  // First photo is primary
          i
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Update customer with primary photo path
    if (photos.length > 0) {
      await new Promise((resolve, reject) => {
        this.db.run(`
          UPDATE customers
          SET photo_thumbnail_path = ?
          WHERE id = ?
        `, [photos[0].filePath, customer.id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    console.log(`  ✓ Processed ${photos.length} photos for ${customer.name}`);

    return photos.length;
  }

  /**
   * Process all customers
   */
  async processAllCustomers() {
    console.log('='.repeat(70));
    console.log('PHOTO PROCESSING STARTED');
    console.log('='.repeat(70));

    const startTime = Date.now();
    let processedCount = 0;
    let totalPhotos = 0;

    try {
      // Get all customers
      const customers = await new Promise((resolve, reject) => {
        this.db.all('SELECT * FROM customers ORDER BY name', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      console.log(`\nFound ${customers.length} customers\n`);

      // Process each customer
      for (const customer of customers) {
        try {
          const photoCount = await this.processCustomerPhotos(customer);
          processedCount++;
          totalPhotos += photoCount;
        } catch (error) {
          console.error(`  ✗ Error processing ${customer.name}: ${error.message}`);
        }
      }

      // Generate photo manifest
      const manifest = await this.generatePhotoManifest();

      // Log sync activity
      const endTime = Date.now();
      const durationSeconds = Math.round((endTime - startTime) / 1000);

      await new Promise((resolve, reject) => {
        this.db.run(`
          INSERT INTO sync_log (
            sync_type, sync_status, records_processed, records_created,
            start_time, end_time, duration_seconds, details, triggered_by
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?, ?)
        `, [
          'photo_processing',
          'completed',
          processedCount,
          totalPhotos,
          durationSeconds,
          JSON.stringify({
            total_photos: totalPhotos,
            manifest_path: path.join(this.publicPhotosPath, 'manifest.json')
          }),
          'manual'
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log('\n' + '='.repeat(70));
      console.log('PHOTO PROCESSING COMPLETED');
      console.log('='.repeat(70));
      console.log(`Customers processed: ${processedCount}`);
      console.log(`Total photos: ${totalPhotos}`);
      console.log(`Duration: ${durationSeconds} seconds`);
      console.log(`Manifest: ${this.publicPhotosPath}/manifest.json`);
      console.log('='.repeat(70));

      return {
        processed: processedCount,
        totalPhotos: totalPhotos,
        duration: durationSeconds
      };

    } catch (error) {
      console.error('Fatal error during photo processing:', error);
      throw error;
    }
  }

  /**
   * Generate photo manifest JSON for frontend
   */
  async generatePhotoManifest() {
    const manifest = {};

    const customers = await new Promise((resolve, reject) => {
      this.db.all(`
        SELECT
          c.id,
          c.name,
          c.normalized_name,
          c.photo_thumbnail_path,
          COUNT(p.id) as photo_count
        FROM customers c
        LEFT JOIN photos p ON c.id = p.customer_id
        GROUP BY c.id
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    for (const customer of customers) {
      const photos = await new Promise((resolve, reject) => {
        this.db.all(`
          SELECT file_name, file_path, category, is_primary, display_order
          FROM photos
          WHERE customer_id = ?
          ORDER BY display_order
        `, [customer.id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      manifest[customer.id] = {
        customerId: customer.id,
        customerName: customer.name,
        thumbnailPath: customer.photo_thumbnail_path,
        photoCount: customer.photo_count,
        photos: photos
      };
    }

    // Write manifest to public directory
    const manifestPath = path.join(this.publicPhotosPath, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    console.log(`\n✓ Photo manifest generated: ${manifestPath}`);

    return manifest;
  }
}

// Export for use as module
module.exports = PhotoService;

// Run directly if called from command line
if (require.main === module) {
  (async () => {
    const photoService = new PhotoService();

    try {
      await photoService.connect();
      await photoService.processAllCustomers();
      await photoService.close();
      process.exit(0);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  })();
}
