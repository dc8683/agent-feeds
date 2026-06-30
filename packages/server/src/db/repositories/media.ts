import { getDb } from '../connection';
import { MediaCache } from '@agent-feeds/shared';
import { v4 as uuid } from 'uuid';

export function getPendingMedia(): Promise<MediaCache[]> {
  return new Promise((resolve, reject) => {
    getDb().all(
      "SELECT * FROM media_cache WHERE status = 'pending' ORDER BY created_at ASC",
      (err, rows) => { if (err) reject(err); else resolve((rows || []).map(parseMedia)); }
    );
  });
}

export function insertMedia(m: Omit<MediaCache, 'localPath' | 'fileSize'> & { localPath?: string | null; fileSize?: number | null }): Promise<void> {
  return new Promise((resolve, reject) => {
    getDb().run(
      `INSERT INTO media_cache (id, post_id, original_url, local_path, type, status, file_size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [m.id || uuid(), m.postId, m.originalUrl, m.localPath || null, m.type, m.status, m.fileSize || null, m.createdAt || new Date().toISOString()],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });
}

export function updateMediaStatus(id: string, status: string, localPath: string | null, fileSize: number | null): Promise<void> {
  return new Promise((resolve, reject) => {
    getDb().run(
      'UPDATE media_cache SET status = ?, local_path = ?, file_size = ? WHERE id = ?',
      [status, localPath, fileSize, id],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });
}

export function getExpiredMedia(beforeDate: string): Promise<MediaCache[]> {
  return new Promise((resolve, reject) => {
    getDb().all(
      'SELECT * FROM media_cache WHERE created_at < ?',
      [beforeDate],
      (err, rows) => { if (err) reject(err); else resolve((rows || []).map(parseMedia)); }
    );
  });
}

export function deleteMedia(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getDb().run('DELETE FROM media_cache WHERE id = ?', [id], (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

function parseMedia(row: Record<string, unknown>): MediaCache {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    originalUrl: row.original_url as string,
    localPath: (row.local_path as string) || null,
    type: row.type as MediaCache['type'],
    status: row.status as MediaCache['status'],
    fileSize: (row.file_size as number) || null,
    createdAt: row.created_at as string,
  };
}
