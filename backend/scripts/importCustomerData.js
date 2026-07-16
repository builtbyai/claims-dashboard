const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '../../database/customers.db');
const CUSTOMER_DATA_PATH = path.join(__dirname, '../../customer_data');
const CUSTOMER_PROFILES_PATH = process.env.CUSTOMER_PROFILES_PATH || path.join(__dirname, '../../data/customer_profiles');

console.log('🚀 Customer Data Import Script');
console.log('================================\n');

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Ensure tables exist
function createTables() {
  console.log('📋 Creating database tables...');

  // Customers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      property_address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      phone TEXT,
      email TEXT,
      status TEXT DEFAULT 'active',
      job_id TEXT UNIQUE,
      claim_number TEXT,
      insurance_company TEXT,
      adjuster_name TEXT,
      sales_rep TEXT,
      project_manager TEXT,
      lead_source TEXT,
      job_type TEXT,
      grand_total REAL DEFAULT 0,
      collected_amount REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      rcv_amount REAL DEFAULT 0,
      adjusted_gross REAL DEFAULT 0,
      photo_count INTEGER DEFAULT 0,
      days_supplementing INTEGER DEFAULT 0,
      loss_date TEXT,
      install_date TEXT,
      kanban_stage TEXT DEFAULT 'leads',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      job_created TEXT,
      job_approved TEXT,
      profile_path TEXT,
      notes TEXT
    )
  `);

  // Customer events/activities table
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      activity_type TEXT NOT NULL,
      activity_date TEXT,
      description TEXT,
      created_by TEXT,
      attachment_path TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )
  `);

  // Install dates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS install_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      install_date TEXT NOT NULL,
      email_date TEXT,
      raw_line TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
    CREATE INDEX IF NOT EXISTS idx_customers_job_id ON customers(job_id);
    CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
    CREATE INDEX IF NOT EXISTS idx_customers_stage ON customers(kanban_stage);
    CREATE INDEX IF NOT EXISTS idx_customers_sales_rep ON customers(sales_rep);
    CREATE INDEX IF NOT EXISTS idx_activities_customer_id ON customer_activities(customer_id);
    CREATE INDEX IF NOT EXISTS idx_activities_date ON customer_activities(activity_date DESC);
  `);

  console.log('✅ Database tables created\n');
}

// Import install dates from JSON
function importInstallDates() {
  console.log('📅 Importing install dates...');
  const installDatesPath = path.join(CUSTOMER_DATA_PATH, 'INSTALL_DATES_EXTRACTED.json');

  if (!fs.existsSync(installDatesPath)) {
    console.log('⚠️  Install dates file not found, skipping...\n');
    return;
  }

  const installData = JSON.parse(fs.readFileSync(installDatesPath, 'utf8'));
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO install_dates (customer_name, install_date, email_date, raw_line)
    VALUES (?, ?, ?, ?)
  `);

  let count = 0;
  for (const entry of installData.all_entries) {
    if (entry.customer_name && entry.install_date) {
      insertStmt.run(
        entry.customer_name,
        entry.install_date,
        entry.email_date || null,
        entry.raw_line || null
      );
      count++;
    }
  }

  console.log(`✅ Imported ${count} install dates\n`);
}

// Import customer data from insurance claims CSV
async function importCustomersFromCSV() {
  console.log('📊 Importing customers from insurance claims CSV...');
  const csvPath = path.join(CUSTOMER_DATA_PATH, 'insurance_claims_supplements_oct_jul_2025_COMPLETE.csv');

  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  Insurance claims CSV not found, skipping...\n');
    return;
  }

  const customers = [];

  return new Promise((resolve) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        // Skip template rows
        if (row.Homeowner_Insured && row.Homeowner_Insured !== '[CLIENT_NAME]' && row.Homeowner_Insured !== 'N/A') {
          customers.push(row);
        }
      })
      .on('end', () => {
        const upsertStmt = db.prepare(`
          INSERT INTO customers (
            name, property_address, city, state, zip,
            claim_number, insurance_company, adjuster_name,
            job_id, status, loss_date, email, notes,
            profile_path, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(job_id) DO UPDATE SET
            property_address = excluded.property_address,
            city = excluded.city,
            state = excluded.state,
            zip = excluded.zip,
            claim_number = excluded.claim_number,
            insurance_company = excluded.insurance_company,
            adjuster_name = excluded.adjuster_name,
            notes = COALESCE(customers.notes || '; ' || excluded.notes, excluded.notes, customers.notes),
            updated_at = CURRENT_TIMESTAMP
          WHERE excluded.job_id IS NOT NULL
        `);

        let count = 0;
        for (const row of customers) {
          const jobId = row.Job_ID || null;
          const name = row.Homeowner_Insured.trim();
          const profilePath = findCustomerProfile(name);

          upsertStmt.run(
            name,
            row.Property_Address || null,
            row.City || null,
            row.State || null,
            row.Zip || null,
            row.Claim_Number || null,
            row.Insurance_Company || null,
            row.Adjuster_Name || null,
            jobId,
            mapStatusFromAction(row.Status_Action),
            row.Loss_Date || null,
            row.Contact_Email || null,
            (row.Notes || '') + (row.Supplement_Notes ? '; Supplement: ' + row.Supplement_Notes : ''),
            profilePath
          );
          count++;
        }

        console.log(`✅ Imported ${count} customers from CSV\n`);
        resolve();
      });
  });
}

