import { Router, Request, Response } from 'express';
import { getAllUsers, getUsersByPlatform, updateUser, deleteUser, createUser } from '../../db/repositories/users';

export function createUserRoutes(): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      const { platform } = req.query;
      const users = platform
        ? await getUsersByPlatform(platform as string)
        : await getAllUsers();
      res.json({ users });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      await updateUser(req.params.id, req.body);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await deleteUser(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      await createUser(req.body);
      res.status(201).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  router.post('/add-by-url', async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      if (!url || !url.includes('xiaohongshu.com/user/profile/')) {
        return res.status(400).json({ error: '请提供有效的小红书博主主页链接' });
      }

      // Extract userId from URL: /user/profile/{userId}
      const match = url.match(/\/user\/profile\/([a-f0-9]+)/);
      if (!match) {
        return res.status(400).json({ error: '无法从链接中提取用户 ID' });
      }

      const userId = match[1];
      const platform = url.includes('bilibili') ? 'bilibili' : url.includes('douyin') ? 'douyin' : 'xiaohongshu';

      // Check if already exists
      const { getUserByPlatformId } = await import('../../db/repositories/users');
      const existing = await getUserByPlatformId(platform, userId);
      if (existing) {
        // Re-enable if disabled
        if (!existing.enabled) {
          const { updateUser: update } = await import('../../db/repositories/users');
          await update(existing.id, { enabled: true });
        }
        return res.json({ user: existing, existed: true });
      }

      const { v4: uuid } = await import('uuid');
      const newUser = {
        id: uuid(),
        platform: platform as 'xiaohongshu' | 'bilibili' | 'douyin',
        platformUserId: userId,
        profile: { nickname: '', avatar: '' },
        groupId: null,
        enabled: true,
        lastFetchedAt: null,
      };

      await createUser(newUser);
      res.status(201).json({ user: newUser, existed: false });
    } catch (err) {
      res.status(500).json({ error: 'Failed to add user' });
    }
  });

  return router;
}
