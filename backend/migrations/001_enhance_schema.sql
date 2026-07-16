-- Enhanced Schema Migration
-- Adds all new fields for RoofLink integration, calendar, and enriched data

-- Add new columns to customers table
ALTER TABLE customers ADD COLUMN rooflink_id TEXT;
ALTER TABLE customers ADD COLUMN rooflink_url TEXT;
ALTER TABLE customers ADD COLUMN estimate_total REAL DEFAULT 0;
ALTER TABLE customers ADD COLUMN estimate_owes REAL DEFAULT 0;
ALTER TABLE customers ADD COLUMN margin_percent REAL DEFAULT 0;
ALTER TABLE customers ADD COLUMN lead_source TEXT;
ALTER TABLE customers ADD COLUMN lead_status TEXT;
ALTER TABLE customers ADD COLUMN rep_name TEXT;
ALTER TABLE customers ADD COLUMN date_approved DATETIME;
ALTER TABLE customers ADD COLUMN date_signed DATETIME;
ALTER TABLE customers ADD COLUMN date_roof_scheduled DATETIME;
ALTER TABLE customers ADD COLUMN date_roof_completed DATETIME;
ALTER TABLE customers ADD COLUMN roofing_crew TEXT;
ALTER TABLE customers ADD COLUMN last_note TEXT;
ALTER TABLE customers ADD COLUMN last_note_date DATETIME;
ALTER TABLE customers ADD COLUMN insurance_phone TEXT;
ALTER TABLE customers ADD COLUMN insurance_email TEXT;
ALTER TABLE customers ADD COLUMN adjuster_phone TEXT;
ALTER TABLE customers ADD COLUMN adjuster_email TEXT;
ALTER TABLE customers ADD COLUMN needs_supplement BOOLEAN DEFAULT 0;
ALTER TABLE customers ADD COLUMN supplement_reason TEXT;

-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  format TEXT,
  has_ocr BOOLEAN DEFAULT 0,
  ocr_text TEXT,
  ocr_confidence REAL,
  annotations TEXT, -- JSON string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  event_type TEXT NOT NULL, -- 'scheduled', 'completed', 'inspection', 'meeting'
  event_date DATETIME NOT NULL,
  crew_name TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER,
  subject TEXT,
  from_address TEXT,
  body_preview TEXT,
  has_attachment BOOLEAN DEFAULT 0,
  attachment_count INTEGER DEFAULT 0,
  parsed_data TEXT, -- JSON string
  received_at DATETIME,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Create sync_logs table
CREATE TABLE IF NOT EXISTS sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_name TEXT NOT NULL,
  sync_type TEXT NOT NULL, -- 'rooflink', 'email', 'photos'
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  started_at DATETIME,
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'success' -- 'success', 'failed', 'partial'
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customers_rooflink_id ON customers(rooflink_id);
CREATE INDEX IF NOT EXISTS idx_customers_job_id ON customers(job_id);
CREATE INDEX IF NOT EXISTS idx_customers_needs_supplement ON customers(needs_supplement);
CREATE INDEX IF NOT EXISTS idx_photos_customer_id ON photos(customer_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_email_logs_customer_id ON email_logs(customer_id);
