import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(process.env.DB_PATH || path.join(process.cwd(), 'data-db', 'velopro.db'));

let db = null;
let dbInitialized = false;

async function initDb() {
  if (dbInitialized) return db;
  
  const SQL = await initSqlJs({
    locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.0/${file}`
  });

  let existingData = null;
  try {
    if (fs.existsSync(DB_PATH)) {
      existingData = fs.readFileSync(DB_PATH);
    }
  } catch (e) {
    console.warn('Could not read existing DB file:', e.message);
  }

  db = new SQL.Database(existingData);

  // Enable WAL mode for better concurrent access
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT,
      wallet_balance REAL DEFAULT 0,
      card_token TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      device_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh_key TEXT,
      auth_key TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS app_versions (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'stable',
      download_url TEXT,
      size INTEGER,
      min_sdk_version INTEGER DEFAULT 29,
      release_date TEXT,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS maintenance (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER DEFAULT 0,
      message TEXT DEFAULT 'Идут технические работы\nСкоро вернемся,\nа сейчас мы вносим улучшения...\n\nЧерез некоторое время всё заработает.',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rentals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      bike_id TEXT NOT NULL,
      bike_name TEXT NOT NULL,
      bike_cost_per_day REAL NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      auto_renew INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      robokassa_invoice_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    INSERT OR IGNORE INTO maintenance (id, enabled, message) VALUES (1, 0, 'Идут технические работы\nСкоро вернемся,\nа сейчас мы вносим улучшения...\n\nЧерез некоторое время всё заработает.');
  `);

  // Save initial state
  saveDb();

  dbInitialized = true;
  return db;
}

function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.warn('Could not save DB:', e.message);
  }
}

// Очередь операций с jitter для предотвращения потери данных при одновременных операциях
const operationQueue = [];
let isProcessing = false;

function getJitter() {
  return 50 + Math.floor(Math.random() * 650); // 50-700 ms
}

function enqueue(operation) {
  return new Promise((resolve, reject) => {
    operationQueue.push({ operation, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (operationQueue.length > 0) {
    const { operation, resolve, reject } = operationQueue.shift();
    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    }

    // Jitter между операциями (50-700 мс)
    if (operationQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, getJitter()));
    }
  }

  isProcessing = false;
}

// Helper to run SQL with params
function run(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  return stmt.run(params);
}

// Helper to get single row
function get(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  return stmt.get(params);
}

// Helper to get all rows
function all(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  return stmt.all(params);
}

export { db, enqueue, initDb, saveDb, run, get, all };
export default { db, enqueue, initDb, saveDb, run, get, all };