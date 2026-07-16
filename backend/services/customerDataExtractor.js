const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

/**
 * COMPREHENSIVE CUSTOMER DATA EXTRACTOR
 *
 * Parses ALL text files in CUSTOMER_PROFILES and extracts:
 * - Policy information from POLICY_DECLARATION.txt
 * - Claim details from CLAIM_INFO.txt
 * - Financial data from DETAILED_ESTIMATE.txt
 * - Supplement info from SUPPLEMENT_REQUEST.txt
 * - Photo counts from PHOTO_INVENTORY.txt
 * - Summary data from QUICK_REFERENCE.txt
 */

class CustomerDataExtractor {
  constructor(dbPath, customerProfilesPath) {
    this.dbPath = dbPath || path.join(__dirname, '../../database/master.db');
    this.customerProfilesPath = customerProfilesPath ||
      './data/customer_profiles';
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
   * Extract policy data from POLICY_DECLARATION.txt
   */
  extractPolicyData(content) {
    const data = {};

    // Extract policy number: POL-XXXXXX
    const policyMatch = content.match(/Policy Number:\s*(POL-\d+)/i);
    if (policyMatch) data.policy_number = policyMatch[1];

    // Extract insurance company
    const companyMatch = content.match(/Insurance Company:\s*(.+)/i);
    if (companyMatch) data.policy_company = companyMatch[1].trim();

    // Extract coverage type
    const coverageTypeMatch = content.match(/Coverage Type:\s*(.+)/i);
    if (coverageTypeMatch) data.coverage_type = coverageTypeMatch[1].trim();

    // Extract dwelling coverage
    const dwellingMatch = content.match(/Dwelling:\s*\$?([\d,]+)/i);
    if (dwellingMatch) data.coverage_dwelling = parseFloat(dwellingMatch[1].replace(/,/g, ''));

    // Extract deductibles
    const windHailMatch = content.match(/Wind\/Hail:\s*\$?([\d,]+)/i);
    if (windHailMatch) data.deductible_wind_hail = parseFloat(windHailMatch[1].replace(/,/g, ''));

    const otherMatch = content.match(/All Other Perils:\s*\$?([\d,]+)/i);
    if (otherMatch) data.deductible_other = parseFloat(otherMatch[1].replace(/,/g, ''));

    // Extract dates
    const effectiveMatch = content.match(/Effective Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (effectiveMatch) data.policy_effective_date = effectiveMatch[1];

    const expirationMatch = content.match(/Expiration Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (expirationMatch) data.policy_expiration_date = expirationMatch[1];

    return data;
  }

  /**
   * Extract claim data from CLAIM_INFO.txt
   */
  extractClaimData(content) {
    const data = {};

    // Extract claim number: CLM-XXXXXX
    const claimMatch = content.match(/Claim Number:\s*(CLM-\d+)/i);
    if (claimMatch) data.claim_number = claimMatch[1];

    // Extract date of loss
    const dateMatch = content.match(/Date of Loss:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (dateMatch) data.date_of_loss = dateMatch[1];

    // Extract loss type
    const lossTypeMatch = content.match(/Type of Loss:\s*(.+)/i);
    if (lossTypeMatch) data.loss_type = lossTypeMatch[1].trim();

    // Extract claim status
    const statusMatch = content.match(/Claim Status:\s*(.+)/i);
    if (statusMatch) data.claim_status = statusMatch[1].trim();

    // Extract adjuster information
    const adjusterNameMatch = content.match(/Name:\s*(.+)/i);
    if (adjusterNameMatch) data.adjuster_name = adjusterNameMatch[1].trim();

    const adjusterPhoneMatch = content.match(/Phone:\s*([\(\)\d\s\-\.]+)/i);
    if (adjusterPhoneMatch) data.adjuster_phone = adjusterPhoneMatch[1].trim();

    const adjusterEmailMatch = content.match(/Email:\s*([^\s]+@[^\s]+)/i);
    if (adjusterEmailMatch) data.adjuster_email = adjusterEmailMatch[1].trim();

    // Extract initial estimate
    const estimateMatch = content.match(/Total:\s*\$?([\d,]+)/i);
    if (estimateMatch) data.initial_estimate_amount = parseFloat(estimateMatch[1].replace(/,/g, ''));

    // Extract deductible
    const deductibleMatch = content.match(/DEDUCTIBLE:\s*\$?([\d,]+)/i);
    if (deductibleMatch) data.deductible_applied = parseFloat(deductibleMatch[1].replace(/,/g, ''));

    return data;
  }

  /**
   * Extract financial data from DETAILED_ESTIMATE.txt
   */
  extractEstimateData(content) {
    const data = {};

    // Extract total estimate (RCV amount)
    const totalMatch = content.match(/TOTAL ESTIMATE:\s*\$?([\d,]+)/i);
    if (totalMatch) {
      data.rcv_amount = parseFloat(totalMatch[1].replace(/,/g, ''));
    }

    // Extract contractor name (should be Summit Exteriors)
    const contractorMatch = content.match(/Estimate prepared by:\s*(.+)/i);
    if (contractorMatch) data.contractor_name = contractorMatch[1].trim();

    // Calculate outstanding balance (if not already set)
    if (data.rcv_amount && !data.outstanding_balance) {
      data.outstanding_balance = data.rcv_amount;
    }

    return data;
  }

  /**
   * Extract supplement data from SUPPLEMENT_REQUEST.txt
   */
  extractSupplementData(content) {
    const data = {};

    // Extract supplement amount
    const amountMatch = content.match(/TOTAL SUPPLEMENT:\s*\$?([\d,]+)/i);
    if (amountMatch) {
      data.supplement_amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }

    // Extract supplement date
    const dateMatch = content.match(/Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (dateMatch) {
      data.supplement_date = dateMatch[1];
    }

    // Extract supplement status
    const statusMatch = content.match(/Status:\s*(.+)/i);
    if (statusMatch) {
      data.supplement_status = statusMatch[1].trim();
    }

    // Extract reason
    const reasonMatch = content.match(/Reason:\s*(.+)/i);
    if (reasonMatch) {
      data.supplement_reason = reasonMatch[1].trim();
    }

    return data;
  }

  /**
   * Extract photo counts from PHOTO_INVENTORY.txt
   */
  extractPhotoData(content) {
    const data = {};

    // Extract total photo count
    const totalMatch = content.match(/Total Photos:\s*(\d+)/i);
    if (totalMatch) {
      data.photo_count = parseInt(totalMatch[1]);
    }

    // Extract categories and counts
    const categories = [];
    const categoryRegex = /(\w+):\s*(\d+)\s*photos?/gi;
    let match;
    while ((match = categoryRegex.exec(content)) !== null) {
      categories.push({
        name: match[1],
        count: parseInt(match[2])
      });
    }

    if (categories.length > 0) {
      data.photo_categories = JSON.stringify(categories);
    }

    return data;
  }

  /**
   * Extract summary data from QUICK_REFERENCE.txt
   */
  extractQuickReferenceData(content) {
    const data = {};

    // This file usually has key summary info
    // Extract any additional data not found in other files

    return data;
  }

  /**
   * Calculate days since loss
   */
  calculateDaysSinceLoss(dateOfLoss) {
    if (!dateOfLoss) return 0;

    const lossDate = new Date(dateOfLoss);
    const today = new Date();
    const diffTime = Math.abs(today - lossDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Determine kanban stage based on data
   */
  determineKanbanStage(data) {
    if (data.completion_date) return 'complete';
    if (data.install_date) return 'scheduled';
    if (data.supplement_status && data.supplement_status.toLowerCase().includes('approved')) return 'approved';
    if (data.supplement_amount || data.supplement_date) return 'submitted';
    return 'needs_supplement';
  }

  /**
   * Read file content safely
   */
  readFileContent(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      }
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error.message);
    }
    return '';
  }

  /**
   * Extract all data for a single customer
   */
  async extractCustomerData(customerFolder) {
    const customerName = path.basename(customerFolder);
    const filesPath = path.join(customerFolder, 'CUSTOMER_FILES');

    console.log(`\nExtracting data for: ${customerName}`);

    // Initialize combined data object
    const customerData = {
      name: customerName.replace(/_/g, ' '),
      normalized_name: customerName.toLowerCase().replace(/_/g, ' ')
    };

    // Extract from POLICY_DECLARATION.txt
    const policyPath = path.join(filesPath, '01_POLICY_DOCUMENTS', 'POLICY_DECLARATION.txt');
    const policyContent = this.readFileContent(policyPath);
    if (policyContent) {
      Object.assign(customerData, this.extractPolicyData(policyContent));
      console.log(`  ✓ Policy data extracted: ${customerData.policy_number || 'N/A'}`);
    }

    // Extract from CLAIM_INFO.txt
    const claimPath = path.join(filesPath, '01_POLICY_DOCUMENTS', 'CLAIM_INFO.txt');
    const claimContent = this.readFileContent(claimPath);
    if (claimContent) {
      Object.assign(customerData, this.extractClaimData(claimContent));
      console.log(`  ✓ Claim data extracted: ${customerData.claim_number || 'N/A'}`);
    }

    // Extract from DETAILED_ESTIMATE.txt
    const estimatePath = path.join(filesPath, '03_REPORTS', 'DETAILED_ESTIMATE.txt');
    const estimateContent = this.readFileContent(estimatePath);
    if (estimateContent) {
      Object.assign(customerData, this.extractEstimateData(estimateContent));
      console.log(`  ✓ Estimate data extracted: $${customerData.rcv_amount || '0'}`);
    }

    // Extract from SUPPLEMENT_REQUEST.txt
    const supplementPath = path.join(filesPath, '04_SUPPLEMENTS', 'SUPPLEMENT_REQUEST.txt');
    const supplementContent = this.readFileContent(supplementPath);
    if (supplementContent) {
      Object.assign(customerData, this.extractSupplementData(supplementContent));
      console.log(`  ✓ Supplement data extracted: $${customerData.supplement_amount || '0'}`);
    }

    // Extract from PHOTO_INVENTORY.txt
    const photoPath = path.join(filesPath, '02_PHOTOS', 'PHOTO_INVENTORY.txt');
    const photoContent = this.readFileContent(photoPath);
    if (photoContent) {
      Object.assign(customerData, this.extractPhotoData(photoContent));
      console.log(`  ✓ Photo data extracted: ${customerData.photo_count || 0} photos`);
    }

    // Extract from QUICK_REFERENCE.txt
    const quickRefPath = path.join(filesPath, 'QUICK_REFERENCE.txt');
    const quickRefContent = this.readFileContent(quickRefPath);
    if (quickRefContent) {
      Object.assign(customerData, this.extractQuickReferenceData(quickRefContent));
    }

    // Extract property address from PROPERTY_DETAILS.txt if available
    const propertyPath = path.join(filesPath, '06_RAW_DATA', 'PROPERTY_DETAILS.txt');
    const propertyContent = this.readFileContent(propertyPath);
    if (propertyContent) {
      const addressMatch = propertyContent.match(/Property Address:\s*(.+)/i);
      if (addressMatch) {
        const fullAddress = addressMatch[1].trim();
        customerData.property_address = fullAddress;

        // Try to parse city, state, zip
        const cityStateMatch = fullAddress.match(/,\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})/);
        if (cityStateMatch) {
          customerData.city = cityStateMatch[1].trim();
          customerData.state = cityStateMatch[2];
          customerData.zip = cityStateMatch[3];
        }
      }
    }

    // Calculate additional fields
    if (customerData.date_of_loss) {
      customerData.days_since_loss = this.calculateDaysSinceLoss(customerData.date_of_loss);
    }

    // Determine kanban stage
    customerData.kanban_stage = this.determineKanbanStage(customerData);

    // Calculate collection percentage
    if (customerData.rcv_amount && customerData.collected_amount) {
      customerData.collection_percentage =
        Math.round((customerData.collected_amount / customerData.rcv_amount) * 100 * 100) / 100;
    }

    return customerData;
  }

  /**
   * Update customer in database
   */
  async updateCustomer(customerData) {
    return new Promise((resolve, reject) => {
      // First check if customer exists by normalized name
      const selectSql = 'SELECT id FROM customers WHERE normalized_name = ?';

      this.db.get(selectSql, [customerData.normalized_name], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          // Update existing customer
          const updateFields = Object.keys(customerData)
            .filter(key => key !== 'normalized_name')
            .map(key => `${key} = ?`)
            .join(', ');

          const updateValues = Object.keys(customerData)
            .filter(key => key !== 'normalized_name')
            .map(key => customerData[key]);

          const updateSql = `UPDATE customers SET ${updateFields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

          this.db.run(updateSql, [...updateValues, row.id], function(err) {
            if (err) reject(err);
            else resolve({ action: 'updated', id: row.id });
          });
        } else {
          // Insert new customer
          const insertFields = Object.keys(customerData).join(', ');
          const insertPlaceholders = Object.keys(customerData).map(() => '?').join(', ');
          const insertValues = Object.values(customerData);

          const insertSql = `INSERT INTO customers (${insertFields}) VALUES (${insertPlaceholders})`;

          this.db.run(insertSql, insertValues, function(err) {
            if (err) reject(err);
            else resolve({ action: 'inserted', id: this.lastID });
          });
        }
      });
    });
  }

  /**
   * Process all customers in CUSTOMER_PROFILES directory
   */
  async processAllCustomers() {
    console.log('='.repeat(70));
    console.log('CUSTOMER DATA EXTRACTION STARTED');
    console.log('='.repeat(70));
    console.log(`Source: ${this.customerProfilesPath}`);
    console.log(`Target: ${this.dbPath}`);

    const startTime = Date.now();
    let processedCount = 0;
    let updatedCount = 0;
    let insertedCount = 0;
    let errorCount = 0;

    try {
      // Get all customer folders
      const customerFolders = fs.readdirSync(this.customerProfilesPath)
        .map(name => path.join(this.customerProfilesPath, name))
        .filter(folderPath => {
          return fs.statSync(folderPath).isDirectory() &&
                 !folderPath.includes('README') &&
                 !folderPath.includes('GENERATION');
        });

      console.log(`\nFound ${customerFolders.length} customer folders to process\n`);

      // Process each customer
      for (const customerFolder of customerFolders) {
        try {
          const customerData = await this.extractCustomerData(customerFolder);
          const result = await this.updateCustomer(customerData);

          processedCount++;
          if (result.action === 'updated') updatedCount++;
          if (result.action === 'inserted') insertedCount++;

        } catch (error) {
          console.error(`  ✗ Error processing customer: ${error.message}`);
          errorCount++;
        }
      }

      // Log sync activity
      const endTime = Date.now();
      const durationSeconds = Math.round((endTime - startTime) / 1000);

      const logSql = `
        INSERT INTO sync_log (
          sync_type, sync_status, records_processed, records_updated, records_created, records_failed,
          start_time, end_time, duration_seconds, details, triggered_by
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?, ?)
      `;

      await new Promise((resolve, reject) => {
        this.db.run(logSql, [
          'customer_data_extraction',
          'completed',
          processedCount,
          updatedCount,
          insertedCount,
          errorCount,
          durationSeconds,
          JSON.stringify({
            source: this.customerProfilesPath,
            customers_found: customerFolders.length
          }),
          'manual'
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log('\n' + '='.repeat(70));
      console.log('EXTRACTION COMPLETED SUCCESSFULLY');
      console.log('='.repeat(70));
      console.log(`Customers processed: ${processedCount}`);
      console.log(`Records updated: ${updatedCount}`);
      console.log(`Records inserted: ${insertedCount}`);
      console.log(`Errors: ${errorCount}`);
      console.log(`Duration: ${durationSeconds} seconds`);
      console.log('='.repeat(70));

      return {
        processed: processedCount,
        updated: updatedCount,
        inserted: insertedCount,
        errors: errorCount,
        duration: durationSeconds
      };

    } catch (error) {
      console.error('Fatal error during extraction:', error);
      throw error;
    }
  }
}

// Export for use as module
module.exports = CustomerDataExtractor;

// Run directly if called from command line
if (require.main === module) {
  (async () => {
    const extractor = new CustomerDataExtractor();

    try {
      await extractor.connect();
      await extractor.processAllCustomers();
      await extractor.close();
      process.exit(0);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  })();
}
