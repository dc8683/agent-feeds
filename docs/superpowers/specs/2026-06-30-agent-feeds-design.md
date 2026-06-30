# Agent Feeds — 设计文档

## 概述

本地应用，聚合用户在 小红书、B站、抖音 上关注账号的推送内容，通过云端 AI API 完成总结，在本地 Web 页面中呈现统一的信息流。

## 当前状态（2026-06-30）

**已实现：** 小红书图文抓取 → Feed 展示（MVP 骨架完整）
**待开发：** B站/抖音、AI 总结激活、视频处理、Feed UI 完善

### 实际架构（简化后）

```
用户添加博主 URL → 服务端入 fetch 队列
                           ↓
Chrome 插件轮询 GET /api/fetch/pending
                           ↓
插件后台打开博主主页 → Content Script 抓取 DOM
                           ↓
POST /api/extension/data → 服务端落库 → Feed 展示
```

- **CDP bridge 已移除。** 所有浏览器交互通过 Agent Feeds 插件完成。
- **小红书策略：** 用户手动粘贴博主主页 URL，系统通过插件后台打开页面抓取。
- **B站/抖音：** 待调研，策略可能不同（可能有 API 可用）。

## MVP 范围

| 维度 | MVP | 后续 |
|---|---|---|
| 平台 | 仅小红书 | B站、抖音 |
| 内容类型 | 图文 | 视频 |
| AI 总结 | 跳过（原文直出） | LLM 总结 |
| 数据获取 | 插件 Content Script DOM 抓取 | B站/抖音待调研 |

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
| 初始设置 | 引导式流程（待实现） |
| 浏览器插件 | Manifest V3，Content Script 负责 DOM 抓取 |
| UI 设计 | 移动端优先，桌面端响应式，统一底部导航 |
| 博主管理 | 小红书：用户手动粘贴 URL；其他平台待调研 |

## 平台差异化策略

| 平台 | 添加博主方式 | 数据获取方式 | 实现状态 |
|---|---|---|---|
| 小红书 | 用户手动粘贴博主主页 URL | 插件 Content Script DOM 抓取 `section.note-item` | ✅ 已实现 |
| B站 | 待调研 | 待调研 | ⏳ |
| 抖音 | 待调研 | 待调研 | ⏳ |

### 小红书数据流（详细）

```
1. User: 粘贴 URL → POST /api/users/add-by-url → 创建 followed_user
2. User 点 🔄 → POST /api/fetch/trigger → URL 入队列
3. Extension (background.js): 每 5s 轮询 GET /api/fetch/pending
4. bg: chrome.tabs.create({url, active: false}) → 后台打开博主主页
5. Content Script: 检测 /user/profile/ → 延时 3s → 抓取 section.note-item
6. 跳过置顶（`.top-wrapper`），取最新 5 条非置顶笔记
7. forward() → POST /api/extension/data {platform, userId, profile, notes, replace:true}
8. Server: replace 模式清旧数据 → insertPosts → summarizePost → Feed
```

## 架构

```
Extension(Content Script DOM抓取) → 拉取队列 → Feed 服务 + Web UI
```

完整的 6 阶段 Pipeline 架构已定义（Downloader/Transcriber/Summarizer），MVP 阶段仅 Summarizer 为 passthrough（原文直出），其余模块就位待激活。

## 数据模型

### `followed_user`
| 列 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | |
| platform | TEXT | xiaohongshu \| bilibili \| douyin |
| platform_user_id | TEXT | 平台用户 ID（小红书为 profile URL 中的 userId） |
| profile | JSON | { nickname, avatar, bio, ... } |
| group_id | TEXT FK | 可为空 |
| enabled | INTEGER | 0 停用 / 1 启用 |
| last_fetched_at | TEXT | |
| created_at | TEXT | |
| updated_at | TEXT | |

### `raw_post`
| 列 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | |
| platform | TEXT | |
| platform_post_id | TEXT | 笔记 ID（noteId） |
| author_id | TEXT FK | |
| type | TEXT | video \| image_text \| text |
| data | JSON | 平台相关的全部字段（noteId, coverUrl, footerText, desc, body_text 等） |
| media_urls | JSON | 扁平数组，供下载器使用 |
| permalink | TEXT | |
| published_at | TEXT | |
| fetched_at | TEXT | |
| UNIQUE | (platform, platform_post_id) | |

### `media_cache` / `feed_item` / `user_group`
（略，同原设计）

## 错误处理

三类错误，统一处理：

| 类别 | 示例 | 处理方式 |
|---|---|---|
| **用户可恢复** | 401（Session 过期） | 暂停、通知用户、等待重新登录 |
| **系统可处理** | 429、限流、验证码 | 指数退避 + 熔断 |
| **临时错误** | 5xx、网络错误 | 记录日志、跳过、下个周期重试 |

## 项目结构（当前实现）

