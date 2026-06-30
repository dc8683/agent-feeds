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

  return router;
}
