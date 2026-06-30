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

  return router;
}
