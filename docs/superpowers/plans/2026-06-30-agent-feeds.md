# Agent Feeds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MVP — 仅小红书图文内容，通过云端 LLM 总结，在本地 Web 页面呈现统一信息流。完整 Pipeline 架构就位，视频/多平台为后续迭代。

**MVP Scope:** 小红书 only, text + image_text posts. Transcriber present but passes through (video deferred). Downloader deferred.

**Architecture:** Pipeline — Extension(小红书) → Fetcher → Summarizer(LLM) → Feed Server + Web UI. Monorepo with shared types, server, Vue SPA, and browser extension.

**Tech Stack:** TypeScript, Node.js, Express, sqlite3, Vue 3 + Vite + Vue Router, pnpm workspaces, Manifest V3

---

### Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `pnpm-workspace.yaml`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/extension/package.json`
- Create: `packages/extension/tsconfig.json`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "agent-feeds",
  "private": true,
  "scripts": {
    "dev:server": "pnpm --filter @agent-feeds/server dev",
    "dev:web": "pnpm --filter @agent-feeds/web dev",
    "build:web": "pnpm --filter @agent-feeds/web build",
    "build:extension": "pnpm --filter @agent-feeds/extension build"
  }
}
```

- [ ] **Step 2: Create root tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 4: Create packages/shared/package.json**

```json
{
  "name": "@agent-feeds/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

- [ ] **Step 5: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create packages/shared/src/types.ts**

```typescript
// Platform enum
export type Platform = 'xiaohongshu' | 'bilibili' | 'douyin';

// Followed user (Feed subscription)
export interface FollowedUser {
  id: string;
  platform: Platform;
  platformUserId: string;
  profile: UserProfile;
  groupId: string | null;
  enabled: boolean;
  lastFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  nickname: string;
  avatar: string;
  bio?: string;
  followerCount?: number;
}

// Raw post from platform
export interface RawPost {
  id: string;
  platform: Platform;
  platformPostId: string;
  authorId: string;
  type: PostType;
  data: Record<string, unknown>;
  mediaUrls: string[];
  permalink: string;
  publishedAt: string;
  fetchedAt: string;
}

export type PostType = 'video' | 'image_text' | 'text';

// Media cache entry
export interface MediaCache {
  id: string;
  postId: string;
  originalUrl: string;
  localPath: string | null;
  type: MediaType;
  status: MediaStatus;
  fileSize: number | null;
  createdAt: string;
}

export type MediaType = 'video' | 'audio' | 'image';
export type MediaStatus = 'pending' | 'downloading' | 'done' | 'failed';

// Feed item (AI-processed output)
export interface FeedItem {
  id: string;
  rawPostIds: string[];
  authorId: string;
  type: FeedItemType;
  title: string;
  summary: string;
  transcript: string | null;
  aiTags: string[];
  sourcePlatform: Platform;
  sourceUrls: string[];
  mediaLocalPaths: string[];
  isRead: boolean;
  isSaved: boolean;
  publishedAt: string;
  createdAt: string;
}

export type FeedItemType = 'single' | 'user_digest';

// User group
export interface UserGroup {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
}

// Settings
export interface AppSettings {
  port: number;
  fetchIntervalMinutes: number;
  llm: LlmConfig;
  whisper: WhisperConfig;
  mediaCacheTtlDays: number;
}

export interface LlmConfig {
  provider: string;
  apiKey: string;
  model: string;
}

export interface WhisperConfig {
  provider: string;
  apiKey: string;
  model: string;
}

// Platform adapter interface
export interface PlatformAdapter {
  platform: Platform;
  fetchFollowList(session: SessionTokens): Promise<PlatformUser[]>;
  fetchPosts(userId: string, session: SessionTokens): Promise<RawPost[]>;
}

export interface PlatformUser {
  platformUserId: string;
  profile: UserProfile;
}

export interface SessionTokens {
  cookies: string;
  userAgent: string;
}

// Platform connection status
export interface PlatformStatus {
  platform: Platform;
  status: 'connected' | 'expired' | 'rate_limited' | 'error' | 'disconnected';
  message: string;
}
```

- [ ] **Step 7: Create packages/shared/src/index.ts**

```typescript
export * from './types';
```

- [ ] **Step 8: Create packages/server/package.json**

```json
{
  "name": "@agent-feeds/server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "@agent-feeds/shared": "workspace:*",
    "express": "^4.21.0",
    "cors": "^2.8.5",
    "sqlite3": "^5.1.7",
    "uuid": "^10.0.0",
    "ffmpeg-static": "^5.2.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/uuid": "^10.0.0",
    "tsx": "^4.19.0"
  }
}
```

- [ ] **Step 9: Create packages/server/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 10: Create packages/web/package.json**

```json
{
  "name": "@agent-feeds/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.5.0",
    "vue-router": "^4.4.0",
    "@agent-feeds/shared": "workspace:*"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.1.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vue-tsc": "^2.1.0"
  }
}
```

- [ ] **Step 11: Create packages/web/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "jsx": "preserve",
    "jsxImportSource": "vue"
  },
  "include": ["src"]
}
```

- [ ] **Step 12: Create packages/extension/package.json**

```json
{
  "name": "@agent-feeds/extension",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.270",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 13: Create packages/extension/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"]
}
```

- [ ] **Step 14: Install dependencies**

```bash
cd /Users/jinchao.chen/Desktop/agent/agent-feeds && pnpm install
```

Expected: All packages install without errors.

- [ ] **Step 15: Commit**

```bash
git add package.json tsconfig.json pnpm-workspace.yaml packages/
git commit -m "feat: scaffold monorepo with shared/server/web/extension packages"
```

---

### Task 2: Server — Database Layer

**Files:**
- Create: `packages/server/src/db/connection.ts`
- Create: `packages/server/src/db/migrations/001_init.sql`
- Create: `packages/server/src/db/migrate.ts`
- Create: `packages/server/src/db/repositories/users.ts`
- Create: `packages/server/src/db/repositories/posts.ts`
- Create: `packages/server/src/db/repositories/media.ts`
- Create: `packages/server/src/db/repositories/feed.ts`
- Create: `packages/server/src/db/repositories/groups.ts`
- Create: `packages/server/src/db/repositories/settings.ts`

- [ ] **Step 1: Create DB connection module**

```typescript
// packages/server/src/db/connection.ts
import sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';

