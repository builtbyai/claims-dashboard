// Database Migration Runner
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'customers.db');
const migrationPath = path.join(__dirname, 'migrations', '001_enhance_schema.sql');

console.log('🔄 Running database migration...');
console.log('Database:', dbPath);
console.log('Migration:', migrationPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

// Read migration file
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Split into individual statements
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`📝 Found ${statements.length} migration statements`);

// Execute each statement
let completed = 0;
let errors = 0;

statements.forEach((statement, index) => {
  db.run(statement, function(err) {
    if (err) {
      // Ignore "duplicate column" errors (already exists)
      if (err.message.includes('duplicate column') || err.message.includes('already exists')) {
        console.log(`⚠️  Statement ${index + 1}: Already exists (skipping)`);
      } else {
        console.error(`❌ Statement ${index + 1} error:`, err.message);
        errors++;
      }
    } else {
      console.log(`✅ Statement ${index + 1}: Success`);
      completed++;
    }

    // Check if all done
    if (index === statements.length - 1) {
      console.log('\n' + '='.repeat(60));
      console.log(`Migration complete:`);
      console.log(`  ✅ Successful: ${completed}`);
      console.log(`  ⚠️  Skipped: ${statements.length - completed - errors}`);
      console.log(`  ❌ Errors: ${errors}`);
      console.log('='.repeat(60));

      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        }
        console.log('✅ Database connection closed');
        process.exit(errors > 0 ? 1 : 0);
      });
    }
  });
});
