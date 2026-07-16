const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('../config/database');

/**
 * CSV Install Date Parser Service
 * Extracts install dates from google-2025-10-16.csv by parsing email content
 * for roof installation keywords and timestamps
 */

class CSVInstallDateParser {
  constructor() {
    this.csvPath = path.join(__dirname, '..', '..', '..', 'sample_data', 'google-2025-10-16.csv');
    this.jsonPath = path.join(__dirname, '..', '..', '..', 'sample_data', 'INSTALL_DATES_EXTRACTED.json');
    this.installKeywords = [
      'install',
      'installation',
      'tear off',
      'roofing crew',
      'shingles delivered',
      'roof installation day',
      'installation complete',
      'crew arrived',
      'installation scheduled'
    ];
  }

  /**
   * Load extracted install dates from JSON file
   */
  loadExtractedDates() {
    try {
      if (fs.existsSync(this.jsonPath)) {
        const data = fs.readFileSync(this.jsonPath, 'utf8');
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Error loading extracted install dates:', error);
      return null;
    }
  }

  /**
   * Parse date string to YYYY-MM-DD format
   */
  parseDate(dateStr) {
    try {
      // Handle formats like "Oct 16" or "Sep 23"
      const months = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };

      const parts = dateStr.trim().split(' ');
      if (parts.length === 2) {
        const month = months[parts[0]];
        const day = parts[1].padStart(2, '0');
        // Assume 2025 as the year from context
        return `2025-${month}-${day}`;
      }

      return null;
    } catch (error) {
      console.error('Error parsing date:', dateStr, error);
      return null;
    }
  }

  /**
   * Match customer name from database
   */
  async matchCustomer(extractedName) {
    if (!extractedName) return null;

    try {
      // Try exact match first
      const exactMatch = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id, name FROM customers WHERE LOWER(name) = LOWER(?)',
          [extractedName.trim()],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (exactMatch) return exactMatch;

      // Try partial match (for cases like "Ca" matching "CaSandra")
      const partialMatch = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id, name FROM customers WHERE LOWER(name) LIKE LOWER(?)',
          [`${extractedName.trim()}%`],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (partialMatch) return partialMatch;

      // Try last name match
      const lastNameMatch = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id, name FROM customers WHERE LOWER(name) LIKE LOWER(?)',
          [`% ${extractedName.trim()}%`],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      return lastNameMatch || null;
    } catch (error) {
      console.error('Error matching customer:', extractedName, error);
      return null;
    }
  }

  /**
   * Update customer install date in database
   */
  async updateInstallDate(customerId, installDate) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE customers SET install_date = ? WHERE id = ?',
        [installDate, customerId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  /**
   * Parse CSV and update database with install dates
   */
  async parseAndUpdate() {
    console.log('🔍 CSV Install Date Parser - Starting...');
    console.log('='.repeat(60));

    const extractedData = this.loadExtractedDates();

    if (!extractedData) {
      console.error('❌ No extracted install dates found');
      return { success: false, error: 'No extracted data found' };
    }

    const results = {
      total_extracted: extractedData.total_install_dates_found,
      customers_found: 0,
      customers_matched: 0,
      customers_updated: 0,
      updates: [],
      unmatched: []
    };

    console.log(`📊 Total install dates extracted: ${extractedData.total_install_dates_found}`);
    console.log(`👥 Unique customers: ${extractedData.unique_customers}`);
    console.log('');

    // Process each customer with extracted dates
    for (const [customerName, installRecords] of Object.entries(extractedData.customers)) {
      results.customers_found++;

      // Use the most recent install date if multiple exist
      const mostRecentRecord = installRecords.sort((a, b) =>
        new Date(b.install_date) - new Date(a.install_date)
      )[0];

      const installDate = mostRecentRecord.install_date;

      // Match customer in database
      const customer = await this.matchCustomer(customerName);

      if (customer) {
        results.customers_matched++;

        // Update install date
        const updated = await this.updateInstallDate(customer.id, installDate);

        if (updated) {
          results.customers_updated++;
          results.updates.push({
            customer_id: customer.id,
            customer_name: customer.name,
            extracted_name: customerName,
            install_date: installDate,
            email_date: mostRecentRecord.email_date
          });

          console.log(`✅ Updated: ${customer.name} → Install Date: ${installDate}`);
        }
      } else {
        results.unmatched.push({
          extracted_name: customerName,
          install_date: installDate,
          email_date: mostRecentRecord.email_date
        });

        console.log(`⚠️  No match found: ${customerName} (${installDate})`);
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('📈 SUMMARY:');
    console.log(`   Total extracted: ${results.total_extracted}`);
    console.log(`   Customers found: ${results.customers_found}`);
    console.log(`   Successfully matched: ${results.customers_matched}`);
    console.log(`   Database updated: ${results.customers_updated}`);
    console.log(`   Unmatched: ${results.unmatched.length}`);
    console.log('='.repeat(60));

    return { success: true, results };
  }

  /**
   * Get all customers with install dates
   */
  async getCustomersWithInstallDates() {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT id, name, install_date FROM customers WHERE install_date IS NOT NULL ORDER BY install_date DESC',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
}

module.exports = new CSVInstallDateParser();
