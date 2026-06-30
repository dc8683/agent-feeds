import { getDb } from '../connection';
import { FollowedUser } from '@agent-feeds/shared';
import { v4 as uuid } from 'uuid';

export function getAllUsers(): Promise<FollowedUser[]> {
  return new Promise((resolve, reject) => {
    getDb().all('SELECT * FROM followed_user ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve((rows || []).map(parseUser));
    });
  });
}

export function getUsersByPlatform(platform: string): Promise<FollowedUser[]> {
  return new Promise((resolve, reject) => {
    getDb().all(
      'SELECT * FROM followed_user WHERE platform = ? ORDER BY created_at DESC',
      [platform],
      (err, rows) => { if (err) reject(err); else resolve((rows || []).map(parseUser)); }
    );
  });
}

export function getEnabledUsers(): Promise<FollowedUser[]> {
  return new Promise((resolve, reject) => {
    getDb().all(
      'SELECT * FROM followed_user WHERE enabled = 1',
      (err, rows) => { if (err) reject(err); else resolve((rows || []).map(parseUser)); }
    );
  });
}

export function getUserById(id: string): Promise<FollowedUser | null> {
  return new Promise((resolve, reject) => {
    getDb().get('SELECT * FROM followed_user WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row ? parseUser(row) : null);
    });
  });
}

export function getUserByPlatformId(platform: string, platformUserId: string): Promise<FollowedUser | null> {
  return new Promise((resolve, reject) => {
    getDb().get(
      'SELECT * FROM followed_user WHERE platform = ? AND platform_user_id = ?',
      [platform, platformUserId],
      (err, row) => { if (err) reject(err); else resolve(row ? parseUser(row) : null); }
    );
  });
}

export function createUser(user: Omit<FollowedUser, 'createdAt' | 'updatedAt'>): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = user.id || uuid();
    getDb().run(
      `INSERT INTO followed_user (id, platform, platform_user_id, profile, group_id, enabled, last_fetched_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, user.platform, user.platformUserId, JSON.stringify(user.profile), user.groupId, user.enabled ? 1 : 0, user.lastFetchedAt],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });
}

export function updateUser(id: string, updates: Partial<Pick<FollowedUser, 'enabled' | 'groupId' | 'lastFetchedAt'>>): Promise<void> {
  return new Promise((resolve, reject) => {
    const sets: string[] = ["updated_at = datetime('now')"];
    const vals: unknown[] = [];
    if (updates.enabled !== undefined) { sets.push('enabled = ?'); vals.push(updates.enabled ? 1 : 0); }
    if (updates.groupId !== undefined) { sets.push('group_id = ?'); vals.push(updates.groupId); }
    if (updates.lastFetchedAt !== undefined) { sets.push('last_fetched_at = ?'); vals.push(updates.lastFetchedAt); }
    vals.push(id);
    getDb().run(`UPDATE followed_user SET ${sets.join(', ')} WHERE id = ?`, vals, (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

export function deleteUser(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getDb().run('DELETE FROM followed_user WHERE id = ?', [id], (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

function parseUser(row: Record<string, unknown>): FollowedUser {
  return {
    id: row.id as string,
    platform: row.platform as FollowedUser['platform'],
    platformUserId: row.platform_user_id as string,
    profile: JSON.parse((row.profile as string) || '{}'),
    groupId: (row.group_id as string) || null,
    enabled: Boolean(row.enabled),
    lastFetchedAt: (row.last_fetched_at as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
