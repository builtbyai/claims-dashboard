-- MASTER DATABASE SCHEMA FOR SUPPLEMENT DASHBOARD
-- Single source of truth for all customer, claim, policy, photo, and financial data

-- ============================================================
-- CUSTOMERS TABLE (Master table with all extracted data)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- CUSTOMER IDENTIFICATION
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  property_address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  email TEXT,

  -- POLICY INFORMATION (from POLICY_DECLARATION.txt)
  policy_number TEXT UNIQUE,
  policy_company TEXT,
  coverage_type TEXT,
  coverage_dwelling REAL,
  coverage_other_structures REAL,
  coverage_personal_property REAL,
  coverage_loss_of_use REAL,
  coverage_liability REAL,
  coverage_medical REAL,
  deductible_wind_hail REAL,
  deductible_other REAL,
  policy_effective_date TEXT,
  policy_expiration_date TEXT,

  -- CLAIM INFORMATION (from CLAIM_INFO.txt)
  claim_number TEXT UNIQUE,
  date_of_loss TEXT,
  loss_type TEXT,
  claim_status TEXT,
  adjuster_name TEXT,
  adjuster_phone TEXT,
  adjuster_email TEXT,
  initial_estimate_amount REAL,
  deductible_applied REAL,

  -- FINANCIAL DATA (from DETAILED_ESTIMATE.txt)
  rcv_amount REAL,
  acv_amount REAL,
  collected_amount REAL DEFAULT 0,
  outstanding_balance REAL,
  collection_percentage REAL DEFAULT 0,
  contractor_name TEXT DEFAULT 'Summit Exteriors',

  -- SUPPLEMENT DATA (from SUPPLEMENT_REQUEST.txt)
  supplement_amount REAL,
  supplement_date TEXT,
  supplement_status TEXT,
  supplement_reason TEXT,

  -- PHOTO DATA (from PHOTO_INVENTORY.txt)
  photo_count INTEGER DEFAULT 0,
  photo_thumbnail_path TEXT,
  photo_categories TEXT, -- JSON array of categories

  -- PROJECT MANAGEMENT
  install_date TEXT,
  completion_date TEXT,
  days_supplementing INTEGER DEFAULT 0,
  days_since_loss INTEGER DEFAULT 0,

  -- KANBAN WORKFLOW
  kanban_stage TEXT DEFAULT 'needs_supplement',
  -- Stages: needs_supplement, submitted, approved, scheduled, installed, complete

  -- METADATA
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PHOTOS TABLE (Individual photo records)
-- ============================================================
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,

  -- PHOTO DETAILS
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  thumbnail_path TEXT,
  category TEXT, -- damage, roof, interior, exterior, close_up, etc.
  description TEXT,

  -- PHOTO METADATA
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  taken_date TEXT,
  uploaded_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- ORGANIZATION
  is_primary BOOLEAN DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  tags TEXT, -- JSON array

  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- ============================================================
