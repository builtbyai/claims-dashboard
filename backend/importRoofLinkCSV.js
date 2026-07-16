// Import RoofLink CSV Data
const roofLinkSync = require('./services/roofLinkSyncService');
const path = require('path');

const csvPath = path.join(
  'C:',
  'Users',
  'Public',
  'Documents',
  'PROJECTS',
  'data',
  'download (1).csv'
);

console.log('🔄 Starting RoofLink CSV Import...');
console.log('CSV Path:', csvPath);
console.log('');

async function main() {
  try {
    const result = await roofLinkSync.importCSV(csvPath);

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Import Complete!');
    console.log('='.repeat(60));
    console.log(`Total Rows: ${result.total}`);
    console.log(`Created: ${result.created}`);
    console.log(`Updated: ${result.updated}`);
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ Import Failed!');
    console.error('='.repeat(60));
    console.error('Error:', error.message);
    console.error('='.repeat(60));

    process.exit(1);
  }
}

main();
