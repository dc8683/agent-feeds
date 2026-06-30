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

const PLATFORMS = ['xiaohongshu', 'bilibili', 'douyin'];

interface SessionEntry {
  cookies: string;
  userAgent: string;
  updatedAt: number;
}

async function main() {
  const config = await loadConfig();
  const app = express();

  app.use(cors());
  app.use(express.json());

  // In-memory session store
  const sessions: Record<string, SessionEntry> = {};

  // API routes
  app.use('/api/feed', createFeedRoutes());
  app.use('/api/users', createUserRoutes());
  app.use('/api/groups', createGroupRoutes());
  app.use('/api/settings', createSettingsRoutes());
  app.use('/api/fetch', createFetchRoutes());

  // Extension session endpoint
  app.post('/api/extension/session', (req, res) => {
    const { platform, cookies, userAgent } = req.body;
    sessions[platform] = { cookies, userAgent, updatedAt: Date.now() };
    console.log(`[Session] ${platform} connected`);
    res.json({ ok: true });
  });

  // Extension data endpoint — receives scraped notes from content script
  app.post('/api/extension/data', async (req, res) => {
    try {
      const { platform, userId, profile, notes } = req.body;

      if (!notes || !Array.isArray(notes) || notes.length === 0) {
        return res.json({ ok: true, message: 'No notes to process' });
      }

      // Upsert followed_user
      const { getUserByPlatformId, createUser, updateUser } = await import('./db/repositories/users');
      const { v4: uuid } = await import('uuid');
      const { getDb } = await import('./db/connection');

      let user = await getUserByPlatformId(platform, userId);
      if (!user) {
        const newUser = {
          id: uuid(),
          platform: platform as 'xiaohongshu',
          platformUserId: userId,
          profile: profile || { nickname: '', avatar: '' },
          groupId: null as string | null,
          enabled: true,
          lastFetchedAt: null as string | null,
        };
        await createUser(newUser);
        user = newUser;
      } else if (profile?.nickname && user.profile.nickname !== profile.nickname) {
        // Update nickname
        getDb().run(
          "UPDATE followed_user SET profile = ?, updated_at = datetime('now') WHERE id = ?",
          [JSON.stringify(profile), user.id]
        );
      }

      // Convert notes to RawPost and insert
      const { insertPosts } = await import('./db/repositories/posts');
      const now = new Date().toISOString();

      const rawPosts: any[] = notes.map((n: any) => ({
        id: uuid(),
        platform,
        platformPostId: n.noteId,
        authorId: user!.id,
        type: 'image_text',
        data: { noteId: n.noteId, coverUrl: n.coverUrl, footerText: n.footerText, isPinned: n.isPinned },
        mediaUrls: n.coverUrl ? [n.coverUrl] : [],
        permalink: n.noteUrl || `https://www.xiaohongshu.com/explore/${n.noteId}`,
        publishedAt: now,
        fetchedAt: now,
      }));

      await insertPosts(rawPosts);

      // Generate feed items via summarizer
      const { summarizePost } = await import('./summarizer/single');
      for (const post of rawPosts) {
        try {
          await summarizePost(post);
        } catch (err: any) {
          console.error(`[Extension Data] Summarize error: ${err.message}`);
        }
      }

      console.log(`[Extension Data] Processed ${notes.length} notes from ${platform}/${userId}`);
      res.json({ ok: true, processed: notes.length });
    } catch (err: any) {
      console.error('[Extension Data] Error:', err.message);
      res.status(500).json({ error: 'Failed to process data' });
    }
  });

  // Extension status endpoint — queried by web UI
  app.get('/api/extension/status', (_req, res) => {
    const SESSION_TTL = 30 * 60 * 1000; // 30 min
    const statuses = PLATFORMS.map(platform => {
      const s = sessions[platform];
      if (!s) {
        return { platform, status: 'disconnected', message: '未连接' };
      }
      if (Date.now() - s.updatedAt > SESSION_TTL) {
        return { platform, status: 'expired', message: 'Session 已过期' };
      }
      return { platform, status: 'connected', message: '已连接' };
    });
    res.json({ statuses });
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

  // Start fetch scheduler
  const scheduler = new FetchScheduler();
  scheduler.onFetch(async (platform, userId) => {
    const { getUserById } = await import('./db/repositories/users');
    const user = await getUserById(userId);
    if (!user || !user.enabled) return;

    const session = sessions[platform];
    if (!session) {
      console.warn(`[${platform}] No session available, skipping fetch for ${userId}`);
      return;
    }

    await fetchForUser(user, { cookies: session.cookies, userAgent: session.userAgent });
  });
  scheduler.start();

  app.listen(config.port, () => {
    console.log(`Agent Feeds server running at http://localhost:${config.port}`);
  });

  process.on('SIGINT', () => { scheduler.stop(); closeDb(); process.exit(0); });
  process.on('SIGTERM', () => { scheduler.stop(); closeDb(); process.exit(0); });
}

main().catch(console.error);
