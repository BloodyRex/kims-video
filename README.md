# Kim's Video — AI Entertainment Platform / AI 娱乐推荐平台

**Discover / 发现** — AI-powered personalized film recommendation / AI 个性化电影推荐。

**Intelligence / 情报** — Daily auto-aggregated global entertainment data hub / 每日自动汇总全球娱乐数据。

![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Tech Stack](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)
![Tech Stack](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![Tech Stack](https://img.shields.io/badge/Cloudflare_Worker-F38020?logo=cloudflare)
![Tech Stack](https://img.shields.io/badge/DeepSeek-4F46E5)
![Tech Stack](https://img.shields.io/badge/TMDB-01D277?logo=themoviedatabase)
![Tech Stack](https://img.shields.io/badge/MusicBrainz-BA478F)

---

## ✨ Discover — AI Movie Recommender / AI 电影推荐

- Input 1-2 reference films → AI progressive Q&A → 5 tailored picks / 输入 1-2 部参考电影 → AI 渐进式问答 → 5 个定制推荐
- 2 popular + 2 hidden gems + 1 wild card, powered by DeepSeek / 2 热门 + 2 冷门 + 1 惊喜，DeepSeek 驱动
- Individual movie detail pages with TMDB metadata / 独立电影详情页，含 TMDB 元数据
- URL sharing, screenshot save, "swap one" per card / URL 分享、截图保存、逐张替换
- Community discovery page with genre-curated recommendation pairs / 社区发现页，分类精选推荐组合

---

## 📡 Intelligence — Entertainment Data Hub / 娱乐情报中心

- **Overview / 总览** — Daily stats (movies/TV/albums) + Editor's Picks + Hidden Gems + Trending + Daily Digest / 每日数据统计 + 编辑精选 + 隐藏宝藏 + 热榜 + 每日摘要
- **Movies / 电影** — Today / This Week / Upcoming / Now Playing with TMDB rating + AI score / 今日 / 本周 / 即将上映 / 热映中，含 TMDB 评分 + AI 评分
- **TV / 剧集** — Today / This Week / Upcoming / Ongoing with season/episode info / 今日 / 本周 / 即将 / 热播中，含季/集信息
- **Music / 音乐** — MusicBrainz new releases filtered by DeepSeek AI (global vs niche) / MusicBrainz 新发行，DeepSeek AI 筛选（全球关注 vs 小众佳作）
- **Coming Soon / 即将上映** — 7-day / 30-day countdown cards / 7 天 / 30 天倒计时卡片
- **Trending / 热榜** — Daily & Weekly ranked charts × Movies / TV / Music / 日榜 & 周榜 × 电影 / 剧集 / 音乐
- **Weekly Snapshot / 每周快照** — Dashboard with stats, Editor's Picks, Hidden Gems, trending highlights, one-minute AI summary / 仪表盘：数据统计、编辑精选、隐藏宝藏、趋势亮点、AI 一分钟摘要
- **AI Spotlight / AI 精选** — Daily DeepSeek-generated 7-category picks (Editor's Pick, Hidden Gem, Most Anticipated, etc.) / 每日 DeepSeek 生成 7 类精选
- **Hidden Gems / 隐藏宝藏** — Undiscovered quality picks surfaced by AI from now-playing titles / AI 从热映中发掘的冷门佳作
- **Daily Digest / 每日摘要** — AI-generated headline + summary + top trends of the day / AI 生成的每日要闻 + 趋势
- **Search / 搜索** — Local JSON search across all movies, TV, albums, artists / 本地 JSON 全文搜索

---

## Architecture / 架构

```
Browser (React 18 + Vite / SPA with react-router-dom)
  |
  |-- Discover: POST /api → Worker → DeepSeek + TMDB
  |-- Intelligence: GET /api/*.json (static, updated daily / 每日更新)
  |
GitHub Actions (Intelligence Daily Pipeline / 情报每日流水线)
  |-- Calls Worker /intelligence/* endpoints / 调用 Worker 端点
  |-- Writes JSON → commits → triggers Pages deploy / 写入 JSON → 提交 → 触发 Pages 部署
  |
Cloudflare Worker
  |-- POST /           → DeepSeek recommendation / DeepSeek 推荐
  |-- GET  /poster-proxy → TMDB image proxy / TMDB 图片代理
  |-- GET  /intelligence/* (10 endpoints / 个端点)
  |     /overview, /movies, /tv, /music,
  |     /trending, /coming, /weekly, /editor,
  |     /hidden-gems, /digest
  |
  +--- DeepSeek API (chat/completions)
  +--- TMDB v4 API (search, now_playing, trending, details)
  +--- MusicBrainz API (release query)
```

---

## Project Structure / 项目结构

```
src/
├── App.jsx                    # Main app + react-router-dom routing
├── App.css                    # Tailwind + pixel-art theme / 像素风主题
├── i18n.jsx                   # zh-CN / en-US bilingual / 双语
├── components/
│   ├── IntelligencePage.jsx   # Intelligence hub (10 sub-views / 子视图)
│   ├── Cards.jsx              # 7 card components / 卡片组件
│   ├── DiscoverPage.jsx       # Discovery hub / 发现页
│   ├── AdminPage.jsx          # Admin dashboard / 管理后台
│   ├── InputPage.jsx          # Recommendation input / 推荐输入
│   ├── ResultsPage.jsx        # Recommendation results / 推荐结果
│   ├── MovieDetail.jsx        # Movie detail sub-page / 电影详情
│   └── Icons.jsx              # SVG icons / 图标
├── logic/useMovieEngine.js    # Core recommendation engine / 推荐引擎
├── services/                  # API + SEO + config
├── data/discover.json         # Discover recommendation pairs / 发现页推荐对
scripts/
├── fetch-intelligence-data.js # Daily data pipeline / 每日数据流水线
.github/workflows/
├── deploy.yml                 # GitHub Pages deploy / 部署
├── intelligence-daily.yml     # Daily data pipeline / 每日数据更新
workers-1.3.txt                # Cloudflare Worker (full source / 完整源码)
```

---

## Deploy / 部署

### Worker
Paste `workers-1.3.txt` into Cloudflare Worker Editor → Deploy.
将 `workers-1.3.txt` 粘贴到 Cloudflare Worker 编辑器 → 部署。

**Env vars / 环境变量:** `DEEPSEEK_API_KEY` | `TMDB_API_READ_ACCESS_TOKEN`

### Frontend / 前端
Push to `main` → GitHub Actions auto-deploys to GitHub Pages.
推送 `main` 分支 → GitHub Actions 自动部署到 GitHub Pages。

### Data Pipeline / 数据流水线
`Intelligence Daily Pipeline` runs daily at 02:00 UTC. Manual trigger available in Actions tab.
每日 UTC 02:00 自动运行，可在 Actions 标签页手动触发。

### Local Dev / 本地开发
```bash
npm install
npm run dev
# http://localhost:5173              → Main / 主页
# http://localhost:5173/intelligence → Intelligence / 情报
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

MIT © BLOODYREX
