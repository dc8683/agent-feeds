import { getDb } from '../connection';
import { FeedItem } from '@agent-feeds/shared';
import { v4 as uuid } from 'uuid';

interface FeedQuery {
  platform?: string;
  groupId?: string;
  type?: string;
  cursor?: string;
  limit: number;
}

export function getAllFeedItems(query: FeedQuery): Promise<FeedItem[]> {
  return new Promise((resolve, reject) => {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.platform) { conditions.push('fi.source_platform = ?'); params.push(query.platform); }
    if (query.groupId) {
      conditions.push('fu.group_id = ?');
      params.push(query.groupId);
    }
    if (query.type) { conditions.push('fi.type = ?'); params.push(query.type); }
    if (query.cursor) { conditions.push('fi.created_at < ?'); params.push(query.cursor); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(query.limit);

    getDb().all(
      `SELECT fi.* FROM feed_item fi
       JOIN followed_user fu ON fi.author_id = fu.id
       ${where}
       ORDER BY fi.published_at DESC LIMIT ?`,
      params,
      (err, rows) => { if (err) reject(err); else resolve((rows || []).map(parseFeedItem)); }
    );
  });
}

export function getFeedItemById(id: string): Promise<FeedItem | null> {
  return new Promise((resolve, reject) => {
    getDb().get('SELECT * FROM feed_item WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row ? parseFeedItem(row) : null);
    });
  });
}

export function getFeedItemsByAuthor(authorId: string, since: string): Promise<FeedItem[]> {
  return new Promise((resolve, reject) => {
    getDb().all(
      'SELECT * FROM feed_item WHERE author_id = ? AND created_at > ? ORDER BY created_at DESC',
      [authorId, since],
      (err, rows) => { if (err) reject(err); else resolve((rows || []).map(parseFeedItem)); }
    );
  });
}

export function getUnreadCountByAuthor(authorId: string): Promise<number> {
  return new Promise((resolve, reject) => {
    getDb().get(
      'SELECT COUNT(*) as count FROM feed_item WHERE author_id = ? AND is_read = 0',
      [authorId],
      (err, row: any) => { if (err) reject(err); else resolve(row?.count || 0); }
    );
  });
}

export function insertFeedItem(item: FeedItem): Promise<void> {
  return new Promise((resolve, reject) => {
    getDb().run(
      `INSERT OR IGNORE INTO feed_item (id, raw_post_ids, author_id, type, title, summary, transcript,
       ai_tags, source_platform, source_urls, media_local_paths, cover_url, is_read, is_saved, published_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.id || uuid(), JSON.stringify(item.rawPostIds), item.authorId, item.type, item.title,
       item.summary, item.transcript, JSON.stringify(item.aiTags), item.sourcePlatform,
       JSON.stringify(item.sourceUrls), JSON.stringify(item.mediaLocalPaths),
       item.coverUrl || '',
       item.isRead ? 1 : 0, item.isSaved ? 1 : 0, item.publishedAt, item.createdAt || new Date().toISOString()],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });
}

export function markRead(id: string, isRead: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    getDb().run('UPDATE feed_item SET is_read = ? WHERE id = ?', [isRead ? 1 : 0, id], (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

export function markSaved(id: string, isSaved: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    getDb().run('UPDATE feed_item SET is_saved = ? WHERE id = ?', [isSaved ? 1 : 0, id], (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

function parseFeedItem(row: Record<string, unknown>): FeedItem {
  return {
    id: row.id as string,
    rawPostIds: JSON.parse((row.raw_post_ids as string) || '[]'),
    authorId: row.author_id as string,
    type: row.type as FeedItem['type'],
    title: row.title as string,
    summary: row.summary as string,
    transcript: (row.transcript as string) || null,
    aiTags: JSON.parse((row.ai_tags as string) || '[]'),
    sourcePlatform: row.source_platform as FeedItem['sourcePlatform'],
    sourceUrls: JSON.parse((row.source_urls as string) || '[]'),
    mediaLocalPaths: JSON.parse((row.media_local_paths as string) || '[]'),
    coverUrl: (row.cover_url as string) || undefined,
    isRead: Boolean(row.is_read),
    isSaved: Boolean(row.is_saved),
    publishedAt: row.published_at as string,
    createdAt: row.created_at as string,
  };
}
