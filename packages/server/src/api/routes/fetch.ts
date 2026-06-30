import { Router, Request, Response } from 'express';

export function createFetchRoutes(): Router {
  const router = Router();

  router.post('/trigger', async (_req: Request, res: Response) => {
    try {
      // MVP: manual fetch trigger — will be wired to orchestrator in Task 15
      res.json({ ok: true, message: 'Manual fetch triggered (not yet implemented)' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to trigger fetch' });
    }
  });

  return router;
}
