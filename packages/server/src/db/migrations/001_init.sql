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

INSERT OR IGNORE INTO settings (key, value) VALUES ('fetch_interval_minutes', '30');
INSERT OR IGNORE INTO settings (key, value) VALUES ('media_cache_ttl_days', '7');
INSERT OR IGNORE INTO settings (key, value) VALUES ('llm_provider', 'deepseek');
INSERT OR IGNORE INTO settings (key, value) VALUES ('llm_model', 'deepseek-chat');
INSERT OR IGNORE INTO settings (key, value) VALUES ('whisper_provider', 'openai');
INSERT OR IGNORE INTO settings (key, value) VALUES ('whisper_model', 'whisper-1');
