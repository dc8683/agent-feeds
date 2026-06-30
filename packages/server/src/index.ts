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

  // Serve static web build in production
  const webDist = path.join(__dirname, '../../web/dist');
  app.use(express.static(webDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });

  app.use(errorHandler);

  app.listen(config.port, () => {
    console.log(`Agent Feeds server running at http://localhost:${config.port}`);
  });

  process.on('SIGINT', () => { closeDb(); process.exit(0); });
  process.on('SIGTERM', () => { closeDb(); process.exit(0); });
}

main().catch(console.error);
