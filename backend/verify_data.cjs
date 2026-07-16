const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database', 'customers.db');
const PHOTOS_DIR = path.join(__dirname, '..', 'frontend', 'public', 'customer_photos');

// Placeholder patterns
const PLACEHOLDER_PATTERNS = {
  claimNumber: [/^CLM-0+$/, /^CLAIM-0+$/, /^0{10,}$/, /^XXX/, /^TBD/i, /^PENDING/i, /^N\/A$/i],
  policyNumber: [/^POL-0+$/, /^POLICY-0+$/, /^0{10,}$/, /^XXX/, /^TBD/i, /^PENDING/i, /^N\/A$/i],
};

function isPlaceholder(value, type) {
  if (!value) return false;
  const patterns = PLACEHOLDER_PATTERNS[type] || [];
  return patterns.some(pattern => pattern.test(value.toString()));
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9_-]/gi, '_').replace(/_{2,}/g, '_').toLowerCase();
}

function countActualPhotos(customerName) {
  const customerDir = path.join(PHOTOS_DIR, sanitizeFilename(customerName));
  if (!fs.existsSync(customerDir)) return 0;
  const files = fs.readdirSync(customerDir);
  return files.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f)).length;
}

// Main verification
const db = new Database(DB_PATH, { readonly: true });
const customers = db.prepare('SELECT * FROM customers').all();

console.log('\n' + '='.repeat(70));
console.log('  DATA VERIFICATION REPORT - NO PLACEHOLDERS ALLOWED!');
console.log('='.repeat(70));
console.log();

let withPlaceholders = 0;
let withRealData = 0;
let placeholderIssues = [];
let photoIssues = [];
let totalPhotosDb = 0;
let totalPhotosActual = 0;

customers.forEach(customer => {
  let hasPlaceholder = false;

  // Check claim number
  if (customer.claim_number && isPlaceholder(customer.claim_number, 'claimNumber')) {
    hasPlaceholder = true;
    placeholderIssues.push({
      customer: customer.name,
      field: 'claim_number',
      value: customer.claim_number
    });
  }

  // Check policy number
  if (customer.policy_number && isPlaceholder(customer.policy_number, 'policyNumber')) {
    hasPlaceholder = true;
    placeholderIssues.push({
      customer: customer.name,
      field: 'policy_number',
      value: customer.policy_number
    });
  }

  // Check photos
  if (customer.photo_count > 0) {
    const actualCount = countActualPhotos(customer.name);
    totalPhotosDb += customer.photo_count;
    totalPhotosActual += actualCount;

    if (actualCount !== customer.photo_count) {
      photoIssues.push({
        customer: customer.name,
        dbCount: customer.photo_count,
        actualCount: actualCount
      });
    }
  }

  if (hasPlaceholder) {
    withPlaceholders++;
  } else {
    withRealData++;
  }
});

// Print results
console.log('📊 OVERALL STATISTICS:');
console.log(`   Total customers: ${customers.length}`);
console.log(`   ✅ Customers with REAL data: ${withRealData}`);
console.log(`   ❌ Customers with PLACEHOLDERS: ${withPlaceholders}`);
console.log();

if (placeholderIssues.length > 0) {
  console.log('🚨 PLACEHOLDER ISSUES FOUND:');
  placeholderIssues.forEach(issue => {
    console.log(`   ❌ ${issue.customer}:`);
    console.log(`      Field: ${issue.field}`);
    console.log(`      Value: ${issue.value}`);
    console.log();
  });
} else {
  console.log('✅ NO PLACEHOLDER DATA FOUND!');
  console.log();
}

if (photoIssues.length > 0) {
  console.log('📷 PHOTO ISSUES:');
  photoIssues.forEach(issue => {
    console.log(`   ⚠️  ${issue.customer}:`);
    console.log(`      DB Count: ${issue.dbCount}`);
    console.log(`      Actual Count: ${issue.actualCount}`);
    console.log();
  });
} else {
  console.log('✅ All photo counts match!');
  console.log();
}

console.log('📸 PHOTO STATISTICS:');
console.log(`   Total photos in database: ${totalPhotosDb}`);
console.log(`   Total actual files found: ${totalPhotosActual}`);
console.log();

console.log('='.repeat(70));
if (withPlaceholders === 0 && photoIssues.length === 0) {
  console.log('🎉 VERIFICATION PASSED! NO PLACEHOLDERS FOUND!');
  console.log('   All data is REAL and verified.');
} else {
  console.log('⛔ VERIFICATION FAILED!');
  console.log('   Placeholder or invalid data detected.');
}
console.log('='.repeat(70));
console.log();

db.close();
process.exit(withPlaceholders === 0 && photoIssues.length === 0 ? 0 : 1);
