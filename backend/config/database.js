const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path - use parent supplement_dashboard directory
const DB_PATH = path.join(__dirname, '../../supplement_dashboard.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', DB_PATH);
  }
});

// Promisify database methods for async/await support
const promisify = (method) => {
  return function (...args) {
    return new Promise((resolve, reject) => {
      method.apply(this, [
        ...args,
        function (err, result) {
          if (err) reject(err);
          else resolve(result);
        },
      ]);
    });
  };
};

// Export promisified methods
module.exports = {
  db,
  get: promisify(db.get.bind(db)),
  all: promisify(db.all.bind(db)),
  run: promisify(db.run.bind(db)),
  exec: promisify(db.exec.bind(db)),
  close: () => {
    return new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },
};
