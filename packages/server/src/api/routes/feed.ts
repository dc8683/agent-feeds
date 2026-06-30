import { Router, Request, Response } from 'express';
import { getAllFeedItems, getFeedItemById, markRead, markSaved } from '../../db/repositories/feed';
import { getUserById } from '../../db/repositories/users';

export function createFeedRoutes(): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      const { platform, group, type, cursor, limit = '20' } = req.query;
      const items = await getAllFeedItems({
        platform: platform as string | undefined,
        groupId: group as string | undefined,
        type: type as string | undefined,
        cursor: cursor as string | undefined,
        limit: parseInt(limit as string),
      });

      // Enrich items with author info
      const enriched = await Promise.all(items.map(async (item) => {
        const author = await getUserById(item.authorId);
        return {
          ...item,
          authorName: author?.profile?.nickname || '',
          authorAvatar: author?.profile?.avatar || '',
        };
      }));

      const hasMore = items.length === parseInt(limit as string);
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].createdAt : null;
      res.json({ items: enriched, nextCursor, hasMore });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch feed' });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const item = await getFeedItemById(req.params.id);
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch item' });
    }
  });

  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const { is_read, is_saved } = req.body;
      if (is_read !== undefined) await markRead(req.params.id, is_read);
      if (is_saved !== undefined) await markSaved(req.params.id, is_saved);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update' });
    }
  });

  return router;
}
