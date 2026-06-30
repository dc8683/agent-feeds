import { getDb } from '../connection';
import { UserGroup } from '@agent-feeds/shared';
import { v4 as uuid } from 'uuid';

export function getAllGroups(): Promise<UserGroup[]> {
  return new Promise((resolve, reject) => {
    getDb().all(
      'SELECT * FROM user_group ORDER BY sort_order ASC',
      (err, rows) => { if (err) reject(err); else resolve((rows || []).map(parseGroup)); }
    );
  });
}

export function createGroup(group: Omit<UserGroup, 'id' | 'createdAt'>): Promise<UserGroup> {
  return new Promise((resolve, reject) => {
    const id = uuid();
    getDb().run(
      'INSERT INTO user_group (id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))',
      [id, group.name, group.color, group.sortOrder],
      (err) => {
        if (err) reject(err);
        else resolve({ id, ...group, createdAt: new Date().toISOString() });
      }
    );
  });
}

export function updateGroup(id: string, updates: Partial<Pick<UserGroup, 'name' | 'color' | 'sortOrder'>>): Promise<void> {
  return new Promise((resolve, reject) => {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (updates.name !== undefined) { sets.push('name = ?'); vals.push(updates.name); }
    if (updates.color !== undefined) { sets.push('color = ?'); vals.push(updates.color); }
    if (updates.sortOrder !== undefined) { sets.push('sort_order = ?'); vals.push(updates.sortOrder); }
    vals.push(id);
    getDb().run(`UPDATE user_group SET ${sets.join(', ')} WHERE id = ?`, vals, (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

export function deleteGroup(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getDb().run('DELETE FROM user_group WHERE id = ?', [id], (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

function parseGroup(row: Record<string, unknown>): UserGroup {
  return {
    id: row.id as string,
    name: row.name as string,
    color: row.color as string,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
  };
}
