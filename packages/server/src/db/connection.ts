import sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const DB_DIR = path.join(os.homedir(), '.agent-feeds');
const DB_PATH = path.join(DB_DIR, 'agent-feeds.db');

let db: sqlite3.Database | null = null;

export function getDb(): sqlite3.Database {
  if (!db) {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    db = new sqlite3.Database(DB_PATH);
    db.on('error', () => {}); // prevent crash on non-fatal errors
    db.run('PRAGMA journal_mode=WAL');
    db.run('PRAGMA foreign_keys=ON');
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
