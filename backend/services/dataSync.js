const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Load environment variables
require('dotenv').config();

// Configuration
const ROOFLINK_API_KEY = process.env.ROOFLINK_API_KEY;
const ROOFLINK_API_URL = process.env.ROOFLINK_API_URL || 'https://api.roof.link';
const CSV_DIR = process.env.CUSTOMER_PROFILES_PATH || path.join(__dirname, '../../../sample_data');
const SYNC_INTERVAL = parseInt(process.env.ROOFLINK_SYNC_INTERVAL) || 300000; // 5 minutes
const DATA_OUTPUT_DIR = path.join(__dirname, '../public/data');

class DataSyncService {
  constructor() {
    this.isRunning = false;
    this.syncTimer = null;
    this.lastSyncTime = null;
    this.syncErrors = [];
  }

  /**
   * Start the continuous sync service
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Data sync service already running');
      return;
    }

    console.log('🔄 Starting Data Sync Service...');
    this.isRunning = true;

    // Ensure data output directory exists
    await this.ensureDataDirectory();

    // Initial sync
    await this.performSync();

    // Schedule continuous syncing
    this.syncTimer = setInterval(async () => {
      await this.performSync();
    }, SYNC_INTERVAL);

    console.log(`✅ Data Sync Service started - syncing every ${SYNC_INTERVAL / 1000} seconds`);
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
    console.log('🛑 Data Sync Service stopped');
  }

  /**
   * Ensure data output directory exists
   */
  async ensureDataDirectory() {
    try {
      await fs.mkdir(DATA_OUTPUT_DIR, { recursive: true });
    } catch (error) {
      console.error('Error creating data directory:', error);
    }
  }

