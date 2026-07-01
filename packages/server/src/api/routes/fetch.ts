import { Router, Request, Response } from 'express';
import { getUserById } from '../../db/repositories/users';

// In-memory fetch queue — server pushes URLs, extension polls and navigates
const fetchQueue: { url: string; userId: string }[] = [];

export function getFetchQueue() {
  return fetchQueue;
}

export function createFetchRoutes(): Router {
  const router = Router();

  // User clicks "fetch" → server queues the URL
  router.post('/trigger', async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const user = await getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const url = `https://www.xiaohongshu.com/user/profile/${user.platformUserId}`;
      fetchQueue.push({ url, userId });

      res.json({ ok: true, message: `Queued fetch for ${user.profile.nickname || userId}` });
    } catch (err) {
      res.status(500).json({ error: 'Failed to trigger fetch' });
    }
  });

  // Extension polls this to get pending fetch URLs
  router.get('/pending', (_req: Request, res: Response) => {
    const item = fetchQueue.shift();
    if (item) {
      res.json({ pending: true, url: item.url, userId: item.userId });
    } else {
      res.json({ pending: false });
    }
  });

  // Dedup: check which noteIds already exist
  router.post('/check-notes', async (req: Request, res: Response) => {
    try {
      const { platform, noteIds } = req.body;
      if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
        return res.json({ newIds: [] });
      }
      const { getExistingPostIds } = await import('../../db/repositories/posts');
      const existing = await getExistingPostIds(platform, noteIds);
      const newIds = noteIds.filter((id: string) => !existing.has(id));
      res.json({ newIds });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

// Enqueue a session-refresh URL — called by scheduler when no session
export function enqueueSessionRefresh(platform: string, userId?: string): void {
  const urlMap: Record<string, string> = {
    xiaohongshu: 'https://www.xiaohongshu.com/explore',
    bilibili: 'https://www.bilibili.com',
    douyin: 'https://www.douyin.com',
  };
  const url = urlMap[platform];
  if (url) {
    fetchQueue.push({ url, userId: userId || '__session_refresh__' });
  }
}
