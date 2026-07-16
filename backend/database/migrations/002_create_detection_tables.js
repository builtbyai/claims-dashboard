const db = require('../db');

/**
 * Create supplement detection tracking table
 */
const createDetectionTable = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS supplement_detections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL,
        estimate_id INTEGER,
        confidence REAL NOT NULL,
        reasons TEXT NOT NULL,
        items_created INTEGER DEFAULT 0,
        auto_generated INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        created_by TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_detections_job_id ON supplement_detections(job_id);
      CREATE INDEX IF NOT EXISTS idx_detections_created_at ON supplement_detections(created_at);
    `;

    db.exec(sql, (err) => {
      if (err) {
        console.error('Error creating detection table:', err);
        reject(err);
      } else {
        console.log('✓ Supplement detections table created successfully');
        resolve();
      }
    });
  });
};

/**
 * Run migration
 */
const runMigration = async () => {
  try {
    await createDetectionTable();
    console.log('✓ Detection migration completed');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

module.exports = { runMigration, createDetectionTable };

// Run if executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Migration successful!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
