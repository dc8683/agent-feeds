import { getDb } from '../connection';
import { RawPost } from '@agent-feeds/shared';
import { v4 as uuid } from 'uuid';

export function getPostsByAuthor(authorId: string, limit = 20): Promise<RawPost[]> {
  return new Promise((resolve, reject) => {
    getDb().all(
      'SELECT * FROM raw_post WHERE author_id = ? ORDER BY published_at DESC LIMIT ?',
      [authorId, limit],
      (err, rows) => { if (err) reject(err); else resolve((rows || []).map(parsePost)); }
    );
  });
}

export function getPostsByAuthorSince(authorId: string, since: string): Promise<RawPost[]> {
  return new Promise((resolve, reject) => {
    getDb().all(
      'SELECT * FROM raw_post WHERE author_id = ? AND published_at > ? ORDER BY published_at DESC',
      [authorId, since],
      (err, rows) => { if (err) reject(err); else resolve((rows || []).map(parsePost)); }
    );
  });
}

export function insertPost(post: RawPost): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = post.id || uuid();
    getDb().run(
      `INSERT OR IGNORE INTO raw_post (id, platform, platform_post_id, author_id, type, data, media_urls, permalink, published_at, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [id, post.platform, post.platformPostId, post.authorId, post.type,
       JSON.stringify(post.data), JSON.stringify(post.mediaUrls), post.permalink, post.publishedAt],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });
}

export function insertPosts(posts: RawPost[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO raw_post (id, platform, platform_post_id, author_id, type, data, media_urls, permalink, published_at, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    );
    for (const p of posts) {
      stmt.run([
        p.id || uuid(), p.platform, p.platformPostId, p.authorId, p.type,
        JSON.stringify(p.data), JSON.stringify(p.mediaUrls), p.permalink, p.publishedAt,
      ]);
    }
    stmt.finalize(err => { if (err) reject(err); else resolve(); });
  });
}

function parsePost(row: Record<string, unknown>): RawPost {
  return {
    id: row.id as string,
    platform: row.platform as RawPost['platform'],
    platformPostId: row.platform_post_id as string,
    authorId: row.author_id as string,
    type: row.type as RawPost['type'],
    data: JSON.parse((row.data as string) || '{}'),
    mediaUrls: JSON.parse((row.media_urls as string) || '[]'),
    permalink: row.permalink as string,
    publishedAt: row.published_at as string,
    fetchedAt: row.fetched_at as string,
  };
}
