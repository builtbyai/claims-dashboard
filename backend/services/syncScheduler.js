const rooflinkService = require('./rooflinkService');
const databaseService = require('./databaseService');
const { sendToDashboard, notifyCustomerUpdate, notifyHotJob } = require('./websocketService');

class SyncScheduler {
  constructor() {
    this.rooflinkSyncInterval = null;
    this.syncIntervalMs = parseInt(process.env.ROOFLINK_SYNC_INTERVAL) || 300000; // 5 minutes default
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.syncStats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      lastError: null
    };
  }

  // Start automatic sync
  start() {
    if (this.rooflinkSyncInterval) {
      console.log('Sync scheduler already running');
      return;
    }

    console.log(`Starting RoofLink sync scheduler (interval: ${this.syncIntervalMs / 1000}s)`);

    // Run initial sync
    this.syncNow();

    // Schedule periodic syncs
    this.rooflinkSyncInterval = setInterval(() => {
      this.syncNow();
    }, this.syncIntervalMs);

    console.log('Sync scheduler started successfully');
  }

  // Stop automatic sync
  stop() {
    if (this.rooflinkSyncInterval) {
      clearInterval(this.rooflinkSyncInterval);
      this.rooflinkSyncInterval = null;
      console.log('Sync scheduler stopped');
    }
  }

  // Get sync status
  getStatus() {
    return {
      isRunning: !!this.rooflinkSyncInterval,
      isSyncing: this.isSyncing,
      syncIntervalMs: this.syncIntervalMs,
      lastSyncTime: this.lastSyncTime,
      stats: this.syncStats
    };
  }

  // Perform sync now
  async syncNow() {
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping...');
      return { skipped: true, reason: 'Sync in progress' };
    }

    this.isSyncing = true;
    this.syncStats.totalSyncs++;

    const startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 Starting RoofLink Sync - ${new Date().toISOString()}`);
    console.log('='.repeat(60));

    try {
      // Notify dashboard that sync started
      sendToDashboard('sync:started', {
        timestamp: new Date().toISOString(),
        type: 'rooflink'
      });

      // Sync leads from RoofLink
      const syncResult = await rooflinkService.syncAllLeads(databaseService);

      // Calculate duration
      const duration = (Date.now() - startTime) / 1000;

      this.lastSyncTime = new Date().toISOString();
      this.syncStats.successfulSyncs++;
      this.syncStats.lastError = null;

      const result = {
        success: true,
        timestamp: this.lastSyncTime,
        duration: `${duration}s`,
        ...syncResult
      };

      console.log('='.repeat(60));
      console.log('✅ Sync Complete');
      console.log(`   Synced: ${syncResult.synced} customers`);
      console.log(`   Errors: ${syncResult.errors}`);
      console.log(`   Duration: ${duration.toFixed(2)}s`);
      console.log('='.repeat(60));

      // Notify dashboard that sync completed
      sendToDashboard('sync:completed', result);

      // Check for hot jobs (80+ photos)
      await this.checkHotJobs();

      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;

      console.error('❌ Sync Failed:', error.message);
      console.error('='.repeat(60));

      this.syncStats.failedSyncs++;
      this.syncStats.lastError = error.message;

      const result = {
        success: false,
        timestamp: new Date().toISOString(),
        duration: `${duration}s`,
        error: error.message
      };

      // Notify dashboard about failure
      sendToDashboard('sync:failed', result);

      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  // Check for hot jobs (customers with 80+ photos)
  async checkHotJobs() {
    try {
      const customers = await databaseService.getAllCustomers(1, 1000);
      const hotJobs = customers.filter(c => c.photo_count >= 80);

      for (const customer of hotJobs) {
        notifyHotJob(customer);
        console.log(`🔥 Hot Job Alert: ${customer.name} (${customer.photo_count} photos)`);
      }

      return hotJobs.length;
    } catch (error) {
      console.error('Error checking hot jobs:', error.message);
      return 0;
    }
  }

  // Update sync interval
  updateInterval(intervalMs) {
    this.syncIntervalMs = intervalMs;

    // Restart scheduler with new interval
    if (this.rooflinkSyncInterval) {
      this.stop();
      this.start();
    }

    console.log(`Sync interval updated to ${intervalMs / 1000}s`);
  }

  // Manual trigger via API
  async triggerManualSync() {
    console.log('Manual sync triggered');
    return await this.syncNow();
  }

  // Test RoofLink connection
  async testConnection() {
    try {
      const result = await rooflinkService.testConnection();
      console.log('RoofLink connection test:', result);
      return result;
    } catch (error) {
      console.error('RoofLink connection test failed:', error.message);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

// Create singleton instance
const syncScheduler = new SyncScheduler();

// Auto-start on module load (can be disabled via env var)
if (process.env.AUTO_START_SYNC !== 'false') {
  // Wait 10 seconds after server starts before first sync
  setTimeout(() => {
    syncScheduler.start();
  }, 10000);
}

module.exports = syncScheduler;
