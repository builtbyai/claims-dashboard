const fs = require('fs');
const path = require('path');
const ExifParser = require('exif-parser');
const Database = require('better-sqlite3');

/**
 * Photo Indexing Service
 * Scans ALL_PHOTOS directory and indexes photos with metadata
 */
class PhotoIndexer {
  constructor() {
    this.customersDbPath = path.join(__dirname, '..', 'database', 'customers.db');
    this.allPhotosPath = path.join(__dirname, '..', '..', '..', 'sample_data', 'ALL_PHOTOS');
  }

  /**
   * Index all photos and update database
   */
  async indexAllPhotos() {
    console.log('📸 Starting photo indexing...');
    const startTime = Date.now();

    try {
      const db = new Database(this.customersDbPath);

      // Scan photos and extract metadata
      const photoData = await this.scanPhotosDirectory();
      console.log(`📊 Scanned ${photoData.totalPhotos} photos for ${photoData.customers.length} customers`);

      // Determine install dates from photo patterns
      const installDates = this.detectInstallDates(photoData.customers);

      // Update database
      const updateResult = this.updatePhotoInventory(db, photoData.customers, installDates);

      db.close();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      return {
        success: true,
        totalPhotos: photoData.totalPhotos,
        customersProcessed: photoData.customers.length,
        installDatesDetected: installDates.length,
        duration: `${duration}s`,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Photo indexing error:', error);
      throw error;
    }
  }

  /**
   * Scan photos directory and organize by customer
   */
  async scanPhotosDirectory() {
    const customerPhotos = {};
    let totalPhotos = 0;

    try {
      // Scan by_creator directory
      const byCreatorPath = path.join(this.allPhotosPath, 'by_creator');

      if (fs.existsSync(byCreatorPath)) {
        const creators = fs.readdirSync(byCreatorPath);

        for (const creator of creators) {
          const creatorPath = path.join(byCreatorPath, creator);

          if (fs.statSync(creatorPath).isDirectory()) {
            const photos = await this.scanCustomerPhotos(creatorPath, creator);

            if (photos.length > 0) {
              customerPhotos[creator] = {
                name: creator,
                photoCount: photos.length,
                photos: photos,
                photosByDate: this.groupPhotosByDate(photos)
              };
              totalPhotos += photos.length;
            }
          }
        }
      }

      // Also scan by_month for additional organization
      const byMonthPath = path.join(this.allPhotosPath, 'by_month');

      if (fs.existsSync(byMonthPath)) {
        const months = fs.readdirSync(byMonthPath);

        for (const month of months) {
          const monthPath = path.join(byMonthPath, month);

          if (fs.statSync(monthPath).isDirectory()) {
            const creators = fs.readdirSync(monthPath);

            for (const creator of creators) {
              const creatorPath = path.join(monthPath, creator);

              if (fs.statSync(creatorPath).isDirectory()) {
                const photos = await this.scanCustomerPhotos(creatorPath, creator, month);

                if (photos.length > 0) {
                  if (!customerPhotos[creator]) {
                    customerPhotos[creator] = {
                      name: creator,
                      photoCount: 0,
                      photos: [],
                      photosByDate: {},
                      photosByMonth: {}
                    };
                  }

                  // Add month data
                  if (!customerPhotos[creator].photosByMonth) {
                    customerPhotos[creator].photosByMonth = {};
                  }
                  customerPhotos[creator].photosByMonth[month] = photos.length;
                }
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('❌ Error scanning photos directory:', error);
    }

    return {
      customers: Object.values(customerPhotos),
      totalPhotos
    };
  }

  /**
   * Scan individual customer photo directory
   */
  async scanCustomerPhotos(customerPath, customerName, month = null) {
    const photos = [];

    try {
      const files = fs.readdirSync(customerPath);

      for (const file of files) {
        const filePath = path.join(customerPath, file);

        // Check if it's an image file
        if (/\.(jpg|jpeg|png|heic)$/i.test(file)) {
          const stats = fs.statSync(filePath);
          const photoData = {
            filename: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            month: month,
            exifData: null
          };

          // Try to extract EXIF data
          try {
            const exif = await this.extractExifData(filePath);
            if (exif) {
              photoData.exifData = exif;
              photoData.takenDate = exif.createDate || stats.birthtime;
            } else {
              photoData.takenDate = stats.birthtime;
            }
          } catch (exifError) {
            photoData.takenDate = stats.birthtime;
          }

          photos.push(photoData);
        }
      }

    } catch (error) {
      console.error(`❌ Error scanning photos for ${customerName}:`, error.message);
    }

    return photos;
  }

  /**
   * Extract EXIF data from photo
   */
  async extractExifData(photoPath) {
    try {
      const buffer = fs.readFileSync(photoPath);
      const parser = ExifParser.create(buffer);
      const result = parser.parse();

      if (result.tags) {
        return {
          createDate: result.tags.CreateDate ? new Date(result.tags.CreateDate * 1000) : null,
          gps: result.tags.GPSLatitude ? {
            latitude: result.tags.GPSLatitude,
            longitude: result.tags.GPSLongitude
          } : null,
          make: result.tags.Make || null,
          model: result.tags.Model || null,
          width: result.imageSize?.width || null,
          height: result.imageSize?.height || null
        };
      }

      return null;
    } catch (error) {
      // EXIF not available or error reading
      return null;
    }
  }

  /**
   * Group photos by date
   */
  groupPhotosByDate(photos) {
    const grouped = {};

    for (const photo of photos) {
      const dateKey = photo.takenDate.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }

      grouped[dateKey].push(photo);
    }

    return grouped;
  }

  /**
   * Detect install dates based on photo patterns
   * The day with the most roof tear-off photos is likely the install date
   */
  detectInstallDates(customers) {
    const installDates = [];

    for (const customer of customers) {
      if (customer.photosByDate && Object.keys(customer.photosByDate).length > 0) {
        // Find the date with the most photos
        let maxPhotos = 0;
        let installDate = null;

        for (const [date, photos] of Object.entries(customer.photosByDate)) {
          if (photos.length > maxPhotos) {
            maxPhotos = photos.length;
            installDate = date;
          }
        }

        // Consider it an install date if there are at least 5 photos
        if (installDate && maxPhotos >= 5) {
          installDates.push({
            customer: customer.name,
            installDate: installDate,
            photoCount: maxPhotos
          });

          customer.detectedInstallDate = installDate;
        }
      }
    }

    return installDates;
  }

  /**
   * Update photo inventory in database
   */
  updatePhotoInventory(db, customers, installDates) {
    let updated = 0;

    try {
      // Ensure photo_inventory table exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS photo_inventory (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER,
          customer_name TEXT UNIQUE,
          photo_count INTEGER DEFAULT 0,
          install_date_from_photos TEXT,
          photos_by_date TEXT,
          last_scan_date TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
      `);

      const upsertStmt = db.prepare(`
        INSERT INTO photo_inventory (
          customer_name, photo_count, install_date_from_photos,
          photos_by_date, last_scan_date
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(customer_name) DO UPDATE SET
          photo_count = excluded.photo_count,
          install_date_from_photos = excluded.install_date_from_photos,
          photos_by_date = excluded.photos_by_date,
          last_scan_date = excluded.last_scan_date
      `);

      for (const customer of customers) {
        const installDate = customer.detectedInstallDate || null;
        const photosByDate = JSON.stringify(
          Object.fromEntries(
            Object.entries(customer.photosByDate || {}).map(([date, photos]) => [
              date,
              photos.length
            ])
          )
        );

        upsertStmt.run(
          customer.name,
          customer.photoCount,
          installDate,
          photosByDate,
          new Date().toISOString()
        );

        updated++;
      }

      // Also update customers table with photo counts and install dates
      this.updateCustomerPhotoData(db, customers);

      console.log(`✅ Photo inventory updated for ${updated} customers`);

    } catch (error) {
      console.error('❌ Error updating photo inventory:', error);
    }

    return { updated };
  }

  /**
   * Update customers table with photo data
   */
  updateCustomerPhotoData(db, customers) {
    try {
      const updateStmt = db.prepare(`
        UPDATE customers
        SET photo_count = ?,
            install_date = ?
        WHERE LOWER(homeowner_name) LIKE ?
      `);

      for (const customer of customers) {
        const nameLike = `%${customer.name.toLowerCase().replace(/_/g, ' ')}%`;

        updateStmt.run(
          customer.photoCount,
          customer.detectedInstallDate || null,
          nameLike
        );
      }
    } catch (error) {
      console.error('❌ Error updating customer photo data:', error);
    }
  }

  /**
   * Get photo summary for a customer
   */
  getCustomerPhotoSummary(customerName) {
    try {
      const db = new Database(this.customersDbPath);

      const summary = db.prepare(`
        SELECT * FROM photo_inventory
        WHERE customer_name = ?
      `).get(customerName);

      db.close();

      if (summary && summary.photos_by_date) {
        summary.photos_by_date = JSON.parse(summary.photos_by_date);
      }

      return summary;
    } catch (error) {
      console.error('❌ Error getting photo summary:', error);
      return null;
    }
  }

  /**
   * Get all customers with high photo counts (>80 photos)
   */
  getHighPhotoCounts(threshold = 80) {
    try {
      const db = new Database(this.customersDbPath);

      const customers = db.prepare(`
        SELECT customer_name, photo_count, install_date_from_photos
        FROM photo_inventory
        WHERE photo_count >= ?
        ORDER BY photo_count DESC
      `).all(threshold);

      db.close();

      return customers;
    } catch (error) {
      console.error('❌ Error getting high photo counts:', error);
      return [];
    }
  }
}

module.exports = PhotoIndexer;
