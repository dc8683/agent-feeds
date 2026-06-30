# Agent Feeds — 设计文档

## 概述

本地应用，聚合用户在 小红书、B站、抖音 上关注账号的推送内容（视频、图文、动态），通过云端 AI API 完成视频转写与内容总结，在本地 Web 页面中呈现统一的信息流。

**架构模式：** Pipeline —— 6 个阶段，每阶段有明确定义的输入输出。

## 关键决策

| 决策项 | 选择 |
|---|---|
| AI 部署方式 | 仅云端 API（DeepSeek、OpenAI 等） |
| 信息流模式 | 持续更新流（类 RSS），每 30-60 分钟轮询 |
| 总结粒度 | 单条摘要 + 按用户归并摘要 |
| 后端运行时 | Node.js + TypeScript |
| 前端 | Vite + Vue 3 + Vue Router |
| 存储 | SQLite（`sqlite3` 包） |
| 视频转文字 | 云端 Whisper API |
| 关注管理 | 手动勾选 + 分组管理 |
| 初始设置 | 引导式流程 |
| 浏览器插件 | Manifest V3，混合策略：优先在插件侧抓取，本地服务辅助 |

## 架构

```
插件（抓取/Session）⇄ 拉取器（调度+补充） → 下载器 → 转写器 → 总结器 → Feed 服务 + Web 界面
```

### 1. 浏览器插件
- Manifest V3（兼容 Chrome/Edge）
- **抓取策略：混合，默认优先在插件侧完成**
- 用户在平台页面浏览时，Content Script 可直接拦截页面 API 请求/响应、解析 DOM，随真实浏览器上下文发出请求，天然规避反爬检测
- 将原始数据推送给本地服务；Cookie/Session 一并同步
- 弹窗显示各平台连接状态
- **对于不需强浏览器上下文的场景**（如根据用户 ID 拉取公开信息），可由本地服务直接发请求

### 2. 拉取器（调度 + 按平台适配）
- **主要数据来源：** 插件推送的原始帖子数据（JSON）
- **辅助数据来源：** 本地服务在必要时直接发请求（如拉取用户公开信息、初始关注列表）
- 接口：`PlatformAdapter { fetchFollowList(session): User[]; fetchPosts(userId, session): RawPost[] }`
- 每个平台一个适配器：`adapters/xiaohongshu.ts`、`bilibili.ts`、`douyin.ts`
- 共享逻辑：调度管理、频率控制、去重（platform + post_id 唯一约束）
- 各平台错开调度，不同时进行

### 3. 下载器
- 下载媒体文件（视频、图片）至 `~/.agent-feeds/media/`
- 每平台最多 3 个并发下载
- ffmpeg：视频 → 音频（16kHz 单声道 wav，适配 Whisper API）
- 单文件失败重试 3 次，指数退避

### 4. 转写器
- 云端 Whisper API（DeepSeek/OpenAI）
- 纯文本帖：跳过，直接透传
- 视频：音频 → 文字稿
- 图片：可选 vision 模型描述
- 长音频：通过 ffmpeg 自动切片后发送

### 5. 总结器
- 云端 LLM API（兼容 DeepSeek/OpenAI）
- **单条模式：** 一条帖 → 一段摘要 + 3-5 个标签
- **归并模式：** 同一用户 ≥3 条新帖 → 一条归并摘要
- Prompt 模板以 Markdown 存储，用户可自行编辑

### 6. Feed 服务 + Web 界面
- REST API（Express 或 Hono）
- Vue 3 SPA，3 个页面：信息流、用户管理、设置
- **Feed 输出格式：** 以文字摘要为主体，原始媒体（图片、视频封面等）作为可选的辅助信息，feed 卡片不依赖图片即可完整展示内容

## 数据模型

### `followed_user` 关注用户
| 列 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | |
| platform | TEXT | xiaohongshu \| bilibili \| douyin |
| platform_user_id | TEXT | 平台用户 ID |
| profile | JSON | { nickname, avatar, bio, ... } |
| group_id | TEXT FK | 可为空 |
| enabled | INTEGER | 0 停用 / 1 启用 |
| last_fetched_at | TEXT | |
| created_at | TEXT | |
| updated_at | TEXT | |

