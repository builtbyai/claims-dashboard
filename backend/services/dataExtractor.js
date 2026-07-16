const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Database = require('better-sqlite3');

/**
 * Data Extraction Service
 * Extracts customer and financial data from CSV files and customer folders
 */
class DataExtractor {
  constructor() {
    this.customersDbPath = path.join(__dirname, '..', 'database', 'customers.db');
    this.csvBasePath = path.join(__dirname, '..', '..', '..', 'sample_data');
    this.allPhotosPath = path.join(this.csvBasePath, 'ALL_PHOTOS');

    // CSV files to process
    this.csvFiles = [
      'google-2025-10-16.csv',
      'insurance_claims_supplements_oct_jul_2025_COMPLETE.csv'
    ];
  }

  /**
   * Extract all data from CSV files and update database
   */
  async extractAllData() {
    console.log('🔍 Starting data extraction...');
    const startTime = Date.now();

    try {
      const db = new Database(this.customersDbPath);

      // Process insurance claims CSV (primary data source)
      const claimsData = await this.processInsuranceClaimsCsv();
      console.log(`📊 Extracted ${claimsData.length} claims from insurance CSV`);

      // Extract photo counts from ALL_PHOTOS directory
      const photoCounts = await this.extractPhotoCounts();
      console.log(`📸 Extracted photo counts for ${Object.keys(photoCounts).length} customers`);

      // Merge data and update database
      const mergedData = this.mergeDataSources(claimsData, photoCounts);
      const updateResult = this.updateDatabase(db, mergedData);

      db.close();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      return {
        success: true,
        recordsProcessed: claimsData.length,
        recordsUpdated: updateResult.updated,
        recordsInserted: updateResult.inserted,
        duration: `${duration}s`,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Data extraction error:', error);
      throw error;
    }
  }

  /**
   * Process insurance claims CSV file
   */
  async processInsuranceClaimsCsv() {
    const csvPath = path.join(this.csvBasePath, 'insurance_claims_supplements_oct_jul_2025_COMPLETE.csv');

    return new Promise((resolve, reject) => {
      const results = [];

      if (!fs.existsSync(csvPath)) {
        console.warn(`⚠️  CSV file not found: ${csvPath}`);
        resolve([]);
        return;
      }

      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          // Skip template rows
          if (row.Homeowner_Insured && row.Homeowner_Insured.includes('[')) {
            return;
          }

          // Extract relevant data
          const record = {
            claimNumber: row.Claim_Number || null,
            insuranceCompany: row.Insurance_Company || 'Unknown',
            homeownerName: row.Homeowner_Insured || 'Unknown',
            propertyAddress: this.formatAddress(row),
            adjusterName: row.Adjuster_Name || null,
            status: row.Status_Action || 'Unknown',
            lossDate: row.Loss_Date || null,
            jobId: row.Job_ID || null,
            contactPhone: row.Contact_Phone || null,
            contactEmail: row.Contact_Email || null,
            notes: row.Notes || null,
            supplementNotes: row.Supplement_Notes || null,
            rcvAmount: this.extractRcvAmount(row.Supplement_Notes),
            supplementDate: row.Date || null,
            monthProcessed: row.Month || null
          };

          if (record.homeownerName !== 'Unknown') {
            results.push(record);
          }
        })
        .on('end', () => {
          console.log(`✅ Processed ${results.length} records from insurance claims CSV`);
          resolve(results);
        })
        .on('error', reject);
    });
  }

  /**
   * Format address from CSV row
   */
  formatAddress(row) {
    const parts = [
      row.Property_Address,
      row.City,
      row.State,
      row.Zip
    ].filter(p => p && p !== 'N/A' && p.trim() !== '');

    return parts.length > 0 ? parts.join(', ') : null;
  }

  /**
   * Extract RCV amount from supplement notes
   */
  extractRcvAmount(supplementNotes) {
    if (!supplementNotes) return null;

    // Look for dollar amounts in the notes
    const dollarMatch = supplementNotes.match(/\$[\d,]+\.?\d*/);
    if (dollarMatch) {
      return parseFloat(dollarMatch[0].replace(/[$,]/g, ''));
    }

    // Look for "Supplement value:" pattern
    const valueMatch = supplementNotes.match(/Supplement value:\s*\$?([\d,]+\.?\d*)/i);
    if (valueMatch) {
      return parseFloat(valueMatch[1].replace(/,/g, ''));
    }

    return null;
  }

  /**
   * Extract photo counts from ALL_PHOTOS directory
   */
  async extractPhotoCounts() {
    const photoCounts = {};

    try {
      // Check if ALL_PHOTOS exists
      if (!fs.existsSync(this.allPhotosPath)) {
        console.warn('⚠️  ALL_PHOTOS directory not found');
        return photoCounts;
      }

      // Check by_month directory for organized photos
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
                const photos = fs.readdirSync(creatorPath).filter(file =>
                  /\.(jpg|jpeg|png|heic)$/i.test(file)
                );

                if (photos.length > 0) {
                  if (!photoCounts[creator]) {
                    photoCounts[creator] = { total: 0, byMonth: {} };
                  }
                  photoCounts[creator].total += photos.length;
                  photoCounts[creator].byMonth[month] = photos.length;
                }
              }
            }
          }
        }
      }

      // Also check by_creator directory
      const byCreatorPath = path.join(this.allPhotosPath, 'by_creator');
      if (fs.existsSync(byCreatorPath)) {
        const creators = fs.readdirSync(byCreatorPath);

        for (const creator of creators) {
          const creatorPath = path.join(byCreatorPath, creator);
          if (fs.statSync(creatorPath).isDirectory()) {
            const photos = fs.readdirSync(creatorPath).filter(file =>
              /\.(jpg|jpeg|png|heic)$/i.test(file)
            );

            if (photos.length > 0) {
              if (!photoCounts[creator]) {
                photoCounts[creator] = { total: 0, byMonth: {} };
              }
              // Only update if not already counted
              if (photoCounts[creator].total === 0) {
                photoCounts[creator].total = photos.length;
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('❌ Error extracting photo counts:', error);
    }

    return photoCounts;
  }

  /**
   * Merge data from different sources
   */
  mergeDataSources(claimsData, photoCounts) {
    return claimsData.map(claim => {
      // Try to find matching photo count by name
      const nameKey = claim.homeownerName.toLowerCase().replace(/\s+/g, '_');
      const photoData = Object.entries(photoCounts).find(([key]) =>
        key.toLowerCase().includes(nameKey) || nameKey.includes(key.toLowerCase())
      );

      return {
        ...claim,
        photoCount: photoData ? photoData[1].total : 0,
        photosByMonth: photoData ? photoData[1].byMonth : {}
      };
    });
  }

  /**
   * Update database with extracted data
   */
  updateDatabase(db, data) {
    let updated = 0;
    let inserted = 0;

    try {
      // Ensure tables exist
      this.ensureTables(db);

      const upsertStmt = db.prepare(`
        INSERT INTO customers (
          job_id, claim_number, insurance_company, homeowner_name,
          property_address, adjuster_name, status, loss_date,
          contact_phone, contact_email, rcv_amount, photo_count,
          supplement_date, supplement_notes, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(job_id) DO UPDATE SET
          claim_number = excluded.claim_number,
          insurance_company = excluded.insurance_company,
          homeowner_name = excluded.homeowner_name,
          property_address = excluded.property_address,
          adjuster_name = excluded.adjuster_name,
          status = excluded.status,
          loss_date = excluded.loss_date,
          contact_phone = excluded.contact_phone,
          contact_email = excluded.contact_email,
          rcv_amount = excluded.rcv_amount,
          photo_count = excluded.photo_count,
          supplement_date = excluded.supplement_date,
          supplement_notes = excluded.supplement_notes,
          last_updated = excluded.last_updated
      `);

      const insertTransaction = db.transaction((records) => {
        for (const record of records) {
          const jobId = record.jobId || `MANUAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          const result = upsertStmt.run(
            jobId,
            record.claimNumber,
            record.insuranceCompany,
            record.homeownerName,
            record.propertyAddress,
            record.adjusterName,
            record.status,
            record.lossDate,
            record.contactPhone,
            record.contactEmail,
            record.rcvAmount,
            record.photoCount,
            record.supplementDate,
            record.supplementNotes,
            new Date().toISOString()
          );

          if (result.changes > 0) {
            if (record.jobId) {
              updated++;
            } else {
              inserted++;
            }
          }
        }
      });

      insertTransaction(data);

      console.log(`✅ Database updated: ${updated} records updated, ${inserted} records inserted`);

    } catch (error) {
      console.error('❌ Database update error:', error);
      throw error;
    }

    return { updated, inserted };
  }

  /**
   * Ensure required tables exist
   */
  ensureTables(db) {
    // Create customers table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT UNIQUE,
        claim_number TEXT,
        insurance_company TEXT,
        homeowner_name TEXT NOT NULL,
        property_address TEXT,
        adjuster_name TEXT,
        status TEXT,
        loss_date TEXT,
        contact_phone TEXT,
        contact_email TEXT,
        rcv_amount REAL,
        collected_amount REAL DEFAULT 0,
        outstanding_balance REAL,
        photo_count INTEGER DEFAULT 0,
        install_date TEXT,
        supplement_date TEXT,
        supplement_notes TEXT,
        days_supplementing INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_updated TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create financial_data table
    db.exec(`
      CREATE TABLE IF NOT EXISTS financial_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        rcv_amount REAL,
        collected_amount REAL DEFAULT 0,
        outstanding_balance REAL,
        first_payment_date TEXT,
        last_payment_date TEXT,
        payment_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    `);

    // Create photo_inventory table
    db.exec(`
      CREATE TABLE IF NOT EXISTS photo_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        customer_name TEXT,
        photo_count INTEGER DEFAULT 0,
        install_date_from_photos TEXT,
        last_scan_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    `);

    // Create sync_log table
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_timestamp TEXT NOT NULL,
        records_updated INTEGER DEFAULT 0,
        records_inserted INTEGER DEFAULT 0,
        errors TEXT,
        duration TEXT,
        status TEXT DEFAULT 'success',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Log sync operation to database
   */
  logSync(db, result) {
    try {
      const stmt = db.prepare(`
        INSERT INTO sync_log (
          sync_timestamp, records_updated, records_inserted,
          errors, duration, status
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        result.timestamp,
        result.recordsUpdated || 0,
        result.recordsInserted || 0,
        result.errors || null,
        result.duration || '0s',
        result.success ? 'success' : 'failed'
      );
    } catch (error) {
      console.error('❌ Error logging sync:', error);
    }
  }

  /**
   * Calculate days supplementing for each customer
   */
  calculateDaysSupplementing(db) {
    try {
      const customers = db.prepare('SELECT id, supplement_date FROM customers WHERE supplement_date IS NOT NULL').all();

      const updateStmt = db.prepare('UPDATE customers SET days_supplementing = ? WHERE id = ?');

      for (const customer of customers) {
        const supplementDate = new Date(customer.supplement_date);
        const today = new Date();
        const diffTime = Math.abs(today - supplementDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        updateStmt.run(diffDays, customer.id);
      }

      console.log(`✅ Updated days_supplementing for ${customers.length} customers`);
    } catch (error) {
      console.error('❌ Error calculating days supplementing:', error);
    }
  }
}

module.exports = DataExtractor;