```
agent-feeds/
├── packages/
│   ├── shared/src/       # TypeScript 类型定义
│   │   └── types.ts      # FollowedUser, RawPost, FeedItem 等
│   ├── server/src/       # 本地服务（Express + sqlite3）
│   │   ├── index.ts      # 入口 + /api/extension/data + /api/extension/session
│   │   ├── config.ts     # 配置加载
│   │   ├── db/           # 数据库连接、迁移、仓库
│   │   │   ├── connection.ts
│   │   │   ├── migrations/001_init.sql
│   │   │   └── repositories/{users,posts,media,feed,groups,settings}.ts
│   │   ├── api/routes/   # REST 路由
│   │   │   ├── feed.ts   # GET /api/feed (含 authorName 增强)
│   │   │   ├── users.ts  # GET/POST/PATCH + POST /add-by-url
│   │   │   ├── fetch.ts  # POST /trigger + GET /pending (fetch 队列)
│   │   │   ├── groups.ts, settings.ts
│   │   │   └── middleware/error-handler.ts
│   │   ├── fetcher/      # 调度器 + 平台适配器
│   │   │   ├── scheduler.ts
│   │   │   ├── orchestrator.ts
│   │   │   └── adapters/
│   │   │       ├── xiaohongshu.ts  # 插件驱动，fetchPosts 为 no-op
│   │   │       ├── bilibili.ts     # stub
│   │   │       └── douyin.ts       # stub
│   │   ├── downloader/   # MVP no-op
│   │   ├── transcriber/  # MVP passthrough
│   │   └── summarizer/   # MVP passthrough (原文直出)
│   ├── web/src/          # Vue 3 SPA（Vite + Vue Router）
│   │   ├── App.vue       # 底部导航（Feed / 博主 / 设置）
│   │   ├── pages/
│   │   │   ├── FeedPage.vue     # 平台状态栏 + 筛选 + Feed 列表
│   │   │   ├── UsersPage.vue    # 平台 Tab + 已订阅列表 + URL 输入框
│   │   │   └── SettingsPage.vue # LLM/Whisper/频率/缓存配置
│   │   ├── components/
│   │   │   ├── FeedCard.vue       # 卡片（作者+平台+时间+摘要+原文链接）
│   │   │   ├── FeedList.vue        # 列表 + 加载更多
│   │   │   ├── PlatformStatus.vue  # 三平台连接状态指示器
│   │   │   ├── FilterBar.vue       # 筛选栏
│   │   │   ├── PlatformTabs.vue    # 平台 Tab 切换
│   │   │   ├── UserGroupList.vue   # 已订阅博主分组列表（含 🔄 拉取按钮）
│   │   │   └── OnboardingWizard.vue # 引导向导（4步）
│   │   ├── composables/   # useFeed, useUsers, useSettings
│   │   └── api/client.ts  # fetch 封装（apiGet/apiPost/apiPatch）
│   └── extension/src/    # Manifest V3 浏览器插件
│       ├── manifest.json  # permissions: cookies,storage,alarms,tabs
│       ├── background.ts  # SESSION_UPDATE + POST_DATA 转发 + 5s 轮询 fetch 队列
│       ├── content.ts     # 小红书 Profile 页 DOM 抓取
│       └── popup.{html,ts} # 弹窗状态显示
├── docs/superpowers/
│   ├── specs/   # 设计文档（本文）
│   └── plans/   # 实现计划
├── package.json
└── tsconfig.json
```

## API 路由（已实现）

| 方法 | 路径 | 用途 | 状态 |
|---|---|---|---|
| GET | /api/feed | Feed 查询（含 authorName） | ✅ |
| GET | /api/feed/:id | 单条详情 | ✅ |
| PATCH | /api/feed/:id | 标记已读/收藏 | ✅ |
| GET | /api/users | 关注用户列表 | ✅ |
| POST | /api/users/add-by-url | 通过 URL 添加博主（小红书） | ✅ |
| PATCH | /api/users/:id | 启用/停用、更改分组 | ✅ |
| DELETE | /api/users/:id | 删除用户 | ✅ |
| GET/POST | /api/groups | 分组 CRUD | ✅ |
| GET/PATCH | /api/settings | 设置 | ✅ |
| POST | /api/fetch/trigger | 触发拉取（入队列） | ✅ |
| GET | /api/fetch/pending | 插件轮询待拉取 URL | ✅ |
| POST | /api/extension/session | 插件推送 Session | ✅ |
| POST | /api/extension/data | 插件推送抓取数据 | ✅ |
| GET | /api/extension/status | 平台连接状态 | ✅ |

## 待解决问题 & 下一步

1. **Feed 卡片显示：**
   - ✅ 作者名（API 已增强 authorName）
   - ✅ 时间显示（publishedAt=fetchTime 时显示"刚刚"）
   - ❌ 封面图（coverUrl 已抓取，FeedCard 未使用）
   - ❌ footerText 包含作者名和赞数（"ZP量化工厂111"），应分离

2. **数据抓取：**
   - ✅ 跳过置顶笔记
   - ✅ 每次 fetch 清旧数据取最新 5 条
   - ❌ 发布时间缺失（DOM 抓取无法拿到）

3. **插件稳定性：**
   - ✅ Content Script SESSION_UPDATE
   - ⚠️ Service Worker 可能被休眠（setInterval 不可靠，应改用 chrome.alarms）

4. **Feed UI 完善：**
   - 单条/归并视图切换
   - 封面图展示
   - 分组筛选

5. **多平台扩展：**
   - B站调研（API 可用性、关注列表）
   - 抖音调研