  /**
   * Perform a complete sync cycle
   */
  async performSync() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔄 Starting sync cycle at ${new Date().toISOString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
      // Step 1: Sync Roof.link data
      await this.syncRoofLinkData();

      // Step 2: Parse CSV files for install dates
      await this.syncCSVInstallDates();

      // Step 3: Sync customer profile data
      await this.syncCustomerProfiles();

      // Step 4: Generate unified data file
      await this.generateUnifiedData();

      this.lastSyncTime = new Date();
      console.log('\n✅ Sync cycle completed successfully\n');

    } catch (error) {
      console.error('❌ Sync cycle failed:', error);
      this.syncErrors.push({
        timestamp: new Date(),
        error: error.message,
        stack: error.stack
      });

      // Keep only last 10 errors
      if (this.syncErrors.length > 10) {
        this.syncErrors = this.syncErrors.slice(-10);
      }
    }
  }

  /**
   * Sync data from Roof.link API
   */
  async syncRoofLinkData() {
    console.log('📡 Syncing Roof.link data...');

    try {
      // Fetch jobs from Roof.link API
      const response = await axios.get(`${ROOFLINK_API_URL}/api/jobs`, {
        headers: {
          'Authorization': `Bearer ${ROOFLINK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const jobs = response.data;
      console.log(`   Found ${jobs.length} jobs from Roof.link`);

      // Save raw data
      const outputPath = path.join(DATA_OUTPUT_DIR, 'rooflink_jobs.json');
      await fs.writeFile(outputPath, JSON.stringify(jobs, null, 2));
      console.log(`   ✓ Saved to ${outputPath}`);

      return jobs;

    } catch (error) {
      console.error('   ❌ Roof.link sync failed:', error.message);

      // Try to load cached data
      try {
        const cachedPath = path.join(DATA_OUTPUT_DIR, 'rooflink_jobs.json');
        const cachedData = await fs.readFile(cachedPath, 'utf-8');
        console.log('   ℹ️  Using cached Roof.link data');
        return JSON.parse(cachedData);
      } catch (cacheError) {
        console.error('   ❌ No cached data available');
        return [];
      }
    }
  }

  /**
   * Parse CSV files for install dates using Python script
   */
  async syncCSVInstallDates() {
    console.log('📄 Parsing CSV files for install dates...');

    try {
      const pythonScript = path.join(__dirname, '../../../sample_data/extract_install_dates.py');

      // Check if Python script exists
      try {
        await fs.access(pythonScript);
      } catch {
        console.log('   ⚠️  Python script not found, skipping CSV sync');
        return;
      }

      // Execute Python script
      const { stdout, stderr } = await execAsync(`python "${pythonScript}"`);

      if (stderr) {
        console.log('   ⚠️  Python script warnings:', stderr);
      }

      console.log('   ✓ CSV parsing completed');

      // Read the generated JSON file
      const installDatesPath = path.join(__dirname, '../../../sample_data/INSTALL_DATES_EXTRACTED.json');
      const installDatesData = await fs.readFile(installDatesPath, 'utf-8');
      const installDates = JSON.parse(installDatesData);

      // Copy to public data directory
      const outputPath = path.join(DATA_OUTPUT_DIR, 'install_dates.json');
      await fs.writeFile(outputPath, JSON.stringify(installDates, null, 2));
      console.log(`   ✓ Saved ${installDates.total_install_dates_found} install dates to ${outputPath}`);

      return installDates;

    } catch (error) {
      console.error('   ❌ CSV parsing failed:', error.message);
      return { total_install_dates_found: 0, customers: {} };
    }
  }

  /**
   * Sync customer profile data from CUSTOMER_PROFILES directory
   */
  async syncCustomerProfiles() {
    console.log('👥 Syncing customer profiles...');

    try {
      const profilesDir = process.env.CUSTOMER_PROFILES_PATH;

      if (!profilesDir) {
        console.log('   ⚠️  CUSTOMER_PROFILES_PATH not configured, skipping');
        return [];
      }

      // Check if directory exists
      try {
        await fs.access(profilesDir);
      } catch {
        console.log('   ⚠️  Customer profiles directory not found, skipping');
        return [];
      }

      // Read all JSON files from profiles directory
      const files = await fs.readdir(profilesDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      console.log(`   Found ${jsonFiles.length} customer profile files`);

      const profiles = [];
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(profilesDir, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const profile = JSON.parse(data);
          profiles.push(profile);
        } catch (error) {
          console.error(`   ⚠️  Error reading ${file}:`, error.message);
        }
      }

      // Save consolidated profiles
      const outputPath = path.join(DATA_OUTPUT_DIR, 'customer_profiles.json');
      await fs.writeFile(outputPath, JSON.stringify(profiles, null, 2));
      console.log(`   ✓ Saved ${profiles.length} customer profiles to ${outputPath}`);

      return profiles;

    } catch (error) {
      console.error('   ❌ Customer profile sync failed:', error.message);
      return [];
    }
  }

  /**
   * Generate unified data file combining all sources
   */
  async generateUnifiedData() {
    console.log('🔗 Generating unified data file...');

    try {
      // Load all synced data
      const roofLinkJobs = await this.loadJSON('rooflink_jobs.json');
      const installDates = await this.loadJSON('install_dates.json');
      const customerProfiles = await this.loadJSON('customer_profiles.json');

      // Create unified data structure
      const unifiedData = {
        metadata: {
          lastSync: new Date().toISOString(),
          sources: {
            rooflink: roofLinkJobs?.length || 0,
            installDates: installDates?.total_install_dates_found || 0,
            customerProfiles: customerProfiles?.length || 0
          }
        },
        jobs: roofLinkJobs || [],
        installDates: installDates || {},
        customers: customerProfiles || [],

        // Create customer index for quick lookup
        customerIndex: this.buildCustomerIndex(roofLinkJobs, installDates, customerProfiles)
      };

      // Save unified data
      const outputPath = path.join(DATA_OUTPUT_DIR, 'unified_data.json');
      await fs.writeFile(outputPath, JSON.stringify(unifiedData, null, 2));
      console.log(`   ✓ Unified data saved to ${outputPath}`);

      return unifiedData;

    } catch (error) {
      console.error('   ❌ Unified data generation failed:', error.message);
      return null;
    }
  }

  /**
   * Build customer index combining data from all sources
   */
  buildCustomerIndex(jobs, installDates, profiles) {
    const index = {};

    // Add install dates
    if (installDates?.customers) {
      Object.entries(installDates.customers).forEach(([name, dates]) => {
        if (!index[name]) index[name] = {};
        index[name].installDates = dates;
      });
    }

    // Add profile data
    if (Array.isArray(profiles)) {
      profiles.forEach(profile => {
        const name = profile.name || profile.customer_name;
        if (name) {
          if (!index[name]) index[name] = {};
          index[name].profile = profile;
        }
      });
    }

    // Add job data
    if (Array.isArray(jobs)) {
      jobs.forEach(job => {
        const name = job.customer_name || job.name;
        if (name) {
          if (!index[name]) index[name] = {};
          if (!index[name].jobs) index[name].jobs = [];
          index[name].jobs.push(job);
        }
      });
    }

    return index;
  }

  /**
   * Load JSON file helper
   */
  async loadJSON(filename) {
    try {
      const filePath = path.join(DATA_OUTPUT_DIR, filename);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      syncInterval: SYNC_INTERVAL,
      recentErrors: this.syncErrors.slice(-5)
    };
  }
}

// Export singleton instance
const dataSyncService = new DataSyncService();
module.exports = dataSyncService;
