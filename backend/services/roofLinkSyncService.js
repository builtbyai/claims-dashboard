// Real-time RoofLink Sync Service
// Continuously fetches and syncs data from RoofLink API
const axios = require('axios');
const db = require('./databaseService');
const { notifyCustomerUpdate } = require('./websocketService');

class RoofLinkSyncService {
  constructor() {
    this.apiKey = process.env.ROOFLINK_API_KEY;
    this.syncInterval = 5 * 60 * 1000; // 5 minutes
    this.isRunning = false;
    this.syncTimer = null;
  }

  /**
   * Start the real-time sync service
   */
  start() {
    if (this.isRunning) {
      console.log('RoofLink sync service is already running');
      return;
    }

    console.log('🔄 Starting RoofLink real-time sync service...');
    this.isRunning = true;

    // Initial sync
    this.syncAll().catch(err => console.error('Initial sync error:', err));

    // Schedule periodic syncs
    this.syncTimer = setInterval(() => {
      this.syncAll().catch(err => console.error('Periodic sync error:', err));
    }, this.syncInterval);
  }

  /**
   * Stop the sync service
   */
  stop() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.isRunning = false;
    console.log('⏹️  RoofLink sync service stopped');
  }

  /**
   * Sync all jobs from RoofLink
   */
  async syncAll() {
    try {
      console.log('🔄 Syncing RoofLink data...');

      const jobs = await this.fetchAllJobs();
      console.log(`📊 Fetched ${jobs.length} jobs from RoofLink`);

      let updated = 0;
      let created = 0;

      for (const job of jobs) {
        const result = await this.syncJob(job);
        if (result === 'created') created++;
        if (result === 'updated') updated++;
      }

      console.log(`✅ Sync complete: ${created} created, ${updated} updated`);

      return { jobs: jobs.length, created, updated };
    } catch (error) {
      console.error('❌ RoofLink sync error:', error.message);
      throw error;
    }
  }

  /**
   * Fetch all jobs from RoofLink API
   */
  async fetchAllJobs() {
    try {
      const response = await axios.get('https://api.roof.link/v1/jobs', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        params: {
          limit: 100,
          status: 'all' // Get all statuses
        }
      });

      return response.data.jobs || [];
    } catch (error) {
      console.error('Error fetching RoofLink jobs:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Fetch single job details from RoofLink
   */
  async fetchJobDetails(jobId) {
    try {
      const response = await axios.get(`https://api.roof.link/v1/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching job ${jobId}:`, error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Fetch notes for a job
   */
  async fetchJobNotes(jobId) {
    try {
      const response = await axios.get(`https://api.roof.link/v1/jobs/${jobId}/notes`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.notes || [];
    } catch (error) {
      console.error(`Error fetching notes for job ${jobId}:`, error.message);
      return [];
    }
  }

  /**
   * Sync a single job to the database
   */
  async syncJob(job) {
    try {
      // Extract customer name from job
      const fullName = job.customer_name || '';
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Check if customer exists
      const existing = await db.getCustomerByJobId(job.job_number);

      const customerData = {
        name: fullName,
        normalized_name: fullName.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
        property_address: job.address?.street || '',
        city: job.address?.city || '',
        state: job.address?.state || '',
        zip: job.address?.zip || '',
        job_id: job.job_number,
        contact_phone: job.customer_phone || '',
        contact_email: job.customer_email || '',
        claim_number: job.insurance?.claim_number || null,
        insurance_company: job.insurance?.company_name || null,
        adjuster_name: job.insurance?.adjuster_name || null,
        status: job.status || null,
        // RoofLink specific fields
        rooflink_url: job.full_url || `https://www.roof.link/jobs/${job.id}`,
        rooflink_id: job.id,
        estimate_total: job.estimate?.total || 0,
        estimate_owes: job.estimate?.owes || 0,
        margin_percent: job.estimate?.margin_percent || 0,
        lead_source: job.lead_source || null,
        date_created: job.created_at || new Date().toISOString(),
        date_approved: job.approved_at || null,
        date_signed: job.signed_at || null,
        date_completed: job.completed_at || null,
        last_note: job.last_note?.message || null,
        last_note_date: job.last_note?.created_at || null
      };

      if (existing) {
        // Update existing customer
        await db.updateCustomer(existing.id, customerData);

        // Notify via WebSocket
        const updated = await db.getCustomerById(existing.id);
        notifyCustomerUpdate(updated);

        return 'updated';
      } else {
        // Create new customer
        const result = await db.createCustomer(customerData);

        // Notify via WebSocket
        const created = await db.getCustomerById(result.lastID);
        notifyCustomerUpdate(created);

        return 'created';
      }
    } catch (error) {
      console.error('Error syncing job:', error.message);
      return 'error';
    }
  }

  /**
   * Parse CSV from RoofLink export
   */
  async parseCSVExport(csvPath) {
    const fs = require('fs');
    const Papa = require('papaparse'); // Need to install: npm install papaparse

    try {
      const csvContent = fs.readFileSync(csvPath, 'utf8');

      return new Promise((resolve, reject) => {
        Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            console.log(`📊 Parsed ${results.data.length} rows from CSV`);
            resolve(results.data);
          },
          error: (error) => {
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('Error parsing CSV:', error.message);
      throw error;
    }
  }

  /**
   * Import CSV data into database
   */
  async importCSV(csvPath) {
    try {
      const rows = await this.parseCSVExport(csvPath);

      let created = 0;
      let updated = 0;

      for (const row of rows) {
        const customerData = this.csvRowToCustomer(row);
        const existing = await db.getCustomerByJobId(customerData.job_id);

        if (existing) {
          await db.updateCustomer(existing.id, customerData);
          updated++;
        } else {
          await db.createCustomer(customerData);
          created++;
        }
      }

      console.log(`✅ CSV Import complete: ${created} created, ${updated} updated`);
      return { created, updated, total: rows.length };
    } catch (error) {
      console.error('CSV import error:', error.message);
      throw error;
    }
  }

  /**
   * Convert CSV row to customer object
   */
  csvRowToCustomer(row) {
    const fullName = `${row['Customer / First name'] || ''} ${row['Customer / Last name'] || ''}`.trim();

    // Extract job ID from URL if not provided directly
    let jobId = null;
    if (row['Full url']) {
      const match = row['Full url'].match(/\/jobs\/(\d+)/);
      if (match) jobId = match[1];
    }

    return {
      name: fullName,
      normalized_name: fullName.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
      property_address: row['Customer / Address'] || row['Address'] || '',
      city: row['Customer / City'] || row['City'] || '',
      state: row['Customer / State'] || row['State'] || '',
      zip: row['Customer / Zipcode'] || row['Zipcode'] || '',
      job_id: jobId,
      contact_phone: row['Customer / Phone'] || row['Customer / Cell'] || '',
      contact_email: row['Customer / Email'] || '',
      claim_number: null, // Not in CSV
      insurance_company: row['Insurance company / Name'] || null,
      adjuster_name: row['Claim handler / Name'] || null,
      status: row['Status label'] || null,
      lead_status: row['Lead status label'] || null,
      rooflink_url: row['Full url'] || null,
      rooflink_id: jobId,
      estimate_total: parseFloat(row['Estimate / Total']) || 0,
      estimate_owes: parseFloat(row['Estimate / Owes']) || 0,
      margin_percent: parseFloat(row['Estimate / Gt margin']) || 0,
      lead_source: row['Customer / Lead source'] || null,
      rep_name: row['Customer / Rep'] || null,
      date_created: row['Date created'] || null,
      date_approved: row['Date approved'] || null,
      date_signed: row['Date signed'] || null,
      date_completed: row['Date completed'] || null,
      date_roof_completed: row['Date roof completed'] || null,
      last_note: row['Last note message'] || null,
      insurance_phone: row['Insurance company / Claims phone'] || null,
      insurance_email: row['Insurance company / Claims email'] || null,
      adjuster_phone: row['Claim handler / Phone'] || null,
      adjuster_email: row['Claim handler / Email'] || null
    };
  }

  /**
   * Check for supplement needs based on 80+ photos rule
   */
  async checkSupplementNeeds() {
    try {
      const customers = await db.getAllCustomers(1, 1000);
      const needsSupplements = [];

      for (const customer of customers.data) {
        if (customer.photo_count >= 80) {
          needsSupplements.push({
            id: customer.id,
            name: customer.name,
            photo_count: customer.photo_count,
            job_id: customer.job_id,
            status: customer.status
          });
        }
      }

      console.log(`🔍 Found ${needsSupplements.length} customers needing supplements (80+ photos)`);
      return needsSupplements;
    } catch (error) {
      console.error('Error checking supplement needs:', error.message);
      return [];
    }
  }
}

// Singleton instance
const roofLinkSync = new RoofLinkSyncService();

module.exports = roofLinkSync;
