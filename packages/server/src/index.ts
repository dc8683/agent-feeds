import express from 'express';
import cors from 'cors';
import path from 'path';
import { loadConfig } from './config';
import { closeDb } from './db/connection';
import { createFeedRoutes } from './api/routes/feed';
import { createUserRoutes } from './api/routes/users';
import { createGroupRoutes } from './api/routes/groups';
import { createSettingsRoutes } from './api/routes/settings';
import { createFetchRoutes } from './api/routes/fetch';
import { errorHandler } from './api/middleware/error-handler';
import { FetchScheduler } from './fetcher/scheduler';
import { registerAdapter, fetchForUser } from './fetcher/orchestrator';
import { xiaohongshuAdapter } from './fetcher/adapters/xiaohongshu';
import { bilibiliAdapter } from './fetcher/adapters/bilibili';
import { douyinAdapter } from './fetcher/adapters/douyin';

async function main() {
  const config = await loadConfig();
  const app = express();

  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api/feed', createFeedRoutes());
  app.use('/api/users', createUserRoutes());
  app.use('/api/groups', createGroupRoutes());
  app.use('/api/settings', createSettingsRoutes());
  app.use('/api/fetch', createFetchRoutes());

  // Extension session endpoint
  app.post('/api/extension/session', (req, res) => {
    const { platform, cookies, userAgent } = req.body;
    // Store session in memory — used by adapters for authenticated requests
    sessions[platform] = { cookies, userAgent };
    console.log(`[Session] ${platform} connected`);
    res.json({ ok: true });
  });

  // Serve static web build in production
  const webDist = path.join(__dirname, '../../web/dist');
  app.use(express.static(webDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });

  app.use(errorHandler);

  // Register platform adapters
  registerAdapter('xiaohongshu', xiaohongshuAdapter);
  registerAdapter('bilibili', bilibiliAdapter);
  registerAdapter('douyin', douyinAdapter);

  // In-memory session store
  const sessions: Record<string, { cookies: string; userAgent: string }> = {};

  // Start fetch scheduler
  const scheduler = new FetchScheduler();
  scheduler.onFetch(async (platform, userId) => {
    const { getEnabledUsers, getUserById } = await import('./db/repositories/users');
    const user = await getUserById(userId);
    if (!user || !user.enabled) return;

    const session = sessions[platform];
    if (!session) {
      console.warn(`[${platform}] No session available, skipping fetch for ${userId}`);
      return;
    }

    await fetchForUser(user, session);
  });
  scheduler.start();

  app.listen(config.port, () => {
    console.log(`Agent Feeds server running at http://localhost:${config.port}`);
  });

  process.on('SIGINT', () => { scheduler.stop(); closeDb(); process.exit(0); });
  process.on('SIGTERM', () => { scheduler.stop(); closeDb(); process.exit(0); });
}

main().catch(console.error);
