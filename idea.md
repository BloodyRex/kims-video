# Kim's Video — AI 影音情报与推荐平台

## 一句话
一个集 **AI 个性化电影推荐 + 每日影音情报 + 社区精选发现** 于一体的娱乐平台，每天自动从 TMDB、MusicBrainz、DeepSeek 获取数据，生成情报摘要并通过邮件推送给订阅用户。

## 核心功能

### 1. AI 电影推荐引擎
- 用户输入 1–2 部参考电影
- DeepSeek 驱动渐进式问答，精准把握用户口味
- 输出 5 个定制推荐（2 热门 + 2 冷门 + 1 惊喜）
- 每部推荐支持替换、详情查看、URL 分享

### 2. 每日影音情报中心
- Cloudflare Worker 每天 01:28 CST 从 TMDB、MusicBrainz 获取数据
- 涵盖：电影上新、剧集在播、专辑发行、热榜趋势、即将上映、编辑精选、隐藏宝藏
- DeepSeek AI 生成每日摘要头条 + 行业趋势分析
- 数据以静态 JSON 提交到 GitHub Pages，前端 SPA 展示

### 3. 每日邮件订阅
- 用户通过网页输入邮箱订阅
- 每天 08:00 CST 自动发送 HTML 邮件（含每日摘要、热榜、精选等 6 个板块）
- 双触发冗余：Worker Cron Trigger（主力）+ GitHub Actions（08:05 备用）
- KV 去重标记防止重复发送
- 通过 Resend API 投递，支持一键退订

### 4. 社区精选发现（Curated Picks）
- 预配置的精选推荐对，带 AI 评分和标签
- 支持点赞、缩略图上传

### 5. 全局分享按钮
- 悬浮在三个页面的统一分享组件
- 支持：GitHub、Twitter/X、微博、Telegram、微信（二维码）、复制链接

## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | React 18 + Vite 6 + Tailwind CSS 4 |
| API | Cloudflare Worker (单文件, ~1800 行) |
| AI | DeepSeek API (推荐引擎 + 摘要生成) |
| 数据 | TMDB API + MusicBrainz API + LastFM API |
| 邮件 | Resend API (digest@bloodyrex.xyz) |
| 部署 | GitHub Pages (前端) + Cloudflare Worker (API) |
| 自动化 | GitHub Actions (数据流水线 + Worker 部署 + 邮件备用触发) |
| 存储 | Cloudflare KV (订阅用户 + 发现数据) |

## 架构概述

```
User → GitHub Pages SPA (React)
         ↓ fetch
Cloudflare Worker (API 层)
         ↓
TMDB API ────→ DeepSeek AI ────→ GitHub Actions (01:28 CST)
MusicBrainz ──→ 每日快照提交 ──→ Git commit static JSON → GitHub Pages
         ↑
Worker Cron Trigger (08:00 CST) ──→ Resend ──→ 邮件订阅用户
GitHub Actions (08:05 CST 备用)
```

## 每日周期

| 时间 CST | 事件 |
|----------|------|
| 01:28 | GitHub Actions 触发数据流水线：TMDB + MusicBrainz → 处理 → 提交静态 JSON |
| 08:00 | Worker Cron Trigger 发送每日邮件（主力） |
| 08:05 | GitHub Actions 检查去重，如需则补发（备用） |
| 全天 | 用户通过 SPA 浏览情报、使用 AI 推荐、发现精选 |

## 项目结构

```
├── src/                          # React 前端
│   ├── components/               # UI 组件 (InputPage, QAPage, ResultsPage, etc.)
│   ├── services/                 # API 调用 + SEO
│   ├── logic/                    # 推荐引擎逻辑
│   ├── i18n/                     # 中英文国际化
│   └── data/                     # 社区精选数据
├── workers-1.4.js                # Cloudflare Worker（完整 API + 定时任务）
├── wrangler.toml                 # Worker 配置 (KV 绑定 + Cron 触发器)
├── .github/workflows/            # CI/CD
│   ├── deploy-frontend.yml       # 前端部署
│   ├── deploy-worker.yml         # Worker 部署
│   ├── intelligence-daily.yml    # 每日数据流水线
│   └── digest-backup.yml         # 邮件备用触发
└── public/api/                   # 每日情报数据快照 (JSON)
```