// Map status from action description
function mapStatusFromAction(action) {
  if (!action) return 'active';
  const lower = action.toLowerCase();

  if (lower.includes('supplement')) return 'supplement_requested';
  if (lower.includes('approved')) return 'approved';
  if (lower.includes('inspection')) return 'inspection_scheduled';
  if (lower.includes('completed')) return 'completed';
  if (lower.includes('submission')) return 'submitted';

  return 'active';
}

// Map kanban stage from status
function mapKanbanStage(status) {
  const statusLower = status?.toLowerCase() || '';

  if (statusLower.includes('approved') || statusLower.includes('contract')) return 'approved';
  if (statusLower.includes('supplement') || statusLower.includes('pre supp')) return 'supplements';
  if (statusLower.includes('final check') || statusLower.includes('paid')) return 'invoicing';
  if (statusLower.includes('inspection')) return 'inspection';
  if (statusLower.includes('completed') || statusLower.includes('collection')) return 'completed';

  return 'leads';
}

// Find customer profile folder
function findCustomerProfile(customerName) {
  if (!fs.existsSync(CUSTOMER_PROFILES_PATH)) return null;

  const normalized = customerName.toUpperCase().replace(/[^A-Z]/g, '_');
  const profiles = fs.readdirSync(CUSTOMER_PROFILES_PATH);

  for (const profile of profiles) {
    if (profile.toUpperCase().includes(normalized.substring(0, 10)) ||
        normalized.includes(profile.toUpperCase().substring(0, 10))) {
      return path.join(CUSTOMER_PROFILES_PATH, profile);
    }
  }

  return null;
}

