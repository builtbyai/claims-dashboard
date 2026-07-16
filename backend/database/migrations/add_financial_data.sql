-- ============================================
-- Financial Data Migration
-- ============================================
-- Adds financial tracking tables and columns
-- to the supplement dashboard database
-- ============================================

-- Add financial columns to customers table if they don't exist
ALTER TABLE customers ADD COLUMN IF NOT EXISTS rcv_amount REAL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS collected_amount REAL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS outstanding_balance REAL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS photo_count INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS install_date TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS supplement_date TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS supplement_notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS days_supplementing INTEGER;

-- Create financial_data table
CREATE TABLE IF NOT EXISTS financial_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  rcv_amount REAL NOT NULL,
  collected_amount REAL DEFAULT 0,
  outstanding_balance REAL,
  first_payment_date TEXT,
  last_payment_date TEXT,
  payment_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Create index on customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_financial_customer ON financial_data(customer_id);

-- Create photo_inventory table
CREATE TABLE IF NOT EXISTS photo_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER,
  customer_name TEXT UNIQUE NOT NULL,
  photo_count INTEGER DEFAULT 0,
  install_date_from_photos TEXT,
  photos_by_date TEXT,
  last_scan_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- Create index on customer_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_photo_inventory_name ON photo_inventory(customer_name);

-- Create sync_log table
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_timestamp TEXT NOT NULL,
  records_updated INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  errors TEXT,
  duration TEXT,
  status TEXT DEFAULT 'success',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create index on sync_timestamp for faster lookups
CREATE INDEX IF NOT EXISTS idx_sync_log_timestamp ON sync_log(sync_timestamp);

-- Create trigger to update outstanding_balance automatically
CREATE TRIGGER IF NOT EXISTS update_outstanding_balance
AFTER UPDATE OF rcv_amount, collected_amount ON customers
BEGIN
  UPDATE customers
  SET outstanding_balance = NEW.rcv_amount - NEW.collected_amount
  WHERE id = NEW.id;
END;

-- Create trigger to update financial_data when customers table is updated
CREATE TRIGGER IF NOT EXISTS sync_financial_data
AFTER UPDATE OF rcv_amount, collected_amount ON customers
BEGIN
  INSERT OR REPLACE INTO financial_data (
    customer_id,
    rcv_amount,
    collected_amount,
    outstanding_balance,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.rcv_amount,
    NEW.collected_amount,
    NEW.rcv_amount - NEW.collected_amount,
    CURRENT_TIMESTAMP
  );
END;

-- Update existing records to calculate outstanding_balance
UPDATE customers
SET outstanding_balance = rcv_amount - COALESCE(collected_amount, 0)
WHERE rcv_amount IS NOT NULL;

-- Insert comment for migration tracking
INSERT INTO sync_log (
  sync_timestamp,
  records_updated,
  status,
  errors
) VALUES (
  datetime('now'),
  (SELECT COUNT(*) FROM customers WHERE rcv_amount IS NOT NULL),
  'success',
  'Financial data migration completed'
);