const DB_DIR = path.join(os.homedir(), '.agent-feeds');
const DB_PATH = path.join(DB_DIR, 'agent-feeds.db');

let db: sqlite3.Database | null = null;

export function getDb(): sqlite3.Database {
  if (!db) {
    const fs = require('fs');
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    db = new sqlite3.Database(DB_PATH);
    db.run('PRAGMA journal_mode=WAL');
    db.run('PRAGMA foreign_keys=ON');
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

- [ ] **Step 2: Create migration SQL**

```sql
-- packages/server/src/db/migrations/001_init.sql

CREATE TABLE IF NOT EXISTS user_group (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS followed_user (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK(platform IN ('xiaohongshu','bilibili','douyin')),
  platform_user_id TEXT NOT NULL,
  profile TEXT NOT NULL DEFAULT '{}',
  group_id TEXT REFERENCES user_group(id) ON DELETE SET NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_fetched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS raw_post (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  platform_post_id TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES followed_user(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('video','image_text','text')),
  data TEXT NOT NULL DEFAULT '{}',
  media_urls TEXT NOT NULL DEFAULT '[]',
  permalink TEXT NOT NULL DEFAULT '',
  published_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(platform, platform_post_id)
);

CREATE TABLE IF NOT EXISTS media_cache (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES raw_post(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  local_path TEXT,
  type TEXT NOT NULL CHECK(type IN ('video','audio','image')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','downloading','done','failed')),
  file_size INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feed_item (
  id TEXT PRIMARY KEY,
  raw_post_ids TEXT NOT NULL DEFAULT '[]',
  author_id TEXT NOT NULL REFERENCES followed_user(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('single','user_digest')),
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  transcript TEXT,
  ai_tags TEXT NOT NULL DEFAULT '[]',
  source_platform TEXT NOT NULL,
  source_urls TEXT NOT NULL DEFAULT '[]',
  media_local_paths TEXT NOT NULL DEFAULT '[]',
  is_read INTEGER NOT NULL DEFAULT 0,
  is_saved INTEGER NOT NULL DEFAULT 0,
  published_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('fetch_interval_minutes', '30');
INSERT OR IGNORE INTO settings (key, value) VALUES ('media_cache_ttl_days', '7');
INSERT OR IGNORE INTO settings (key, value) VALUES ('llm_provider', 'deepseek');
INSERT OR IGNORE INTO settings (key, value) VALUES ('llm_model', 'deepseek-chat');
INSERT OR IGNORE INTO settings (key, value) VALUES ('whisper_provider', 'openai');
INSERT OR IGNORE INTO settings (key, value) VALUES ('whisper_model', 'whisper-1');
```

- [ ] **Step 3: Create migration runner**

```typescript
// packages/server/src/db/migrate.ts
import { getDb } from './connection';
import fs from 'fs';
import path from 'path';

export function runMigrations(): void {
  const db = getDb();
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    db.exec(sql);
    console.log(`Migration applied: ${file}`);
  }
}
```

- [ ] **Step 4: Create user repository**

```typescript
// packages/server/src/db/repositories/users.ts
import { getDb } from '../connection';
import { FollowedUser } from '@agent-feeds/shared';
import { v4 as uuid } from 'uuid';

export function getAllUsers(): Promise<FollowedUser[]> {
  return new Promise((resolve, reject) => {
    getDb().all('SELECT * FROM followed_user ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve((rows || []).map(parseUser));
    });
  });
}

export function getUsersByPlatform(platform: string): Promise<FollowedUser[]> {
  return new Promise((resolve, reject) => {
    getDb().all(
      'SELECT * FROM followed_user WHERE platform = ? ORDER BY created_at DESC',
      [platform],
      (err, rows) => { if (err) reject(err); else resolve((rows || []).map(parseUser)); }
    );
  });
}

export function getEnabledUsers(): Promise<FollowedUser[]> {
  return new Promise((resolve, reject) => {
    getDb().all(
      'SELECT * FROM followed_user WHERE enabled = 1',
      (err, rows) => { if (err) reject(err); else resolve((rows || []).map(parseUser)); }
    );
  });
}

export function getUserById(id: string): Promise<FollowedUser | null> {
  return new Promise((resolve, reject) => {
    getDb().get('SELECT * FROM followed_user WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row ? parseUser(row) : null);
    });
  });
}

export function getUserByPlatformId(platform: string, platformUserId: string): Promise<FollowedUser | null> {
  return new Promise((resolve, reject) => {
    getDb().get(
      'SELECT * FROM followed_user WHERE platform = ? AND platform_user_id = ?',
      [platform, platformUserId],
      (err, row) => { if (err) reject(err); else resolve(row ? parseUser(row) : null); }
    );
  });
}

export function createUser(user: Omit<FollowedUser, 'createdAt' | 'updatedAt'>): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = user.id || uuid();
    getDb().run(
      `INSERT INTO followed_user (id, platform, platform_user_id, profile, group_id, enabled, last_fetched_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, user.platform, user.platformUserId, JSON.stringify(user.profile), user.groupId, user.enabled ? 1 : 0, user.lastFetchedAt],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });
}