// Parse customer profile markdown for additional data
function enrichFromProfiles() {
  console.log('📂 Enriching customer data from profile folders...');

  const customers = db.prepare('SELECT id, name, profile_path FROM customers WHERE profile_path IS NOT NULL').all();

  let enriched = 0;
  for (const customer of customers) {
    const profileFile = path.join(customer.profile_path, 'CUSTOMER_PROFILE.md');

    if (fs.existsSync(profileFile)) {
      const content = fs.readFileSync(profileFile, 'utf8');
      const extracted = extractProfileData(content);

      if (Object.keys(extracted).length > 0) {
        const updateFields = [];
        const values = [];

        for (const [key, value] of Object.entries(extracted)) {
          if (value) {
            updateFields.push(`${key} = ?`);
            values.push(value);
          }
        }

        if (updateFields.length > 0) {
          values.push(customer.id);
          db.prepare(`UPDATE customers SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
          enriched++;
        }
      }
    }
  }

  console.log(`✅ Enriched ${enriched} customer records from profiles\n`);
}

// Extract data from profile markdown
function extractProfileData(content) {
  const data = {};

  // Extract phone
  const phoneMatch = content.match(/\*\*Phone:\*\*\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) data.phone = phoneMatch[0].replace('**Phone:**', '').trim();

  // Extract email
  const emailMatch = content.match(/\*\*Email:\*\*\s*([^\s\n]+@[^\s\n]+)/);
  if (emailMatch) data.email = emailMatch[1];

  // Extract grand total
  const totalMatch = content.match(/\*\*Grand Total:\*\*\s*\$([0-9,]+\.?\d*)/);
  if (totalMatch) data.grand_total = parseFloat(totalMatch[1].replace(/,/g, ''));

  // Extract balance
  const balanceMatch = content.match(/\*\*Balance:\*\*\s*\$([0-9,]+\.?\d*)/);
  if (balanceMatch) data.balance = parseFloat(balanceMatch[1].replace(/,/g, ''));

  // Extract sales rep
  const repMatch = content.match(/\*\*Sales Rep:\*\*\s*([^\n]+)/);
  if (repMatch) data.sales_rep = repMatch[1].trim();

  // Extract job ID
  const jobMatch = content.match(/\*\*Job #:\*\*\s*(\d+)/);
  if (jobMatch) data.job_id = jobMatch[1];

  return data;
}

// Link install dates to customers
function linkInstallDates() {
  console.log('🔗 Linking install dates to customers...');

  const installDates = db.prepare('SELECT * FROM install_dates').all();
  let linked = 0;

  for (const installDate of installDates) {
    // Try exact match first
    let customer = db.prepare('SELECT id FROM customers WHERE name = ? COLLATE NOCASE').get(installDate.customer_name);

    // Try partial match
    if (!customer) {
      const nameParts = installDate.customer_name.split(' ');
      if (nameParts.length >= 2) {
        customer = db.prepare(`
          SELECT id FROM customers
          WHERE name LIKE ? OR name LIKE ?
          LIMIT 1
        `).get(`%${nameParts[0]}%`, `%${nameParts[nameParts.length - 1]}%`);
      }
    }

    if (customer) {
      db.prepare('UPDATE customers SET install_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(installDate.install_date, customer.id);
      linked++;
    }
  }

  console.log(`✅ Linked ${linked} install dates to customers\n`);
}

// Create calendar events from install dates
function createCalendarEvents() {
  console.log('📆 Creating calendar events from install dates...');

  const customersWithDates = db.prepare(`
    SELECT id, name, install_date
    FROM customers
    WHERE install_date IS NOT NULL
  `).all();

  const insertActivity = db.prepare(`
    INSERT INTO customer_activities (customer_id, activity_type, activity_date, description, created_by)
    VALUES (?, 'installation', ?, ?, 'system')
  `);

  let created = 0;
  for (const customer of customersWithDates) {
    insertActivity.run(
      customer.id,
      customer.install_date,
      `Roof Installation Day for ${customer.name}`
    );
    created++;
  }

  console.log(`✅ Created ${created} calendar events\n`);
}

// Generate summary report
function generateSummary() {
  console.log('📈 Import Summary');
  console.log('==================\n');

  const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
  const withProfiles = db.prepare('SELECT COUNT(*) as count FROM customers WHERE profile_path IS NOT NULL').get().count;
  const withInstallDates = db.prepare('SELECT COUNT(*) as count FROM customers WHERE install_date IS NOT NULL').get().count;
  const totalEvents = db.prepare('SELECT COUNT(*) as count FROM customer_activities').get().count;

  const byStage = db.prepare(`
    SELECT kanban_stage, COUNT(*) as count
    FROM customers
    GROUP BY kanban_stage
    ORDER BY count DESC
  `).all();

  const bySalesRep = db.prepare(`
    SELECT sales_rep, COUNT(*) as count, SUM(balance) as total_balance
    FROM customers
    WHERE sales_rep IS NOT NULL
    GROUP BY sales_rep
    ORDER BY count DESC
  `).all();

  console.log(`Total Customers: ${totalCustomers}`);
  console.log(`With Profiles: ${withProfiles}`);
  console.log(`With Install Dates: ${withInstallDates}`);
  console.log(`Total Events: ${totalEvents}\n`);

  console.log('By Kanban Stage:');
  byStage.forEach(s => {
    console.log(`  ${s.kanban_stage}: ${s.count}`);
  });

  console.log('\nTop Sales Reps:');
  bySalesRep.slice(0, 5).forEach(rep => {
    console.log(`  ${rep.sales_rep}: ${rep.count} customers, $${rep.total_balance?.toFixed(2) || 0} balance`);
  });

  console.log('\n✅ Import Complete!\n');
}

// Main execution
async function main() {
  try {
    createTables();
    importInstallDates();
    await importCustomersFromCSV();
    enrichFromProfiles();
    linkInstallDates();
    createCalendarEvents();
    generateSummary();

    db.close();
  } catch (error) {
    console.error('❌ Import failed:', error);
    db.close();
    process.exit(1);
  }
}

main();
