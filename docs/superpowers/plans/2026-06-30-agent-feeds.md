# Agent Feeds Implementation Plan — 当前进度

> 最后更新：2026-06-30

## 已完成 ✅

### 1. Monorepo 脚手架
- [x] pnpm workspaces + shared/server/web/extension 四个 package
- [x] TypeScript 类型定义（FollowedUser, RawPost, FeedItem 等）

### 2. 数据库层
- [x] SQLite 6 张表 + 迁移
- [x] 6 个 repository（users, posts, media, feed, groups, settings）

### 3-4. 服务端 + API
- [x] Express 入口 + 配置加载
- [x] Feed/Users/Groups/Settings/Fetch 路由
- [x] /api/extension/* 端点（session, data, status）
- [x] /api/users/add-by-url 端点（小红书 URL → followed_user）
- [x] /api/fetch/trigger + /api/fetch/pending（fetch 队列）

### 5. 小红书数据流
- [x] 插件 Content Script：profile 页 DOM 抓取（section.note-item）
- [x] 跳过置顶笔记，取最新 5 条
- [x] Background Script：轮询 fetch 队列 + 后台打开页面
- [x] /api/extension/data 处理（replace 模式清旧数据 + 落库 + 生成 feed_item）
- [x] 小红书 Adapter（fetchPosts 为 no-op，实际数据由插件驱动）

### 6-8. Pipeline 模块（MVP no-op）
- [x] Downloader/Transcriber/Summarizer 模块就位
- [x] Summarizer: 原文直出（MVP）
- [x] Transcriber: passthrough

### 9-13. 前端
- [x] Vue 3 SPA + Vite + Vue Router
- [x] FeedPage（平台状态 + 筛选 + 卡片列表）
- [x] UsersPage（平台 Tab + 已订阅 + URL 输入框 + 🔄 拉取按钮）
- [x] SettingsPage（LLM/Whisper/频率配置）
- [x] FeedCard（作者+平台+时间+摘要+原文链接）
- [x] PlatformStatus（三平台绿/黄/红）

### 14. 浏览器插件
- [x] Manifest V3 + tabs 权限
- [x] Content Script（小红书 DOM 抓取）
- [x] Background Script（Session 推送 + fetch 队列轮询）

### 15. 去掉 CDP Bridge
- [x] 已移除 cdp-bridge MCP
- [x] 已删除 xhs-scraper.py
- [x] 数据流完全通过 Agent Feeds 插件

## 待完成 ❌

### Feed UI 完善
- [ ] FeedCard 显示封面图
- [ ] footerText 分离（"笔记标题" vs "作者名+赞数"）
- [ ] 单条/归并视图切换
- [ ] 分组筛选联动

### 插件稳定性
- [ ] Service Worker setInterval → chrome.alarms（防休眠）
- [ ] Content Script 错误处理加强

### 内容抓取优化
- [ ] 发布时间提取（目前 DOM 抓取拿不到真实时间）
- [ ] 笔记正文详情（目前只有标题行）

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
| Content Script | `packages/extension/src/content.ts` |
| Background Script | `packages/extension/src/background.ts` |
| Feed 页面 | `packages/web/src/pages/FeedPage.vue` |
| 用户页面 | `packages/web/src/pages/UsersPage.vue` |
| Feed 卡片 | `packages/web/src/components/FeedCard.vue` |
| 设计文档 | `docs/superpowers/specs/2026-06-30-agent-feeds-design.md` |
