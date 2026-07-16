const DataExtractor = require('./services/dataExtractor');
const PhotoIndexer = require('./services/photoIndexer');
const Database = require('better-sqlite3');
const path = require('path');

async function testSync() {
  console.log('='.repeat(60));
  console.log('TESTING DATA SYNCHRONIZATION SYSTEM');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Test Data Extraction
    console.log('1️⃣ Testing Data Extraction Service...');
    console.log('-'.repeat(60));
    const dataExtractor = new DataExtractor();
    const extractResult = await dataExtractor.extractAllData();

    console.log('✅ Data Extraction Results:');
    console.log(`   Records Processed: ${extractResult.recordsProcessed}`);
    console.log(`   Records Updated: ${extractResult.recordsUpdated}`);
    console.log(`   Records Inserted: ${extractResult.recordsInserted}`);
    console.log(`   Duration: ${extractResult.duration}`);
    console.log('');

    // Test Photo Indexing
    console.log('2️⃣ Testing Photo Indexing Service...');
    console.log('-'.repeat(60));
    const photoIndexer = new PhotoIndexer();
    const indexResult = await photoIndexer.indexAllPhotos();

    console.log('✅ Photo Indexing Results:');
    console.log(`   Total Photos: ${indexResult.totalPhotos}`);
    console.log(`   Customers Processed: ${indexResult.customersProcessed}`);
    console.log(`   Install Dates Detected: ${indexResult.installDatesDetected}`);
    console.log(`   Duration: ${indexResult.duration}`);
    console.log('');

    // Test Database Queries
    console.log('3️⃣ Testing Database Queries...');
    console.log('-'.repeat(60));
    const db = new Database(path.join(__dirname, 'database', 'customers.db'));

    // Calculate days supplementing
    dataExtractor.calculateDaysSupplementing(db);

    // Get summary stats
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_customers,
        COUNT(CASE WHEN rcv_amount > 0 THEN 1 END) as with_rcv,
        COALESCE(SUM(rcv_amount), 0) as total_rcv,
        COALESCE(SUM(collected_amount), 0) as total_collected,
        COALESCE(SUM(photo_count), 0) as total_photos
      FROM customers
    `).get();

    console.log('✅ Database Statistics:');
    console.log(`   Total Customers: ${stats.total_customers}`);
    console.log(`   Customers with RCV: ${stats.with_rcv}`);
    console.log(`   Total RCV: $${stats.total_rcv.toLocaleString()}`);
    console.log(`   Total Collected: $${stats.total_collected.toLocaleString()}`);
    console.log(`   Total Photos: ${stats.total_photos}`);
    console.log('');

    // Get sample customers
    const samples = db.prepare(`
      SELECT
        homeowner_name,
        rcv_amount,
        photo_count,
        insurance_company,
        days_supplementing
      FROM customers
      WHERE rcv_amount IS NOT NULL
      ORDER BY rcv_amount DESC
      LIMIT 5
    `).all();

    console.log('✅ Top 5 Customers by RCV:');
    console.log('-'.repeat(60));
    samples.forEach((customer, index) => {
      console.log(`   ${index + 1}. ${customer.homeowner_name}`);
      console.log(`      RCV: $${(customer.rcv_amount || 0).toLocaleString()}`);
      console.log(`      Photos: ${customer.photo_count || 0}`);
      console.log(`      Insurance: ${customer.insurance_company}`);
      console.log(`      Days Supplementing: ${customer.days_supplementing || 0}`);
    });
    console.log('');

    // Get photo inventory summary
    const photoSummary = db.prepare(`
      SELECT COUNT(*) as count, SUM(photo_count) as total
      FROM photo_inventory
      WHERE photo_count > 0
    `).get();

    console.log('✅ Photo Inventory:');
    console.log(`   Customers with Photos: ${photoSummary.count || 0}`);
    console.log(`   Total Photos Indexed: ${photoSummary.total || 0}`);
    console.log('');

    // Log sync
    dataExtractor.logSync(db, {
      ...extractResult,
      photosIndexed: indexResult.totalPhotos
    });

    db.close();

    console.log('='.repeat(60));
    console.log('🎉 SYNC TEST COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Next Steps:');
    console.log('1. View logs in sync_log.txt');
    console.log('2. Access API at http://localhost:5001/api/financials/summary');
    console.log('3. View dashboard at http://localhost:3001/financials');
    console.log('');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testSync();
