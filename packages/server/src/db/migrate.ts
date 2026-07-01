import { getDb } from './connection';
import fs from 'fs';
import path from 'path';

export function runMigrations(): void {
  const db = getDb();
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    try {
      db.exec(sql);
      console.log(`Migration applied: ${file}`);
    } catch (err: any) {
      // Ignore duplicate column errors — migration already applied
      if (err.message.includes('duplicate column')) {
        console.log(`Migration skipped (already applied): ${file}`);
      } else {
        throw err;
      }
    }
  }
}
