// Photo Analysis Service with OCR
// Analyzes customer photos, performs OCR, and checks 80+ photos rule
const fs = require('fs').promises;
const path = require('path');
const Tesseract = require('tesseract.js'); // OCR library
const sharp = require('sharp'); // Image processing
const db = require('./databaseService');

class PhotoAnalysisService {
  constructor() {
    this.supportedFormats = ['.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.gif'];
    this.ocrCache = new Map();
  }

  /**
   * Scan customer folder for photos
   */
  async scanCustomerPhotos(customerId) {
    try {
      const customer = await db.getCustomerById(customerId);
      if (!customer || !customer.folder_path) {
        throw new Error('Customer folder path not found');
      }

      const photosFolder = path.join(customer.folder_path, '02_PHOTOS');

      // Check if folder exists
      try {
        await fs.access(photosFolder);
      } catch {
        console.log(`Photos folder not found for customer ${customerId}`);
        return { photos: [], count: 0 };
      }

      // Get all files in photos folder
      const files = await this.getAllFilesRecursive(photosFolder);

      // Filter for image files
      const photos = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return this.supportedFormats.includes(ext);
      });

      // Analyze each photo
      const analyzedPhotos = [];
      for (const photo of photos) {
        const analysis = await this.analyzePhoto(photo);
        analyzedPhotos.push(analysis);
      }

      // Update customer photo count
      await db.updateCustomer(customerId, {
        photo_count: photos.length
      });

      return {
        photos: analyzedPhotos,
        count: photos.length,
        needsS upplement: photos.length >= 80
      };
    } catch (error) {
      console.error('Photo scan error:', error.message);
      throw error;
    }
  }

  /**
   * Get all files recursively
   */
  async getAllFilesRecursive(dir) {
    const files = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.getAllFilesRecursive(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error.message);
    }

    return files;
  }

  /**
   * Analyze a single photo
   */
  async analyzePhoto(photoPath) {
    try {
      const stats = await fs.stat(photoPath);
      const metadata = await sharp(photoPath).metadata();

      return {
        path: photoPath,
        filename: path.basename(photoPath),
        size: stats.size,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        created: stats.birthtime,
        modified: stats.mtime,
        hasOCR: false,
        ocrText: null
      };
    } catch (error) {
      console.error(`Error analyzing photo ${photoPath}:`, error.message);
      return {
        path: photoPath,
        filename: path.basename(photoPath),
        error: error.message
      };
    }
  }

  /**
   * Perform OCR on a photo
   */
  async performOCR(photoPath) {
    try {
      // Check cache first
      if (this.ocrCache.has(photoPath)) {
        return this.ocrCache.get(photoPath);
      }

      console.log(`🔍 Performing OCR on ${path.basename(photoPath)}...`);

      const result = await Tesseract.recognize(photoPath, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      const ocrData = {
        text: result.data.text,
        confidence: result.data.confidence,
        words: result.data.words.map(w => ({
          text: w.text,
          confidence: w.confidence,
          bbox: w.bbox
        })),
        lines: result.data.lines.map(l => ({
          text: l.text,
          confidence: l.confidence,
          bbox: l.bbox
        }))
      };

      // Cache the result
      this.ocrCache.set(photoPath, ocrData);

      return ocrData;
    } catch (error) {
      console.error(`OCR error for ${photoPath}:`, error.message);
      return {
        text: '',
        confidence: 0,
        error: error.message
      };
    }
  }

  /**
   * Generate thumbnail for a photo
   */
  async generateThumbnail(photoPath, width = 300, height = 300) {
    try {
      const thumbnailBuffer = await sharp(photoPath)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      return thumbnailBuffer;
    } catch (error) {
      console.error(`Thumbnail generation error:`, error.message);
      return null;
    }
  }

  /**
   * Extract metadata from photo
   */
  async extractMetadata(photoPath) {
    try {
      const metadata = await sharp(photoPath).metadata();
      const stats = await fs.stat(photoPath);

      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        space: metadata.space,
        channels: metadata.channels,
        depth: metadata.depth,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation,
        exif: metadata.exif,
        icc: metadata.icc,
        fileSize: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      console.error(`Metadata extraction error:`, error.message);
      return null;
    }
  }

  /**
   * Analyze photos for supplement needs (80+ rule)
   */
  async checkSupplementRule(customerId) {
    try {
      const result = await this.scanCustomerPhotos(customerId);

      return {
        customer_id: customerId,
        photo_count: result.count,
        needs_supplement: result.needsSupplement,
        rule: '80+ photos',
        checked_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Supplement rule check error:', error.message);
      return {
        customer_id: customerId,
        photo_count: 0,
        needs_supplement: false,
        error: error.message
      };
    }
  }

  /**
   * Batch analyze all customers
   */
  async analyzeAllCustomers() {
    try {
      const customers = await db.getAllCustomers(1, 1000);
      const results = [];

      for (const customer of customers.data) {
        console.log(`Analyzing photos for ${customer.name}...`);
        const result = await this.scanCustomerPhotos(customer.id);
        results.push({
          id: customer.id,
          name: customer.name,
          ...result
        });
      }

      return results;
    } catch (error) {
      console.error('Batch analysis error:', error.message);
      throw error;
    }
  }

  /**
   * Get photo annotations
   */
  async getAnnotations(photoPath) {
    try {
      const annotationsPath = photoPath.replace(/\.(jpg|jpeg|png)$/i, '.annotations.json');

      try {
        const data = await fs.readFile(annotationsPath, 'utf8');
        return JSON.parse(data);
      } catch {
        return {
          annotations: [],
          created: null
        };
      }
    } catch (error) {
      console.error('Get annotations error:', error.message);
      return { annotations: [] };
    }
  }

  /**
   * Save photo annotations
   */
  async saveAnnotations(photoPath, annotations) {
    try {
      const annotationsPath = photoPath.replace(/\.(jpg|jpeg|png)$/i, '.annotations.json');

      await fs.writeFile(annotationsPath, JSON.stringify({
        annotations,
        created: new Date().toISOString(),
        photoPath
      }, null, 2));

      return true;
    } catch (error) {
      console.error('Save annotations error:', error.message);
      return false;
    }
  }

  /**
   * Detect damage in photo (simple pixel analysis)
   */
  async detectDamage(photoPath) {
    try {
      const image = sharp(photoPath);
      const { data, info } = await image
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Simple damage detection based on color analysis
      // (This is a placeholder - would need more sophisticated ML for real damage detection)
      const totalPixels = info.width * info.height;
      let darkPixels = 0;
      let brightPixels = 0;

      for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;

        if (brightness < 50) darkPixels++;
        if (brightness > 200) brightPixels++;
      }

      return {
        darkPixelRatio: darkPixels / totalPixels,
        brightPixelRatio: brightPixels / totalPixels,
        possibleDamage: (darkPixels / totalPixels) > 0.3
      };
    } catch (error) {
      console.error('Damage detection error:', error.message);
      return null;
    }
  }
}

// Singleton instance
const photoAnalysis = new PhotoAnalysisService();

module.exports = photoAnalysis;
