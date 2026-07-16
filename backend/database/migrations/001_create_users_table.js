const db = require('../db');

/**
 * Create users table for authentication
 */
const createUsersTable = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin', 'manager', 'viewer')),
        created_at TEXT NOT NULL,
        last_login TEXT,
        is_active INTEGER DEFAULT 1,
        preferences TEXT DEFAULT '{}',
        UNIQUE(email)
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    `;

    db.exec(sql, (err) => {
      if (err) {
        console.error('Error creating users table:', err);
        reject(err);
      } else {
        console.log('✓ Users table created successfully');
        resolve();
      }
    });
  });
};

/**
 * Create default admin user
 */
const createDefaultAdmin = async () => {
  const bcrypt = require('bcryptjs');

  return new Promise(async (resolve, reject) => {
    // Check if admin already exists
    db.get('SELECT * FROM users WHERE role = ?', ['admin'], async (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      if (row) {
        console.log('✓ Admin user already exists');
        resolve();
        return;
      }

      // Create default admin
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);

      db.run(
        'INSERT INTO users (email, password, name, role, created_at) VALUES (?, ?, ?, ?, ?)',
        ['admin@example.com', hashedPassword, 'Administrator', 'admin', new Date().toISOString()],
        (err) => {
          if (err) {
            console.error('Error creating default admin:', err);
            reject(err);
          } else {
            console.log('✓ Default admin created (email: admin@example.com, password: admin123)');
            resolve();
          }
        }
      );
    });
  });
};

/**
 * Run migration
 */
const runMigration = async () => {
  try {
    await createUsersTable();
    await createDefaultAdmin();
    console.log('✓ Users migration completed');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

module.exports = { runMigration, createUsersTable, createDefaultAdmin };

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
