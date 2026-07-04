# Kim's Video — AI Entertainment Platform / AI 娱乐推荐平台

**Three interconnected pages / 三大页面联动:** [Discover / 发现推荐](#-discover--ai-movie-recommender--ai-电影推荐) → [Intelligence / 情报中心](#-intelligence--entertainment-data-hub--娱乐情报中心) → [Curated Picks / 精选合辑](#-curated-picks--community-discovery--社区发现)

![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Tech Stack](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)
![Tech Stack](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![Tech Stack](https://img.shields.io/badge/Cloudflare_Worker-F38020?logo=cloudflare)
![Tech Stack](https://img.shields.io/badge/DeepSeek-4F46E5)
![Tech Stack](https://img.shields.io/badge/TMDB-01D277?logo=themoviedatabase)
![Tech Stack](https://img.shields.io/badge/MusicBrainz-BA478F)

---

## Three Pages Overview / 三大页面总览

This platform consists of three interconnected pages, each serving a distinct role in the entertainment discovery ecosystem:

本平台由三个互相关联的页面组成，各自在娱乐发现生态中扮演不同角色：

| Page / 页面 | Role / 角色 | Data Source / 数据来源 |
|-------------|-------------|----------------------|
| **Home / 首页** (Discover) | Personalized AI recommendation / 个性化 AI 推荐 | DeepSeek + TMDB (on-demand / 实时) |
| **Intelligence / 情报** | Daily updated data hub / 每日更新数据中心 | Cloudflare Worker → GitHub Actions → static JSON / 静态 JSON |
| **Curated Picks / 精选合辑** | Community discovery & sharing / 社区发现与分享 | Pre-curated pairs in `data/discover.json` / 预配置推荐对 |

**Flow / 数据流转:** Worker fetches from TMDB + MusicBrainz → DeepSeek AI enriches → GitHub Actions commits JSON → Pages deploys static site → all three pages served from the same build.

**流程:** Worker 从 TMDB + MusicBrainz 获取数据 → DeepSeek AI 丰富内容 → GitHub Actions 提交 JSON → Pages 部署静态站点 → 三个页面均由同一构建版本提供服务。

---

## 🏠 Home — AI Movie Recommender / AI 电影推荐

The core recommendation engine. Users input 1–2 reference films, answer a progressive AI Q&A, and receive 5 tailored picks (2 popular + 2 hidden gems + 1 wild card).

核心推荐引擎。用户输入 1–2 部参考电影，回答渐进式 AI 问答，获得 5 个定制推荐（2 热门 + 2 冷门 + 1 惊喜）。

- **AI Q&A engine / AI 问答引擎:** DeepSeek-driven progressive questions refine user taste / DeepSeek 驱动的渐进式问题，精准把握用户口味
- **TMDB integration / TMDB 集成:** Real-time search, bilingual data (zh-CN / en-US) / 实时搜索，双语数据
- **Share & save / 分享与保存:** URL sharing with movie detail routing, PNG screenshot download / URL 分享（含电影详情路由），PNG 截图下载
- **Swap one / 逐张替换:** Replace any single recommendation while keeping the rest / 可单独替换任意一张推荐卡片
- **Detail pages / 详情页:** Each movie has a dedicated sub-page with full metadata / 每部电影拥有独立的元数据详情页

**→ Bridges to: Intelligence** (recommendation results show AI scores and tags powered by the same DeepSeek pipeline)

**→ 关联情报页：** 推荐结果中的 AI 评分与标签，与情报页使用同一 DeepSeek 流水线

---

## 📡 Intelligence — Entertainment Data Hub / 娱乐情报中心

Daily auto-aggregated hub for movies, TV, and music. All data is fetched by the Cloudflare Worker, enriched by DeepSeek AI, and committed as static JSON via GitHub Actions every day at 02:00 Beijing time.

每日自动汇总的影视音乐数据中心。所有数据由 Cloudflare Worker 获取、DeepSeek AI 丰富，通过 GitHub Actions 每天北京时间 02:00 提交为静态 JSON。

- **Overview / 总览** — Stats dashboard (movies/TV/albums released) + Daily Digest + Editor's Picks + Hidden Gems + Trending + Coming Soon / 数据统计面板 + 每日摘要 + 编辑精选 + 隐藏宝藏 + 热榜趋势 + 即将上映
- **Movies / 电影** — This Week / Upcoming / Now Playing with AI scores & tags / 本周上映 / 即将上映 / 热映中，含 AI 评分与标签
- **TV / 剧集** — This Week Premieres / Upcoming / Ongoing with season/episode tracking / 本周首播 / 即将播出 / 热播中，含季/集追踪
- **Music / 音乐** — MusicBrainz new releases, AI-filtered (global vs niche) with style tags & summaries / MusicBrainz 新发行，AI 筛选（全球关注 vs 小众），含风格标签和简介
- **Coming Soon / 即将上映** — Countdown cards × movies / TV / music, cross-referenced from each category's upcoming data / 倒计时卡片 × 电影/剧集/音乐，数据来自各栏目即将上映内容
- **Weekly Hot / 本周热榜** — Weekly ranked charts across movies, TV, and music / 电影/剧集/音乐周榜排行
- **Search / 搜索** — Local full-text search across all intelligence data / 全量情报数据本地全文搜索

**→ Bridges to: Home** (intelligence detail modals share the same TMDB-backed movie data used by the recommender)

**→ 关联首页：** 情报页详情弹窗使用与推荐引擎相同的 TMDB 电影数据

---

## 🎬 Curated Picks — Community Discovery / 社区发现

A browsable gallery of pre-curated recommendation pairs organized by genre, theme, and mood. Each pair links directly back to the recommendation engine.

按类型、主题和情绪分类的预设推荐对浏览画廊。每个推荐对可直接链接到推荐引擎。

- **Genre browsing / 分类浏览:** 15+ categories including Action, Sci-Fi, Horror, Romance, Anime, Documentary, etc. / 15+ 分类：动作、科幻、恐怖、爱情、动漫、纪录等
- **Curated pairs / 精选对:** Hand-picked movie duos with AI-generated recommendation paths / 人工精选电影对，含 AI 生成的推荐路径
- **One-click recommend / 一键推荐:** Click any pair to jump to the Home page with both films pre-loaded / 点击任一推荐对，跳转至首页并自动载入两部电影
- **Slug routing / 别名路由:** `/discover/genre/sci-fi` — shareable, indexable URLs / 可分享、可索引的 URL

**→ Bridges to: Home** (every pick feeds directly into the recommendation engine)

**→ 关联首页：** 每个精选对直接接入推荐引擎

---

## Architecture / 架构

```
Browser (React 18 + Vite SPA)

  ├── Home / 首页 (Discover)
  │     POST /api → Worker → DeepSeek + TMDB (on-demand / 实时)
  │
  ├── Intelligence / 情报
  │     GET /api/*.json → static daily snapshots / 每日静态快照
  │
  └── Curated Picks / 精选合辑
        data/discover.json → genre-filtered pre-curated pairs / 分类预配置对

GitHub Actions
  ├── intelligence-daily.yml  — 02:00 CST daily fetch & commit / 每日获取并提交
  └── deploy.yml              — auto-deploy on push to main / 推送 main 自动部署

Cloudflare Worker (workers-1.4.txt)
  ├── POST /           → DeepSeek recommendation / DeepSeek 推荐
  ├── GET /poster-proxy → TMDB image proxy / TMDB 图片代理
  └── GET /intelligence/* (10 endpoints / 个端点)
       /overview, /movies, /tv, /music,
       /coming, /weekly, /hidden-gems, /digest, /editor

External APIs / 外部接口
  ├── DeepSeek Chat   — AI enrichment & recommendation / AI 丰富与推荐
  ├── TMDB v4         — movie/TV metadata & images / 影视元数据与图片
  └── MusicBrainz     — album release data / 专辑发行数据
```

---

## Project Structure / 项目结构

```
src/
├── App.jsx                    # Routing: /, /discover, /intelligence, /admin
├── App.css                    # Tailwind + pixel-art theme / 像素风主题
├── i18n.jsx                   # zh-CN / en-US bilingual / 双语
├── components/
│   ├── IntelligencePage.jsx   # Intelligence hub (7 sub-views + search)
│   ├── DiscoverPage.jsx       # Curated Picks gallery / 精选合辑
│   ├── Cards.jsx              # 10 card components / 卡片组件
│   ├── AdminPage.jsx          # Admin dashboard / 管理后台
│   ├── InputPage.jsx          # Recommendation input / 推荐输入
│   ├── ResultsPage.jsx        # Recommendation results / 推荐结果
│   └── MovieDetail.jsx        # Movie detail sub-page / 电影详情
├── logic/useMovieEngine.js    # Core recommendation engine / 推荐引擎
├── services/                  # API + SEO + config
├── data/discover.json         # Curated recommendation pairs / 精选推荐对
scripts/
├── fetch-intelligence-data.js # Daily data pipeline / 每日数据流水线
.github/workflows/
├── deploy.yml                 # GitHub Pages deploy / 部署
├── intelligence-daily.yml     # 02:00 CST daily pipeline / 每日数据更新
workers-1.4.txt                # Cloudflare Worker (full source / 完整源码)
```

---

## Deploy / 部署

### Worker

```bash
# Paste workers-1.4.txt into Cloudflare Worker Editor → Deploy
# 将 workers-1.4.txt 粘贴到 Cloudflare Worker 编辑器 → 部署
```

**Env vars / 环境变量:** `DEEPSEEK_API_KEY` | `TMDB_API_READ_ACCESS_TOKEN` | `LASTFM_API_KEY`

### Frontend / 前端
Push to `main` → GitHub Actions auto-deploys to GitHub Pages.
推送 `main` 分支 → GitHub Actions 自动部署到 GitHub Pages。

### Data Pipeline / 数据流水线
`Intelligence Daily Pipeline` runs daily at **02:00 Beijing Time** (18:00 UTC). Manual trigger available in Actions tab.
每日 **北京时间 02:00** 自动运行，可在 Actions 标签页手动触发。

### Local Dev / 本地开发
```bash
npm install
npm run dev
# http://localhost:5173              → Home / 首页
# http://localhost:5173/intelligence → Intelligence / 情报
# http://localhost:5173/discover     → Curated Picks / 精选合辑
```

---

## Tech Stack / 技术栈

| Layer / 层级 | Tech / 技术 |
|-------|------|
| Build / 构建 | Vite 6 |
| UI / 界面 | React 18 + Tailwind CSS 4 |
| AI / 人工智能 | DeepSeek Chat |
| Film Data / 电影数据 | TMDB v4 |
| Music Data / 音乐数据 | MusicBrainz API |
| Backend / 后端 | Cloudflare Workers |
| Pipeline / 流水线 | GitHub Actions (cron + manual) |
| Deploy / 部署 | GitHub Pages + Cloudflare |
| i18n / 国际化 | zh-CN / en-US |

---

## Daily Schedule / 每日更新

| Task / 任务 | Time / 时间 | Trigger / 触发方式 |
|------|------|---------|
| Intelligence data fetch / 情报数据获取 | 02:00 CST / 北京时间 | GitHub Actions cron |
| Deploy to Pages / 部署到 Pages | After data commit / 数据提交后 | Push trigger / 推送触发 |
| Worker runs / Worker 运行 | On demand / 按需 | Cloudflare edge / 边缘节点 |

No manual operation needed — the site updates itself daily.
无需手动操作——网站每日自动更新。

---

MIT © BLOODYREX
