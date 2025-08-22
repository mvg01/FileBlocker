const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'extensions.db');

let db;

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      
      console.log('Connected to SQLite database');
      createTables()
        .then(() => insertDefaultData())
        .then(() => {
          console.log('Database initialized successfully');
          resolve();
        })
        .catch(reject);
    });
  });
}

function createTables() {
  return new Promise((resolve, reject) => {
    const createFixedExtensionsTable = `
      CREATE TABLE IF NOT EXISTS fixed_extensions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(20) NOT NULL UNIQUE,
        blocked BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createCustomExtensionsTable = `
      CREATE TABLE IF NOT EXISTS custom_extensions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(20) NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createSettingsTable = `
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_name VARCHAR(50) NOT NULL UNIQUE,
        value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    db.run(createFixedExtensionsTable, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      db.run(createCustomExtensionsTable, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        db.run(createSettingsTable, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  });
}

function insertDefaultData() {
  return new Promise((resolve, reject) => {
    const defaultExtensions = [
      'bat', 'cmd', 'com', 'cpl', 'exe', 'scr', 'js'
    ];

    const stmt = db.prepare('INSERT OR IGNORE INTO fixed_extensions (name, blocked) VALUES (?, 0)');
    
    let completed = 0;
    let hasError = false;
    
    defaultExtensions.forEach((ext) => {
      stmt.run(ext, function(err) {
        if (err && !hasError) {
          hasError = true;
          reject(err);
          return;
        }
        
        completed++;
        if (completed === defaultExtensions.length && !hasError) {
          stmt.finalize();
          resolve();
        }
      });
    });
  });
}

function getFixedExtensions() {
  return new Promise((resolve, reject) => {
    db.all('SELECT name, blocked FROM fixed_extensions ORDER BY name', (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      const extensions = rows.map(row => ({
        name: row.name,
        blocked: Boolean(row.blocked)
      }));
      
      resolve(extensions);
    });
  });
}

function getCustomExtensions() {
  return new Promise((resolve, reject) => {
    db.all('SELECT name FROM custom_extensions ORDER BY name', (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      const extensions = rows.map(row => row.name);
      resolve(extensions);
    });
  });
}

function updateFixedExtension(name, blocked) {
  return new Promise((resolve, reject) => {
    const blockedValue = blocked ? 1 : 0;
    db.run(
      'UPDATE fixed_extensions SET blocked = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?',
      [blockedValue, name],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes > 0);
      }
    );
  });
}

function addCustomExtension(name) {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM custom_extensions', (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (row.count >= 200) {
        reject(new Error('Maximum custom extensions limit reached'));
        return;
      }
      
      db.get('SELECT COUNT(*) as count FROM custom_extensions WHERE name = ?', [name], (err, duplicateRow) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (duplicateRow.count > 0) {
          reject(new Error('Extension already exists'));
          return;
        }
        
        db.run('INSERT INTO custom_extensions (name) VALUES (?)', [name], function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes > 0);
        });
      });
    });
  });
}

function removeCustomExtension(name) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM custom_extensions WHERE name = ?', [name], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.changes > 0);
    });
  });
}

function getSetting(key) {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key_name = ?', [key], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row ? row.value : null);
    });
  });
}

function setSetting(key, value) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO settings (key_name, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [key, value],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes > 0);
      }
    );
  });
}

async function getFileSizeLimit() {
  const limit = await getSetting('file_size_limit_mb');
  return limit ? parseInt(limit) : 0; // 0 = 무제한
}

async function setFileSizeLimit(limitMB) {
  return await setSetting('file_size_limit_mb', limitMB.toString());
}

async function getAllExtensionData() {
  const fixedExtensions = await getFixedExtensions();
  const customExtensions = await getCustomExtensions();
  const fileSizeLimit = await getFileSizeLimit();
  
  return {
    fixedExtensions,
    customExtensions,
    fileSizeLimit
  };
}

function closeDatabase() {
  return new Promise((resolve) => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
        resolve();
      });
    } else {
      resolve();
    }
  });
}

process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});

module.exports = {
  initializeDatabase,
  getFixedExtensions,
  getCustomExtensions,
  updateFixedExtension,
  addCustomExtension,
  removeCustomExtension,
  getAllExtensionData,
  getFileSizeLimit,
  setFileSizeLimit,
  closeDatabase
};