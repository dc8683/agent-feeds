import { Router, Request, Response } from 'express';
import { xiaohongshuAdapter } from '../../fetcher/adapters/xiaohongshu';
import { getUserById } from '../../db/repositories/users';
import { fetchForUser } from '../../fetcher/orchestrator';

export function createFetchRoutes(): Router {
  const router = Router();

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

      // For CDP-based platforms, session is not needed (browser handles auth)
      const session = { cookies: '', userAgent: '' };

      // Run fetch in background, respond immediately
      fetchForUser(user, session).then(() => {
        console.log(`[Fetch] Completed for user ${userId}`);
      }).catch(err => {
        console.error(`[Fetch] Error for user ${userId}:`, err.message);
      });

      res.json({ ok: true, message: `Fetch started for ${user.profile.nickname || userId}` });
    } catch (err) {
      res.status(500).json({ error: 'Failed to trigger fetch' });
    }
  });

  return router;
}