### `raw_post` 原始帖子
| 列 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | |
| platform | TEXT | |
| platform_post_id | TEXT | |
| author_id | TEXT FK | |
| type | TEXT | video \| image_text \| text |
| data | JSON | 平台相关的全部字段 |
| media_urls | JSON | 扁平数组，供下载器使用 |
| permalink | TEXT | |
| published_at | TEXT | |
| fetched_at | TEXT | |
| UNIQUE | (platform, platform_post_id) | |

### `media_cache` 媒体缓存
| 列 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | |
| post_id | TEXT FK | |
| original_url | TEXT | |
| local_path | TEXT | |
| type | TEXT | video \| audio \| image |
| status | TEXT | pending \| downloading \| done \| failed |
| file_size | INTEGER | |
| created_at | TEXT | |

### `feed_item` Feed 条目
| 列 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | |
| raw_post_ids | JSON | [id, ...] |
| author_id | TEXT FK | |
| type | TEXT | single \| user_digest |
| title | TEXT | |
| summary | TEXT | AI 生成摘要 |
| transcript | TEXT | 视频文字稿，可为空 |
| ai_tags | JSON | ["标签1", "标签2"] |
| source_platform | TEXT | |
| source_urls | JSON | [url, ...] |
| media_local_paths | JSON | |
| is_read | INTEGER | |
| is_saved | INTEGER | |
| published_at | TEXT | |
| created_at | TEXT | |

### `user_group` 用户分组
| 列 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | |
| name | TEXT | |
| color | TEXT | |
| sort_order | INTEGER | |
| created_at | TEXT | |

## 错误处理

整个 Pipeline 统一三类错误：

| 类别 | 示例 | 处理方式 |
|---|---|---|
| **用户可恢复** | 401（Session 过期） | 暂停、通知用户、等待重新登录 |
| **系统可处理** | 429、限流、验证码 | 指数退避 + 熔断 |
| **临时错误** | 5xx、网络错误 | 记录日志、跳过、下个周期重试 |

按平台熔断：连续 N 次限流错误后，暂停该平台 6 小时，不影响其他平台。

## 边界情况


- **超长视频：** 分段转写 → 分段摘要 → 最终合并摘要
- **无新内容：** 静默跳过，仅更新 last_fetched_at
- **首次设置：** 不回溯历史，从当前时间点开始拉取新内容
- **插件未运行：** Web 界面仍可访问，显示各平台连接状态

## 项目结构

```
agent-feeds/
├── packages/
│   ├── shared/src/       # 共享 TypeScript 类型
│   ├── server/src/       # 本地服务（Express/Hono + sqlite3）
│   │   ├── db/           # 数据库连接、迁移、仓库
│   │   ├── fetcher/      # 调度器 + 平台适配器
│   │   ├── downloader/   # 下载队列 + ffmpeg 封装
│   │   ├── transcriber/  # 云端 Whisper API 客户端
│   │   ├── summarizer/   # LLM 客户端 + prompt 模板
│   │   ├── api/          # REST 路由 + 中间件
│   │   └── media/        # 本地文件缓存
│   ├── web/src/          # Vue 3 SPA（Vite + Vue Router）
│   │   ├── pages/        # FeedPage、UsersPage、SettingsPage
│   │   ├── components/   # FeedCard、FeedList、UserDigest 等
│   │   └── composables/  # Vue 组合式函数
│   └── extension/src/    # Manifest V3 浏览器插件
│       ├── platforms/     # 各平台 Content Script 抓取逻辑
│       ├── background.ts  # Service Worker
│       └── popup.ts       # 弹窗状态
├── package.json          # pnpm workspaces
└── tsconfig.json
```

## API 路由

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | /api/feed | Feed 查询（筛选、游标、条数） |
| GET | /api/feed/:id | 单条 Feed 详情 |
| PATCH | /api/feed/:id | 标记已读/收藏 |
| GET | /api/users | 关注用户列表 |
| PATCH | /api/users/:id | 启用/停用、更改分组 |
| GET/POST | /api/groups | 分组增删改查 |
| POST | /api/fetch/trigger | 手动触发拉取 |
| GET | /api/settings | 获取设置 |
| PATCH | /api/settings | 更新设置（API Key、频率、Prompt） |
