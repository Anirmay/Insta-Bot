import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'reelai_assistant.sqlite');
const db = new DatabaseSync(dbPath);

// Initialize schema
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    target_reels INTEGER DEFAULT 50,
    active_key_id TEXT,
    selected_model TEXT DEFAULT 'gemini-3.8-flash',
    instagram_logged_in INTEGER DEFAULT 0,
    status TEXT DEFAULT 'idle',
    current_reel_url TEXT,
    current_step TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    masked_key TEXT NOT NULL,
    encrypted_secret TEXT NOT NULL,
    is_active INTEGER DEFAULT 0,
    status TEXT DEFAULT 'untested',
    last_tested_at TEXT,
    error_message TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS reels (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    video_path TEXT,
    video_filename TEXT,
    video_mime TEXT,
    video_size INTEGER,
    status TEXT DEFAULT 'pending',
    category TEXT,
    visual_summary TEXT,
    mood TEXT,
    language TEXT,
    error_message TEXT,
    processed_order INTEGER,
    created_at TEXT,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    reel_id TEXT NOT NULL,
    text TEXT NOT NULL,
    tone TEXT,
    is_approved INTEGER DEFAULT 0,
    is_posted INTEGER DEFAULT 0,
    created_at TEXT,
    approved_at TEXT,
    posted_at TEXT,
    FOREIGN KEY(reel_id) REFERENCES reels(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT DEFAULT 'info',
    message TEXT NOT NULL,
    details TEXT,
    timestamp TEXT
  );
`);

// Ensure schema migrations for reels and settings tables
try { db.exec('ALTER TABLE reels ADD COLUMN main_subject TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE reels ADD COLUMN actions TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE reels ADD COLUMN frames_count INTEGER DEFAULT 0'); } catch(e) {}
try { db.exec('ALTER TABLE reels ADD COLUMN thumbnail_path TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE reels ADD COLUMN analysis_source TEXT DEFAULT "none"'); } catch(e) {}
try { db.exec('ALTER TABLE reels ADD COLUMN retrieval_status TEXT DEFAULT "pending"'); } catch(e) {}
try { db.exec('ALTER TABLE reels ADD COLUMN video_duration REAL'); } catch(e) {}

try { db.exec('ALTER TABLE settings ADD COLUMN instagram_session_status TEXT DEFAULT "disconnected"'); } catch(e) {}
try { db.exec('ALTER TABLE settings ADD COLUMN instagram_username TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE settings ADD COLUMN instagram_last_checked TEXT'); } catch(e) {}

// Ensure default settings row
const existingSettings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
if (!existingSettings) {
  db.prepare(`
    INSERT INTO settings (id, target_reels, selected_model, instagram_logged_in, instagram_session_status, status, current_step, updated_at)
    VALUES (1, 50, 'gemini-3.8-flash', 0, 'disconnected', 'idle', 'Ready to start', ?)
  `).run(new Date().toISOString());
} else if (
  !existingSettings.selected_model ||
  existingSettings.selected_model === 'gemini-2.5-flash' ||
  existingSettings.selected_model.startsWith('gemini-2.5') ||
  existingSettings.selected_model.startsWith('gemini-1.5')
) {
  // Migrate deprecated models to supported gemini-3.8-flash
  db.prepare(`
    UPDATE settings SET selected_model = 'gemini-3.8-flash', updated_at = ? WHERE id = 1
  `).run(new Date().toISOString());
}

export function getDb() {
  return db;
}

export function logActivity(level, message, details = null) {
  try {
    const timestamp = new Date().toISOString();
    const detailsStr = typeof details === 'object' && details !== null ? JSON.stringify(details) : details;
    db.prepare(`
      INSERT INTO activity_logs (level, message, details, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(level, message, detailsStr, timestamp);
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
}

export default {
  getDb,
  logActivity
};
