# Agent Feeds — Design Spec

## Overview

Local application that aggregates followed users' posts from 小红书, B站, and 抖音, processes content through cloud AI APIs (video transcription + summarization), and presents a unified, AI-summarized feed in a local web UI.

**Architecture pattern:** Pipeline — 6 stages, each with well-defined input/output.

## Key Decisions

| Decision | Choice |
|---|---|
| AI deployment | Cloud API only (DeepSeek, OpenAI, etc.) |
| Feed model | Continuous update stream (RSS-like), 30-60 min polling |
| Summary granularity | Per-item summaries + per-user digests |
| Backend runtime | Node.js + TypeScript |
| Frontend | Vite + Vue 3 + Vue Router |
| Storage | SQLite via `sqlite3` package |
| Video transcription | Cloud Whisper API |
| Following management | Manual selection + user-defined groups |
| Initial setup | Guided wizard flow |
| Browser extension | Manifest V3, thin: session/cookie forwarding only |

## Architecture

```
Extension → Fetcher → Downloader → Transcriber → Summarizer → Feed Server + Web UI
```

### 1. Browser Extension
- Manifest V3 (Chrome/Edge compatible)
- Detects when user is on a supported platform
- Extracts and forwards cookies/session to local service via HTTP POST
- Popup shows per-platform connection status
- **No scraping logic in extension**

### 2. Fetcher (per-platform adapters)
- Interface: `PlatformAdapter { fetch(userId, session): RawPost[] }`
- One adapter per platform: `adapters/xiaohongshu.ts`, `bilibili.ts`, `douyin.ts`
- Shared logic: rate limiting, retry, dedup (UNIQUE on platform+post_id)
- Fetches staggered per platform, not simultaneous

### 3. Downloader
- Downloads media files (video, images) to `~/.agent-feeds/media/`
- Max 3 concurrent downloads per platform
- ffmpeg: video → audio (16kHz mono wav for Whisper API)
- Retry 3x with exponential backoff per file

### 4. Transcriber
- Cloud Whisper API (DeepSeek/OpenAI)
- Text posts: skip, pass through
- Video: audio → transcript
- Images: optional vision model description
- Long audio: auto-chunk via ffmpeg before sending

### 5. Summarizer
- Cloud LLM API (DeepSeek/OpenAI compatible)
- **Single mode:** one post → one summary + 3-5 tags
- **Digest mode:** ≥3 new posts from same user → one grouped digest
- Prompt templates stored as Markdown, user-editable

### 6. Feed Server + Web UI
- REST API (Express or Hono)
- Vue 3 SPA with 3 pages: Feed, User Management, Settings

## Data Model

### `followed_user`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| platform | TEXT | xiaohongshu \| bilibili \| douyin |
| platform_user_id | TEXT | |
| profile | JSON | { nickname, avatar, bio, ... } |
| group_id | TEXT FK | nullable |
| enabled | INTEGER | 0 or 1 |
| last_fetched_at | TEXT | |
| created_at | TEXT | |
| updated_at | TEXT | |

### `raw_post`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| platform | TEXT | |
| platform_post_id | TEXT | |
| author_id | TEXT FK | |
| type | TEXT | video \| image_text \| text |
| data | JSON | All platform-specific fields |
| media_urls | JSON | Flat array for downloader |
| permalink | TEXT | |
| published_at | TEXT | |
| fetched_at | TEXT | |
| UNIQUE | (platform, platform_post_id) | |

### `media_cache`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| post_id | TEXT FK | |
| original_url | TEXT | |
| local_path | TEXT | |
| type | TEXT | video \| audio \| image |
| status | TEXT | pending \| downloading \| done \| failed |
| file_size | INTEGER | |
| created_at | TEXT | |

### `feed_item`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| raw_post_ids | JSON | [id, ...] |
| author_id | TEXT FK | |
| type | TEXT | single \| user_digest |
| title | TEXT | |
| summary | TEXT | AI-generated |
| transcript | TEXT | Nullable, for video |
| ai_tags | JSON | ["tag1", "tag2"] |
| source_platform | TEXT | |
| source_urls | JSON | [url, ...] |
| media_local_paths | JSON | |
| is_read | INTEGER | |
| is_saved | INTEGER | |
| published_at | TEXT | |
| created_at | TEXT | |

### `user_group`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| name | TEXT | |
| color | TEXT | |
| sort_order | INTEGER | |
| created_at | TEXT | |

## Error Handling

Three categories across the pipeline:

| Category | Examples | Behavior |
|---|---|---|
| **User-recoverable** | 401 (session expired) | Pause, notify user, wait for re-login |
| **System-handled** | 429, rate limit, captcha | Exponential backoff + circuit breaker |
| **Transient** | 5xx, network error | Log, skip, retry next cycle |

Per-platform circuit breaker: after N consecutive rate-limit errors, pause platform for 6 hours. Other platforms unaffected.

## Edge Cases

- **Duplicate content across platforms:** dedup by content hash within time window
- **Very long video:** chunked transcription → chunk summaries → final summary
- **No new content:** quiet skip, update last_fetched_at
- **First-time setup (many follows):** fetch last 3 days only, max 50 posts/cycle, UI progress indicator
- **Extension not running:** Web UI still works, shows platform connection status

## Project Structure

```
agent-feeds/
├── packages/
│   ├── shared/src/       # Shared TypeScript types
│   ├── server/src/       # Local service (Express/Hono + sqlite3)
│   │   ├── db/           # Connection, migrations, repositories
│   │   ├── fetcher/      # Scheduler + platform adapters
│   │   ├── downloader/   # Queue + ffmpeg wrapper
│   │   ├── transcriber/  # Cloud Whisper API client
│   │   ├── summarizer/   # LLM client + prompt templates
│   │   ├── api/          # REST routes + middleware
│   │   └── media/        # Local file cache
│   ├── web/src/          # Vue 3 SPA (Vite + Vue Router)
│   │   ├── pages/        # FeedPage, UsersPage, SettingsPage
│   │   ├── components/   # FeedCard, FeedList, UserDigest, etc.
│   │   └── composables/  # Vue composables
│   └── extension/src/    # Manifest V3 browser extension
├── package.json          # pnpm workspaces
└── tsconfig.json
```

## API Routes

| Method | Path | Purpose |
|---|---|---|
| GET | /api/feed | Feed query (filter, cursor, limit) |
| GET | /api/feed/:id | Single feed item detail |
| PATCH | /api/feed/:id | Mark read/saved |
| GET | /api/users | Followed users list |
| PATCH | /api/users/:id | Enable/disable, change group |
| GET/POST | /api/groups | Group CRUD |
| POST | /api/fetch/trigger | Manual fetch trigger |
| GET | /api/settings | Get settings |
| PATCH | /api/settings | Update settings (API keys, frequency, prompts) |