export function updateUser(id: string, updates: Partial<Pick<FollowedUser, 'enabled' | 'groupId' | 'lastFetchedAt'>>): Promise<void> {
  return new Promise((resolve, reject) => {
    const sets: string[] = ['updated_at = datetime(\'now\')'];
    const vals: unknown[] = [];
    if (updates.enabled !== undefined) { sets.push('enabled = ?'); vals.push(updates.enabled ? 1 : 0); }
    if (updates.groupId !== undefined) { sets.push('group_id = ?'); vals.push(updates.groupId); }
    if (updates.lastFetchedAt !== undefined) { sets.push('last_fetched_at = ?'); vals.push(updates.lastFetchedAt); }
    vals.push(id);
    getDb().run(`UPDATE followed_user SET ${sets.join(', ')} WHERE id = ?`, vals, (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

export function deleteUser(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getDb().run('DELETE FROM followed_user WHERE id = ?', [id], (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

function parseUser(row: Record<string, unknown>): FollowedUser {
  return {
    id: row.id as string,
    platform: row.platform as FollowedUser['platform'],
    platformUserId: row.platform_user_id as string,
    profile: JSON.parse((row.profile as string) || '{}'),
    groupId: (row.group_id as string) || null,
    enabled: Boolean(row.enabled),
    lastFetchedAt: (row.last_fetched_at as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
```

- [ ] **Step 5: Create post repository (abbreviated — full CRUD pattern same as users)**

```typescript
// packages/server/src/db/repositories/posts.ts
import { getDb } from '../connection';
import { RawPost } from '@agent-feeds/shared';
import { v4 as uuid } from 'uuid';

export function getPostsByAuthor(authorId: string, limit = 20): Promise<RawPost[]> {
  return new Promise((resolve, reject) => {
    getDb().all(
      'SELECT * FROM raw_post WHERE author_id = ? ORDER BY published_at DESC LIMIT ?',
      [authorId, limit],
      (err, rows) => { if (err) reject(err); else resolve((rows || []).map(parsePost)); }
    );
  });
}

export function getPostsByAuthorSince(authorId: string, since: string): Promise<RawPost[]> {
  return new Promise((resolve, reject) => {
    getDb().all(
      'SELECT * FROM raw_post WHERE author_id = ? AND published_at > ? ORDER BY published_at DESC',
      [authorId, since],
      (err, rows) => { if (err) reject(err); else resolve((rows || []).map(parsePost)); }
    );
  });
}

export function insertPost(post: RawPost): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = post.id || uuid();
    getDb().run(
      `INSERT OR IGNORE INTO raw_post (id, platform, platform_post_id, author_id, type, data, media_urls, permalink, published_at, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [id, post.platform, post.platformPostId, post.authorId, post.type, JSON.stringify(post.data), JSON.stringify(post.mediaUrls), post.permalink, post.publishedAt],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });
}

export function insertPosts(posts: RawPost[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO raw_post (id, platform, platform_post_id, author_id, type, data, media_urls, permalink, published_at, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    );
    for (const p of posts) {
      stmt.run([p.id || uuid(), p.platform, p.platformPostId, p.authorId, p.type, JSON.stringify(p.data), JSON.stringify(p.mediaUrls), p.permalink, p.publishedAt]);
    }
    stmt.finalize(err => { if (err) reject(err); else resolve(); });
  });
}

function parsePost(row: Record<string, unknown>): RawPost {
  return {
    id: row.id as string,
    platform: row.platform as RawPost['platform'],
    platformPostId: row.platform_post_id as string,
    authorId: row.author_id as string,
    type: row.type as RawPost['type'],
    data: JSON.parse((row.data as string) || '{}'),
    mediaUrls: JSON.parse((row.media_urls as string) || '[]'),
    permalink: row.permalink as string,
    publishedAt: row.published_at as string,
    fetchedAt: row.fetched_at as string,
  };
}
```

- [ ] **Step 6: Create media cache, feed, groups, settings repositories**

Same async pattern as above. Key methods:
- `media.ts`: `getPendingDownloads()`, `updateStatus()`, `insertMedia()`
- `feed.ts`: `getFeedItems(filter, cursor, limit)`, `insertFeedItem()`, `updateReadStatus()`, `updateSaved()`
- `groups.ts`: `getAllGroups()`, `createGroup()`, `updateGroup()`, `deleteGroup()`
- `settings.ts`: `getSetting(key)`, `setSetting(key, value)`, `getAllSettings()`

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/db/
git commit -m "feat: add SQLite database layer with all repositories"
```

---

### Task 3: Server — Entry Point & Config

**Files:**
- Create: `packages/server/src/config.ts`
- Create: `packages/server/src/index.ts`

- [ ] **Step 1: Create config loader**

```typescript
// packages/server/src/config.ts
import { AppSettings, LlmConfig, WhisperConfig } from '@agent-feeds/shared';
import { getAllSettings, setSetting, getSetting } from './db/repositories/settings';
import { runMigrations } from './db/migrate';

const DEFAULT_PROMPT_SINGLE = `你是一个内容摘要助手。请用 2-3 句中文总结以下帖子内容，并提取 3-5 个标签。

帖子内容：
{content}

请以 JSON 格式返回：
{ "title": "简洁标题", "summary": "2-3句中文摘要", "tags": ["标签1", "标签2", "标签3"] }`;

const DEFAULT_PROMPT_DIGEST = `你是一个内容摘要助手。以下是同一用户的多条帖子，请按主题归并，用中文写一份综合摘要。

帖子列表：
{posts}

请以 JSON 格式返回：
{ "title": "归并标题", "summary": "按主题分段的综合摘要", "tags": ["标签1", "标签2"] }`;

export async function loadConfig(): Promise<AppSettings> {
  runMigrations();

  return {
    port: parseInt(await getSettingWithDefault('server_port', '58797')),
    fetchIntervalMinutes: parseInt(await getSettingWithDefault('fetch_interval_minutes', '30')),
    llm: {
      provider: await getSettingWithDefault('llm_provider', 'deepseek'),
      apiKey: await getSettingWithDefault('llm_api_key', ''),
      model: await getSettingWithDefault('llm_model', 'deepseek-chat'),
    },
    whisper: {
      provider: await getSettingWithDefault('whisper_provider', 'openai'),
      apiKey: await getSettingWithDefault('whisper_api_key', ''),
      model: await getSettingWithDefault('whisper_model', 'whisper-1'),
    },
    mediaCacheTtlDays: parseInt(await getSettingWithDefault('media_cache_ttl_days', '7')),
  };
}

export function getSinglePrompt(): Promise<string> {
  return getSettingWithDefault('prompt_single', DEFAULT_PROMPT_SINGLE);
}

export function getDigestPrompt(): Promise<string> {
  return getSettingWithDefault('prompt_digest', DEFAULT_PROMPT_DIGEST);
}

async function getSettingWithDefault(key: string, defaultVal: string): Promise<string> {
  const val = await getSetting(key);
  if (val === null) {
    await setSetting(key, defaultVal);
    return defaultVal;
  }
  return val;
}
```

- [ ] **Step 2: Create server entry point**

```typescript
// packages/server/src/index.ts
import express from 'express';
import cors from 'cors';
import { loadConfig } from './config';
import { closeDb } from './db/connection';
import { createFeedRoutes } from './api/routes/feed';
import { createUserRoutes } from './api/routes/users';
import { createGroupRoutes } from './api/routes/groups';
import { createSettingsRoutes } from './api/routes/settings';
import { createFetchRoutes } from './api/routes/fetch';

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
  app.use(express.static('../web/dist'));

  app.listen(config.port, () => {
    console.log(`Agent Feeds server running on http://localhost:${config.port}`);
  });

  process.on('SIGINT', () => { closeDb(); process.exit(0); });
  process.on('SIGTERM', () => { closeDb(); process.exit(0); });
}

main().catch(console.error);
```

- [ ] **Step 3: Commit**

---

### Task 4: Server — API Routes

**Files:**
- Create: `packages/server/src/api/routes/feed.ts`
- Create: `packages/server/src/api/routes/users.ts`
- Create: `packages/server/src/api/routes/groups.ts`
- Create: `packages/server/src/api/routes/settings.ts`
- Create: `packages/server/src/api/routes/fetch.ts`
- Create: `packages/server/src/api/middleware/error-handler.ts`

- [ ] **Step 1: Create feed routes**

```typescript
// packages/server/src/api/routes/feed.ts
import { Router, Request, Response } from 'express';
import { getAllFeedItems, getFeedItemById, markRead, markSaved } from '../../db/repositories/feed';

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
      res.json({ items, hasMore: items.length === parseInt(limit as string) });
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
```

- [ ] **Step 2: Create user routes**

```typescript
// packages/server/src/api/routes/users.ts
import { Router } from 'express';
import { getAllUsers, getUsersByPlatform, updateUser, deleteUser, createUser } from '../../db/repositories/users';

export function createUserRoutes(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
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

  router.patch('/:id', async (req, res) => {
    try {
      await updateUser(req.params.id, req.body);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await deleteUser(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      await createUser(req.body);
      res.status(201).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  return router;
}
```

- [ ] **Step 3: Create group routes** (GET/POST/PATCH/DELETE)
- [ ] **Step 4: Create settings routes** (GET/PATCH)
- [ ] **Step 5: Create fetch routes** (POST /trigger for manual fetch)
- [ ] **Step 6: Create error handler middleware**
- [ ] **Step 7: Commit**

---

### Task 5: Pipeline — Fetcher Scheduler

**Files:**
- Create: `packages/server/src/fetcher/scheduler.ts`
- Create: `packages/server/src/fetcher/orchestrator.ts`

- [ ] **Step 1: Create scheduler**

```typescript
// packages/server/src/fetcher/scheduler.ts
import { getEnabledUsers } from '../db/repositories/users';
import { getAllSettings } from '../db/repositories/settings';

type FetchCallback = (platform: string, userId: string) => Promise<void>;

export class FetchScheduler {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private callback: FetchCallback | null = null;

  onFetch(cb: FetchCallback): void {
    this.callback = cb;
  }

  async start(): Promise<void> {
    const intervalMin = parseInt(await this.getSettingVal('fetch_interval_minutes', '30'));
    const users = await getEnabledUsers();

    // Stagger fetches per platform: spread across the interval
    const platforms = [...new Set(users.map(u => u.platform))];
    const staggerMs = (intervalMin * 60 * 1000) / platforms.length;

    platforms.forEach((platform, i) => {
      const usersOnPlatform = users.filter(u => u.platform === platform);
      const timer = setInterval(async () => {
        for (const user of usersOnPlatform) {
          if (this.callback) await this.callback(platform, user.id);
        }
      }, intervalMin * 60 * 1000);

      // First run staggered
      setTimeout(() => {
        usersOnPlatform.forEach(async (user) => {
          if (this.callback) await this.callback(platform, user.id);
        });
      }, i * staggerMs);

      this.timers.set(platform, timer);
    });

    console.log(`Scheduler started: ${platforms.length} platforms, ${intervalMin}min interval`);
  }

  stop(): void {
    this.timers.forEach(t => clearInterval(t));
    this.timers.clear();
  }

  private getSettingVal(key: string, defaultVal: string): Promise<string> {
    return new Promise((resolve) => {
      getAllSettings().then(settings => {
        resolve(settings[key] || defaultVal);
      });
    });
  }
}
```

- [ ] **Step 2: Create orchestrator**

```typescript
// packages/server/src/fetcher/orchestrator.ts
import { FollowedUser, SessionTokens } from '@agent-feeds/shared';
import { insertPosts } from '../db/repositories/posts';
import { updateUser } from '../db/repositories/users';
import { downloadMediaForPosts } from '../downloader/manager';
import { transcribePending } from '../transcriber/whisper';
import { summarizePending } from '../summarizer/single';

interface AdapterMap {
  [platform: string]: { fetchPosts(userId: string, session: SessionTokens): Promise<any[]> };
}

const adapters: AdapterMap = {};

export function registerAdapter(platform: string, adapter: any): void {
  adapters[platform] = adapter;
}

export async function fetchForUser(user: FollowedUser, session: SessionTokens): Promise<void> {
  const adapter = adapters[user.platform];
  if (!adapter) {
    console.warn(`No adapter for platform: ${user.platform}`);
    return;
  }

  try {
    const rawPosts = await adapter.fetchPosts(user.platformUserId, session);
    await insertPosts(rawPosts);

    // Trigger downstream pipeline
    const newPosts = rawPosts.filter(p => p.mediaUrls?.length > 0);
    if (newPosts.length > 0) {
      await downloadMediaForPosts(newPosts);
    }

    await updateUser(user.id, { lastFetchedAt: new Date().toISOString() });
  } catch (err: any) {
    // Categorize error
    if (err.status === 401) {
      // User-recoverable: session expired
      console.warn(`[${user.platform}] Session expired for user ${user.id}`);
      // Status will be reflected in platform status endpoint
    } else if (err.status === 429) {
      // System-handled: rate limited, backoff handled by scheduler
      throw err; // Let scheduler handle backoff
    } else {
      console.error(`[${user.platform}] Fetch error for ${user.id}:`, err.message);
    }
  }
}

export async function runFullPipeline(): Promise<void> {
  await downloadMediaForPosts([]);
  await transcribePending();
  await summarizePending();
}
```

- [ ] **Step 3: Commit**

---

### Task 6: Pipeline — 小红书 Adapter

**Files:**
- Create: `packages/server/src/fetcher/adapters/interface.ts`
- Create: `packages/server/src/fetcher/adapters/xiaohongshu.ts`
- Create: `packages/server/src/fetcher/adapters/bilibili.ts` (stub, deferred)
- Create: `packages/server/src/fetcher/adapters/douyin.ts` (stub, deferred)

- [ ] **Step 1: Define adapter interface** (references types from shared, already defined)
- [ ] **Step 2: Create stub adapters** — each returns empty array; real scraping logic requires per-platform research and will be filled in later. The stub provides the interface contract so the pipeline can be tested end-to-end.

```typescript
// packages/server/src/fetcher/adapters/xiaohongshu.ts
import { PlatformAdapter, PlatformUser, RawPost, SessionTokens } from '@agent-feeds/shared';

export const xiaohongshuAdapter: PlatformAdapter = {
  platform: 'xiaohongshu',
  async fetchFollowList(_session: SessionTokens): Promise<PlatformUser[]> {
    // TODO: Research xiaohongshu API / scraping strategy
    // Likely approach: intercept mobile API requests via extension content script
    return [];
  },
  async fetchPosts(_userId: string, _session: SessionTokens): Promise<RawPost[]> {
    // TODO: Research xiaohongshu post list endpoint
    return [];
  },
};
```

bilibili.ts and douyin.ts follow the same pattern, with platform set to 'bilibilio' and 'douyin' respectively.
- [ ] **Step 3: Commit**

---

### Task 7: Pipeline — Downloader (MVP: 模块就位，内部跳过)

**Files:**
- Create: `packages/server/src/downloader/manager.ts`
- Create: `packages/server/src/downloader/ffmpeg.ts`

- [ ] **Step 1: Create download manager — no-op**

```typescript
// packages/server/src/downloader/manager.ts
import { RawPost } from '@agent-feeds/shared';

export async function downloadMediaForPosts(_posts: RawPost[]): Promise<void> {
  // MVP: skip, media download deferred
}
```

- [ ] **Step 2: Create ffmpeg wrapper stub**

```typescript
// packages/server/src/downloader/ffmpeg.ts
export async function videoToAudio(_videoPath: string, _outputDir: string): Promise<string> {
  throw new Error('Video processing not available in MVP');
}

export async function splitAudio(_audioPath: string, _chunkSeconds: number, _outputDir: string): Promise<string[]> {
  throw new Error('Audio splitting not available in MVP');
}
```

- [ ] **Step 3: Commit**
- [ ] **Step 3: Commit**

---

### Task 8: Pipeline — Transcriber & Summarizer (MVP: 模块就位，内部跳过)

**Files:**
- Create: `packages/server/src/transcriber/whisper.ts`
- Create: `packages/server/src/summarizer/llm-client.ts`
- Create: `packages/server/src/summarizer/single.ts`
- Create: `packages/server/src/summarizer/digest.ts`

- [ ] **Step 1: Create Transcriber — no-op**

```typescript
// packages/server/src/transcriber/whisper.ts
import { RawPost } from '@agent-feeds/shared';

// MVP: passes through raw post text. Cloud Whisper API deferred.
export async function transcribePost(post: RawPost): Promise<string | null> {
  return (post.data as any).body_text || (post.data as any).desc || null;
}

export async function transcribePending(): Promise<void> {
  // MVP: no batch processing needed
}
```

- [ ] **Step 2: Create Summarizer — no-op, raw post → feed_item directly**

```typescript
// packages/server/src/summarizer/single.ts
import { RawPost, FeedItem } from '@agent-feeds/shared';
import { v4 as uuid } from 'uuid';
import { insertFeedItem } from '../../db/repositories/feed';
import { transcribePost } from '../../transcriber/whisper';

export async function summarizePost(post: RawPost): Promise<FeedItem> {
  const transcript = await transcribePost(post);
  const text = transcript || '';

  const feedItem: FeedItem = {
    id: uuid(),
    rawPostIds: [post.id],
    authorId: post.authorId,
    type: 'single',
    title: (post.data as any).title || text.slice(0, 50),
    summary: text.slice(0, 300),
    transcript,
    aiTags: [],
    sourcePlatform: post.platform,
    sourceUrls: [post.permalink],
    mediaLocalPaths: [],
    isRead: false,
    isSaved: false,
    publishedAt: post.publishedAt,
    createdAt: new Date().toISOString(),
  };

  await insertFeedItem(feedItem);
  return feedItem;
}

export async function summarizePending(): Promise<void> {
  // MVP: called by pipeline, no batch processing yet
}
```

- [ ] **Step 3: Create digest summarizer — no-op**

```typescript
// packages/server/src/summarizer/digest.ts
// MVP: returns null, digest mode deferred
export async function createDigest(): Promise<null> {
  return null;
}
```

- [ ] **Step 4: Create LLM client stub** (for future use)

```typescript
// packages/server/src/summarizer/llm-client.ts
import { LlmConfig } from '@agent-feeds/shared';

// Deferred: actual LLM API call for summarization
export async function chatCompletion(
  _config: LlmConfig,
  _systemPrompt: string,
  _userMessage: string
): Promise<string> {
  throw new Error('LLM summarization not available in MVP');
}
```

- [ ] **Step 5: Commit**

---

### Task 9: Frontend — Vite + Vue Scaffold

**Files:**
- Create: `packages/web/index.html`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/src/main.ts`
- Create: `packages/web/src/App.vue`
- Create: `packages/web/src/router.ts`
- Create: `packages/web/src/style.css`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Agent Feeds</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:58797',
    },
  },
});
```

- [ ] **Step 3: Create main.ts**

```typescript
import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import './style.css';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: () => import('./pages/FeedPage.vue') },
    { path: '/users', component: () => import('./pages/UsersPage.vue') },
    { path: '/settings', component: () => import('./pages/SettingsPage.vue') },
  ],
});

createApp(App).use(router).mount('#app');
```

- [ ] **Step 4: Create App.vue** — bottom nav bar + `<router-view>`, max-width ~680px centered
- [ ] **Step 5: Create style.css** — mobile-first base styles, CSS variables for theme
- [ ] **Step 6: Commit**

---

### Task 10: Frontend — Feed Page

**Files:**
- Create: `packages/web/src/pages/FeedPage.vue`
- Create: `packages/web/src/components/FeedCard.vue`
- Create: `packages/web/src/components/FeedList.vue`
- Create: `packages/web/src/components/PlatformStatus.vue`
- Create: `packages/web/src/components/FilterBar.vue`
- Create: `packages/web/src/composables/useFeed.ts`
- Create: `packages/web/src/api/client.ts`

- [ ] **Step 1: Create API client**

```typescript
// packages/web/src/api/client.ts
const BASE = '/api';

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Create useFeed composable** — fetch feed with cursor pagination, filter state
- [ ] **Step 3: Create PlatformStatus component** — 3 dot indicators green/yellow/red
- [ ] **Step 4: Create FilterBar component** — platform dropdown, group dropdown, single/digest toggle
- [ ] **Step 5: Create FeedCard component** — single mode and user_digest mode (expandable)
- [ ] **Step 6: Create FeedList component** — infinite scroll with intersection observer
- [ ] **Step 7: Create FeedPage** — compose PlatformStatus + FilterBar + FeedList
- [ ] **Step 8: Commit**

---

### Task 11: Frontend — Users Page

**Files:**
- Create: `packages/web/src/pages/UsersPage.vue`
- Create: `packages/web/src/components/UserGroupList.vue`
- Create: `packages/web/src/components/FollowList.vue`
- Create: `packages/web/src/components/PlatformTabs.vue`
- Create: `packages/web/src/composables/useUsers.ts`

- [ ] **Step 1: Create useUsers composable** — fetch users by platform, subscribe/unsubscribe
- [ ] **Step 2: Create PlatformTabs** — 3 tabs with connection status badge
- [ ] **Step 3: Create UserGroupList** — subscribed users by group, collapsible, with unsubscribe button
- [ ] **Step 4: Create FollowList** — full platform follow list with checkboxes + group selector
- [ ] **Step 5: Create UsersPage** — compose tabs + group list + follow list
- [ ] **Step 6: Commit**

---

### Task 12: Frontend — Settings Page

**Files:**
- Create: `packages/web/src/pages/SettingsPage.vue`
- Create: `packages/web/src/composables/useSettings.ts`

- [ ] **Step 1: Create useSettings composable** — fetch/patch settings, load/save prompts
- [ ] **Step 2: Create SettingsPage** — sections: frequency, AI config, prompts (expandable editors), data management
- [ ] **Step 3: Commit**

---

### Task 13: Frontend — Onboarding Wizard

**Files:**
- Create: `packages/web/src/components/OnboardingWizard.vue`

- [ ] **Step 1: Create 4-step wizard component** — plugin install → connect platforms → select users → done
- [ ] **Step 2: Auto-show when feed is empty and no subscribed users**
- [ ] **Step 3: Commit**

---

### Task 14: Browser Extension

**Files:**
- Create: `packages/extension/src/manifest.json`
- Create: `packages/extension/src/background.ts`
- Create: `packages/extension/src/content.ts`
- Create: `packages/extension/src/popup.html`
- Create: `packages/extension/src/popup.ts`

- [ ] **Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Agent Feeds",
  "version": "0.1.0",
  "description": "聚合小红书/B站/抖音关注内容",
  "permissions": ["cookies", "storage", "alarms"],
  "host_permissions": [
    "*://*.xiaohongshu.com/*",
    "*://*.bilibili.com/*",
    "*://*.douyin.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.xiaohongshu.com/*",
        "*://*.bilibili.com/*",
        "*://*.douyin.com/*"
      ],
      "js": ["content.js"]
    }
  ],
  "action": {
    "default_popup": "popup.html"
  }
}
```

- [ ] **Step 2: Create background service worker** — handle cookie extraction, maintain connection to local service
- [ ] **Step 3: Create content script** — detect platform, intercept API responses, forward to background
- [ ] **Step 4: Create popup** — minimal: 3 platform status indicators + local service connection status
- [ ] **Step 5: Commit**

---

### Task 15: Integration — Wire Pipeline End-to-End

**Files:**
- Modify: `packages/server/src/index.ts`
- Modify: `packages/server/src/fetcher/orchestrator.ts`

- [ ] **Step 1: Wire orchestrator to call real adapters, downloader, transcriber, summarizer**
- [ ] **Step 2: Start scheduler on server boot**
- [ ] **Step 3: Test end-to-end with a single manual fetch cycle**
- [ ] **Step 4: Commit**

---

### Task 16: Final Polish

- [ ] **Step 1: Error handling audit** — ensure all API endpoints have try/catch
- [ ] **Step 2: Apply 3-category error model to fetcher** (401 user-recoverable, 429 backoff, 5xx skip)
- [ ] **Step 3: Add circuit breaker to per-platform fetch**
- [ ] **Step 4: Media cache TTL cleanup job**
- [ ] **Step 5: Commit**
