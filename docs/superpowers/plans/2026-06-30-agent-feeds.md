# Agent Feeds Implementation Plan — 当前进度

> 最后更新：2026-07-01

## 已完成 ✅

### 1. Monorepo 脚手架
- [x] pnpm workspaces + shared/server/web/extension 四个 package
- [x] TypeScript 类型定义（FollowedUser, RawPost, FeedItem 等）

### 2. 数据库层
- [x] SQLite 6 张表 + 迁移（001_init + 002_add_cover_url）
- [x] 6 个 repository（users, posts, media, feed, groups, settings）

### 3-4. 服务端 + API
- [x] Express 入口 + 配置加载
- [x] Feed/Users/Groups/Settings/Fetch 路由
- [x] /api/extension/* 端点（session, data, status）
- [x] /api/users/add-by-url 端点（小红书 URL → followed_user）
- [x] /api/fetch/trigger + /api/fetch/pending（fetch 队列）

### 5. 小红书数据流（双模式抓取）
- [x] **Profile 页模式**：DOM 抓取笔记列表（标题、封面、笔记 URL 带 xsec_token）
- [x] **详情页模式**：逐条抓取正文（`.note-text`）+ 发布时间（`.bottom-container`）
- [x] 跳过置顶笔记，取最新 5 条
- [x] 发布时间解析（"4小时前"、"1天前" → ISO 时间戳）
- [x] 笔记 URL 使用 `a.title` href（自带 xsec_token），可正常访问
- [x] Background Script 编排：profile → 逐条 navigate 详情 → 累积数据 → POST → 关闭标签页
- [x] /api/extension/data 处理（replace 模式 + bodyText + publishedAt）

### 6-8. Pipeline 模块（MVP no-op）
- [x] Downloader/Transcriber/Summarizer 模块就位
- [x] Summarizer: 正文直出（bodyText → summary）
- [x] Transcriber: 返回 body_text

### 9-13. 前端
- [x] Vue 3 SPA + Vite + Vue Router
- [x] FeedPage（平台状态 + 筛选 + 卡片列表）
- [x] UsersPage（平台 Tab + 已订阅 + URL 输入框 + 🔄 拉取按钮）
- [x] SettingsPage（LLM/Whisper/频率配置）
- [x] **FeedCard**：
  - 封面缩略图（72×72）+ 标题 + 作者/平台/时间 + 正文摘要
  - 点击卡片展开/收起完整正文
  - 点击封面图 → Lightbox 全屏查看（滚轮缩放 0.5x-5x、双击切换、拖拽平移、双指缩放）
  - 原文链接（带 xsec_token 可访问）
  - 移除收藏功能
- [x] PlatformStatus（三平台绿/黄/红）

### 14. 浏览器插件
- [x] Manifest V3 + tabs 权限
- [x] Content Script 双模式（profile 列表 + detail 正文/时间）
- [x] Background Script 编排逻辑（轮询队列 → 打开 profile → 逐个 detail → 推送 → 关标签页）

## 待完成 ❌

### 插件稳定性
- [ ] Service Worker setInterval → chrome.alarms（防休眠）
- [ ] Content Script 错误处理加强（detail 页 404/限流重试）

### Feed UI 完善
- [ ] 单条/归并视图切换
- [ ] 分组筛选联动

### 多平台
- [ ] B站 调研 & adapter
- [ ] 抖音 调研 & adapter

### AI 总结
- [ ] LLM 客户端对接（prompt 模板已有）
- [ ] Whisper 对接（视频先跳过）

### 引导向导
- [ ] OnboardingWizard 对接实际流程

## 开发环境启动

```bash
cd /Users/jinchao.chen/Desktop/agent/agent-feeds

# 终端 1: 本地服务
npx tsx packages/server/src/index.ts

# 终端 2: 前端开发
pnpm dev:web  # http://localhost:5173

# 插件加载
chrome://extensions → 加载已解压 → packages/extension/dist
```

## 关键文件路径

| 功能 | 路径 |
|---|---|
| 服务入口 | `packages/server/src/index.ts` |
| 小红书 adapter | `packages/server/src/fetcher/adapters/xiaohongshu.ts` |
| Feed API（含 authorName） | `packages/server/src/api/routes/feed.ts` |
| Fetch 队列 | `packages/server/src/api/routes/fetch.ts` |
| 用户添加 | `packages/server/src/api/routes/users.ts` |
| Content Script（双模式） | `packages/extension/src/content.ts` |
| Background Script（编排） | `packages/extension/src/background.ts` |
| Feed 页面 | `packages/web/src/pages/FeedPage.vue` |
| 用户页面 | `packages/web/src/pages/UsersPage.vue` |
| Feed 卡片（展开+Lightbox） | `packages/web/src/components/FeedCard.vue` |
| 设计文档 | `docs/superpowers/specs/2026-06-30-agent-feeds-design.md` |
