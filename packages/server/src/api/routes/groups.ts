import { Router, Request, Response } from 'express';
import { getAllGroups, createGroup, updateGroup, deleteGroup } from '../../db/repositories/groups';

export function createGroupRoutes(): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const groups = await getAllGroups();
      res.json({ groups });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch groups' });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const group = await createGroup(req.body);
      res.status(201).json(group);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create group' });
    }
  });

  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      await updateGroup(req.params.id, req.body);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update group' });
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await deleteGroup(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete group' });
    }
  });

  return router;
}
