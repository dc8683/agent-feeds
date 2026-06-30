import { getDb } from '../connection';

export function getSetting(key: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    getDb().get('SELECT value FROM settings WHERE key = ?', [key], (err, row: any) => {
      if (err) reject(err);
      else resolve(row ? row.value : null);
    });
  });
}

export function setSetting(key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getDb().run(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, value],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });
}

export function getAllSettings(): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    getDb().all('SELECT key, value FROM settings', (err, rows: any[]) => {
      if (err) reject(err);
      else {
        const result: Record<string, string> = {};
        (rows || []).forEach((r: any) => { result[r.key] = r.value; });
        resolve(result);
      }
    });
  });
}
