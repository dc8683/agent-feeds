import { Router, Request, Response } from 'express';
import { getAllSettings, setSetting } from '../../db/repositories/settings';

export function createSettingsRoutes(): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const settings = await getAllSettings();
      res.json({ settings });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  router.patch('/', async (req: Request, res: Response) => {
    try {
      const updates = req.body as Record<string, string>;
      for (const [key, value] of Object.entries(updates)) {
        await setSetting(key, String(value));
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  return router;
}
