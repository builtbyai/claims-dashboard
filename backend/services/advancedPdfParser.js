const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');

/**
 * Advanced PDF Parser Service
 * Uses multiple extraction methods to parse PDF files for insurance claim data
 *
 * IMPORTANT: This requires PDF parsing libraries to be installed:
 * npm install pdf-parse pdfjs-dist pdf2json
 *
 * For now, this is a placeholder that will use Python's pdf_parser.py
 */

class AdvancedPdfParser {
  constructor() {
    this.baseDir = path.join(__dirname, '..', '..', '..', 'sample_data', 'CUSTOMER_PROFILES');
    this.pythonParserPath = path.join(__dirname, '..', '..', '..', 'sample_data', 'pdf_parser.py');

    // Regex patterns for data extraction
    this.patterns = {
      claimNumber: [
        /claim\s*#?\s*:?\s*([A-Z0-9-]{8,})/i,
        /CLM-(\d+)/i,
        /claim\s*number\s*:?\s*([A-Z0-9-]{8,})/i,
        /(\d{10,12})/  // Long numeric claim numbers
      ],
      policyNumber: [
        /policy\s*#?\s*:?\s*([A-Z0-9-]{8,})/i,
        /POL-(\d+)/i,
        /policy\s*number\s*:?\s*([A-Z0-9-]{8,})/i,
        /policy:\s*([A-Z0-9-]{8,})/i
      ],
      rcvAmount: [
        /RCV[:\s]*\$?([\d,]+\.?\d*)/i,
        /replacement\s*cost\s*value[:\s]*\$?([\d,]+\.?\d*)/i,
        /total\s*RCV[:\s]*\$?([\d,]+\.?\d*)/i,
        /\$\s*([\d,]+\.\d{2})/  // General currency pattern
      ],
      date: [
        /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/,
        /(\d{4}[/-]\d{1,2}[/-]\d{1,2})/,
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i
      ],
      address: [
        /(\d+\s+[A-Za-z0-9\s,]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Boulevard|Blvd)[A-Za-z0-9\s,]*,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5})/i
      ]
    };
  }

  /**
   * Extract data using regex patterns
   */
  extractWithRegex(text) {
    const data = {
      claimNumber: null,
      policyNumber: null,
      rcvAmount: null,
      dates: [],
      addresses: []
    };

    // Extract claim number
    for (const pattern of this.patterns.claimNumber) {
      const match = text.match(pattern);
      if (match) {
        data.claimNumber = match[1] || match[0];
        break;
      }
    }

    // Extract policy number
    for (const pattern of this.patterns.policyNumber) {
      const match = text.match(pattern);
      if (match) {
        data.policyNumber = match[1] || match[0];
        break;
      }
    }

    // Extract RCV amount
    for (const pattern of this.patterns.rcvAmount) {
      const match = text.match(pattern);
      if (match) {
        const amount = match[1] || match[0];
        data.rcvAmount = parseFloat(amount.replace(/[,$]/g, ''));
        break;
      }
    }

    // Extract dates
    for (const pattern of this.patterns.date) {
      const matches = text.matchAll(new RegExp(pattern, 'gi'));
      for (const match of matches) {
        if (match[0] && !data.dates.includes(match[0])) {
          data.dates.push(match[0]);
        }
      }
    }

    // Extract addresses
    for (const pattern of this.patterns.address) {
      const matches = text.matchAll(new RegExp(pattern, 'gi'));
      for (const match of matches) {
        if (match[0] && !data.addresses.includes(match[0])) {
          data.addresses.push(match[0]);
        }
      }
    }

    return data;
  }

  /**
   * Find all PDF files in customer folders
   */
  async findPdfFiles() {
    const pdfFiles = [];

    try {
      const customers = await fs.readdir(this.baseDir);

      for (const customer of customers) {
        const customerPath = path.join(this.baseDir, customer);
        const stat = await fs.stat(customerPath);

        if (stat.isDirectory()) {
          const files = await fs.readdir(customerPath);

          for (const file of files) {
            if (file.toLowerCase().endsWith('.pdf')) {
              pdfFiles.push({
                customerName: customer,
                fileName: file,
                filePath: path.join(customerPath, file)
              });
            }
          }
        }
      }

      return pdfFiles;
    } catch (error) {
      console.error('Error finding PDF files:', error);
      return [];
    }
  }

  /**
   * Parse PDF using Python script (fallback method)
   */
  async parsePdfWithPython(filePath) {
    const { spawn } = require('child_process');

    return new Promise((resolve, reject) => {
      const python = spawn('python', [this.pythonParserPath, filePath]);
      let output = '';
      let errorOutput = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python parser failed: ${errorOutput}`));
        } else {
          try {
            const data = JSON.parse(output);
            resolve(data);
          } catch (error) {
            // If not JSON, treat as plain text
            resolve({ text: output });
          }
        }
      });
    });
  }

  /**
   * Parse single PDF file with multiple methods
   */
  async parsePdf(pdfInfo) {
    console.log(`📄 Parsing: ${pdfInfo.fileName}`);

    const methods = [];
    let finalData = {
      claimNumber: null,
      policyNumber: null,
      rcvAmount: null,
      dates: [],
      addresses: [],
      parsedBy: []
    };

    try {
      // Method 1: Try Python parser first (most reliable)
      try {
        const pythonData = await this.parsePdfWithPython(pdfInfo.filePath);

        if (pythonData.text) {
          const extracted = this.extractWithRegex(pythonData.text);

          if (extracted.claimNumber) finalData.claimNumber = extracted.claimNumber;
          if (extracted.policyNumber) finalData.policyNumber = extracted.policyNumber;
          if (extracted.rcvAmount) finalData.rcvAmount = extracted.rcvAmount;
          finalData.dates.push(...extracted.dates);
          finalData.addresses.push(...extracted.addresses);
          finalData.parsedBy.push('python-pdf');
        }

        methods.push('python-pdf');
      } catch (error) {
        console.warn('  ⚠️  Python parser failed:', error.message);
      }

      // Method 2: Try reading as text file (for text-based PDFs)
      try {
        const textContent = await fs.readFile(pdfInfo.filePath, 'utf8');
        const extracted = this.extractWithRegex(textContent);

        if (!finalData.claimNumber && extracted.claimNumber) {
          finalData.claimNumber = extracted.claimNumber;
        }
        if (!finalData.policyNumber && extracted.policyNumber) {
          finalData.policyNumber = extracted.policyNumber;
        }
        if (!finalData.rcvAmount && extracted.rcvAmount) {
          finalData.rcvAmount = extracted.rcvAmount;
        }

        methods.push('text-read');
      } catch (error) {
        // Expected for binary PDFs
      }

      // Deduplicate arrays
      finalData.dates = [...new Set(finalData.dates)];
      finalData.addresses = [...new Set(finalData.addresses)];

      return {
        ...pdfInfo,
        ...finalData,
        methodsUsed: methods,
        success: finalData.claimNumber || finalData.policyNumber || finalData.rcvAmount
      };

    } catch (error) {
      console.error(`  ❌ Error parsing ${pdfInfo.fileName}:`, error);
      return {
        ...pdfInfo,
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Update customer data in database
   */
  async updateCustomerData(customerName, data) {
    return new Promise((resolve, reject) => {
      const updates = [];
      const values = [];

      if (data.claimNumber) {
        updates.push('claim_number = ?');
        values.push(data.claimNumber);
      }

      if (data.policyNumber) {
        updates.push('policy_number = ?');
        values.push(data.policyNumber);
      }

      if (data.rcvAmount) {
        updates.push('rcv_amount = ?');
        values.push(data.rcvAmount);
      }

      if (updates.length === 0) {
        resolve(false);
        return;
      }

      values.push(customerName);

      db.run(
        `UPDATE customers SET ${updates.join(', ')} WHERE name = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  /**
   * Run full PDF parsing and database update
   */
  async parseAllPdfs() {
    console.log('🔍 Advanced PDF Parser - Starting...');
    console.log('='.repeat(60));

    const pdfFiles = await this.findPdfFiles();
    console.log(`📚 Found ${pdfFiles.length} PDF files to parse`);
    console.log('');

    const results = {
      total: pdfFiles.length,
      successful: 0,
      failed: 0,
      updated: 0,
      parsedData: []
    };

    for (const pdfInfo of pdfFiles) {
      const parsedData = await this.parsePdf(pdfInfo);
      results.parsedData.push(parsedData);

      if (parsedData.success) {
        results.successful++;

        // Update database
        const updated = await this.updateCustomerData(pdfInfo.customerName, parsedData);

        if (updated) {
          results.updated++;
          console.log(`  ✅ Updated database for ${pdfInfo.customerName}`);
        }
      } else {
        results.failed++;
        console.log(`  ❌ Failed to extract data from ${pdfInfo.fileName}`);
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('📈 SUMMARY:');
    console.log(`   Total PDFs: ${results.total}`);
    console.log(`   Successfully parsed: ${results.successful}`);
    console.log(`   Failed: ${results.failed}`);
    console.log(`   Database updated: ${results.updated}`);
    console.log('='.repeat(60));

    return results;
  }

  /**
   * Schedule periodic PDF parsing (every 4 hours)
   */
  startScheduledParsing() {
    console.log('⏰ Scheduling PDF parsing every 4 hours...');

    // Run immediately
    this.parseAllPdfs().catch(console.error);

    // Then every 4 hours
    setInterval(() => {
      console.log('\n⏰ Scheduled PDF parsing triggered...');
      this.parseAllPdfs().catch(console.error);
    }, 4 * 60 * 60 * 1000); // 4 hours in milliseconds
  }
}

module.exports = new AdvancedPdfParser();