-- DOCUMENTS TABLE (Track all customer documents)
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,

  -- DOCUMENT DETAILS
  document_type TEXT NOT NULL,
  -- Types: policy, claim, estimate, supplement, correspondence, report, raw_data
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,

  -- DOCUMENT METADATA
  file_size INTEGER,
  mime_type TEXT,
  parsed BOOLEAN DEFAULT 0,
  parsed_data TEXT, -- JSON with extracted data

  -- ORGANIZATION
  category TEXT,
  description TEXT,
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- ============================================================
-- FINANCIAL_TRANSACTIONS TABLE (Payment tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS financial_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,

  -- TRANSACTION DETAILS
  transaction_type TEXT NOT NULL, -- payment, supplement, adjustment, refund
  amount REAL NOT NULL,
  transaction_date TEXT NOT NULL,
  description TEXT,

  -- PAYMENT DETAILS
  payment_method TEXT, -- check, ach, credit, insurance
  reference_number TEXT,

  -- TRACKING
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- ============================================================
-- SYNC_LOG TABLE (Track data synchronization)
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- SYNC DETAILS
  sync_type TEXT NOT NULL, -- full, incremental, photos, documents
  sync_status TEXT NOT NULL, -- started, completed, failed

  -- METRICS
  records_processed INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  -- TIMING
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP,
  duration_seconds INTEGER,

  -- DETAILS
  error_message TEXT,
  details TEXT, -- JSON with sync details

  -- SOURCE
  triggered_by TEXT DEFAULT 'manual' -- manual, scheduled, automatic
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_customers_claim_number ON customers(claim_number);
CREATE INDEX IF NOT EXISTS idx_customers_policy_number ON customers(policy_number);
CREATE INDEX IF NOT EXISTS idx_customers_normalized_name ON customers(normalized_name);
CREATE INDEX IF NOT EXISTS idx_customers_kanban_stage ON customers(kanban_stage);
CREATE INDEX IF NOT EXISTS idx_photos_customer_id ON photos(customer_id);
CREATE INDEX IF NOT EXISTS idx_photos_category ON photos(category);
CREATE INDEX IF NOT EXISTS idx_documents_customer_id ON documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON financial_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_type ON sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(sync_status);

-- ============================================================
-- TRIGGERS FOR AUTO-UPDATE
-- ============================================================

-- Auto-update customers.updated_at on any change
CREATE TRIGGER IF NOT EXISTS update_customers_timestamp
AFTER UPDATE ON customers
BEGIN
  UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Auto-calculate financial metrics on transaction insert
CREATE TRIGGER IF NOT EXISTS update_financials_on_transaction
AFTER INSERT ON financial_transactions
BEGIN
  UPDATE customers
  SET
    collected_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM financial_transactions
      WHERE customer_id = NEW.customer_id
        AND transaction_type IN ('payment', 'supplement')
    ),
    outstanding_balance = rcv_amount - (
      SELECT COALESCE(SUM(amount), 0)
      FROM financial_transactions
      WHERE customer_id = NEW.customer_id
        AND transaction_type IN ('payment', 'supplement')
    ),
    collection_percentage = CASE
      WHEN rcv_amount > 0 THEN
        ROUND(((
          SELECT COALESCE(SUM(amount), 0)
          FROM financial_transactions
          WHERE customer_id = NEW.customer_id
            AND transaction_type IN ('payment', 'supplement')
        ) / rcv_amount) * 100, 2)
      ELSE 0
    END
  WHERE id = NEW.customer_id;
END;

-- ============================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================

-- Dashboard summary view
CREATE VIEW IF NOT EXISTS dashboard_summary AS
SELECT
  c.id,
  c.name,
  c.normalized_name,
  c.property_address,
  c.city,
  c.state,
  c.zip,
  c.claim_number,
  c.policy_number,
  c.policy_company,
  c.rcv_amount,
  c.collected_amount,
  c.outstanding_balance,
  c.collection_percentage,
  c.kanban_stage,
  c.days_supplementing,
  c.date_of_loss,
  c.install_date,
  c.photo_count,
  c.photo_thumbnail_path,
  COUNT(DISTINCT p.id) as actual_photo_count,
  COUNT(DISTINCT d.id) as document_count
FROM customers c
LEFT JOIN photos p ON c.id = p.customer_id
LEFT JOIN documents d ON c.id = d.customer_id
GROUP BY c.id;

-- Financial summary view
CREATE VIEW IF NOT EXISTS financial_summary AS
SELECT
  SUM(rcv_amount) as total_rcv,
  SUM(collected_amount) as total_collected,
  SUM(outstanding_balance) as total_outstanding,
  AVG(collection_percentage) as avg_collection_rate,
  COUNT(*) as total_customers,
  COUNT(CASE WHEN kanban_stage = 'complete' THEN 1 END) as completed_jobs,
  COUNT(CASE WHEN kanban_stage = 'needs_supplement' THEN 1 END) as needs_supplement
FROM customers;

-- ============================================================
-- INITIAL DATA / SEED DATA
-- ============================================================

-- Insert Summit Exteriors as default contractor
INSERT OR IGNORE INTO sync_log (sync_type, sync_status, records_processed, details, triggered_by)
VALUES ('schema_creation', 'completed', 0, '{"message": "Master database schema created successfully"}', 'system');
