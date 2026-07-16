const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../database/customers.db');

class DatabaseService {
  constructor() {
    this.db = null;
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds cache
    this.connect();
  }

  connect() {
    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Database connection error:', err);
      } else {
        console.log('Connected to SQLite database at:', DB_PATH);
        // Enable performance optimizations
        this.db.run('PRAGMA journal_mode = WAL');
        this.db.run('PRAGMA synchronous = NORMAL');
        this.db.run('PRAGMA cache_size = 10000');
        this.db.run('PRAGMA temp_store = MEMORY');
        this.createIndexes();
      }
    });
  }

  // Create indexes for better query performance
  createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status)',
      'CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers(updated_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)',
      'CREATE INDEX IF NOT EXISTS idx_customers_job_id ON customers(job_id)',
      'CREATE INDEX IF NOT EXISTS idx_activities_customer_id ON customer_activities(customer_id)',
      'CREATE INDEX IF NOT EXISTS idx_activities_date ON customer_activities(activity_date DESC)'
    ];

    indexes.forEach(indexQuery => {
      this.db.run(indexQuery, (err) => {
        if (err && !err.message.includes('already exists')) {
          console.error('Index creation error:', err);
        }
      });
    });
  }

  // Simple cache helper
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCached(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  invalidateCache(pattern = null) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // Get all customers with pagination and filtering
  async getAllCustomers(page = 1, limit = 50, status = null, search = null) {
    const cacheKey = `customers:${page}:${limit}:${status}:${search}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;
      let query = `SELECT
        id, name, property_address, city, state, zip,
        status, job_id, claim_number, photo_count,
        rcv_amount, collected_amount, days_supplementing,
        created_at, updated_at, kanban_stage
        FROM customers WHERE 1=1`;
      const params = [];

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      if (search) {
        query += ' AND (name LIKE ? OR property_address LIKE ? OR claim_number LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          this.setCached(cacheKey, rows);
          resolve(rows);
        }
      });
    });
  }

  // Get customer by ID
  async getCustomerById(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM customers WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // Get customer activities
  async getCustomerActivities(customerId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM customer_activities WHERE customer_id = ? ORDER BY activity_date DESC',
        [customerId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // Update customer
  async updateCustomer(id, data) {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
      const values = Object.values(data);
      values.push(id);

      this.db.run(
        `UPDATE customers SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        function(err) {
          if (err) {
            reject(err);
          } else {
            // Invalidate cache when customer is updated
            this.invalidateCache('customers:');
            this.invalidateCache(`customer:${id}`);
            resolve({ changes: this.changes });
          }
        }.bind(this)
      );
    });
  }

  // Search customers
  async searchCustomers(query) {
    return new Promise((resolve, reject) => {
      const searchTerm = `%${query}%`;
      this.db.all(
        `SELECT * FROM customers
         WHERE name LIKE ? OR property_address LIKE ? OR claim_number LIKE ?
         ORDER BY name LIMIT 20`,
        [searchTerm, searchTerm, searchTerm],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // Get customers by status
  async getCustomersByStatus(status) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM customers WHERE status = ? ORDER BY updated_at DESC',
        [status],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // Get customer count
  async getCustomerCount(status = null, search = null) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT COUNT(*) as count FROM customers WHERE 1=1';
      const params = [];

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      if (search) {
        query += ' AND (name LIKE ? OR property_address LIKE ? OR claim_number LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      this.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  }

  // Get dashboard statistics
  async getDashboardStats() {
    return new Promise((resolve, reject) => {
      const stats = {};

      // Get total customers
      this.db.get('SELECT COUNT(*) as total FROM customers', (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        stats.totalCustomers = row.total;

        // Get customers by status
        this.db.all(`
          SELECT status, COUNT(*) as count
          FROM customers
          GROUP BY status
        `, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          stats.byStatus = {};
          rows.forEach(row => {
            stats.byStatus[row.status] = row.count;
          });

          resolve(stats);
        });
      });
    });
  }

  // Get customer by RoofLink ID
  async getCustomerByRoofLinkId(rooflinkId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM customers WHERE rooflink_id = ? OR job_id = ?',
        [rooflinkId, rooflinkId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  // Create new customer
  async createCustomer(customerData) {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(customerData);
      const placeholders = fields.map(() => '?').join(', ');
      const values = Object.values(customerData);

      const query = `
        INSERT INTO customers (${fields.join(', ')})
        VALUES (${placeholders})
      `;

      this.db.run(query, values, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
  }

  // Add activity for customer
  async addActivity(customerId, activityData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO customer_activities (customer_id, activity_date, activity_type, description, attachments)
        VALUES (?, ?, ?, ?, ?)
      `;

      this.db.run(
        query,
        [
          customerId,
          activityData.activity_date || new Date().toISOString().split('T')[0],
          activityData.activity_type || 'System Update',
          activityData.description || '',
          activityData.attachments || 'N/A'
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
  }

  // Get or create customer folder path
  getCustomerFolderPath(customer) {
    const basePath = process.env.CUSTOMER_PROFILES_PATH;
    const normalizedName = customer.name.toUpperCase().replace(/\s+/g, '_');
    const jobId = customer.job_id || 'UNKNOWN';
    return path.join(basePath, normalizedName, `JOB_${jobId}_ORGANIZED`);
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = new DatabaseService();
