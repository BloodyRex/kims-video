# Kim's Video — AI Entertainment Platform / AI 娱乐推荐平台

**线上：** [bloodyrex.xyz](https://bloodyrex.xyz) · **API：** `https://api.bloodyrex.xyz`

> 📘 完整系统逻辑（算法公式、KV 结构、端点、运维）见 [docs/SYSTEM-MANUAL.md](docs/SYSTEM-MANUAL.md) · 面向使用者的操作说明见 [使用手册.md](使用手册.md)

![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Tech Stack](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)
![Tech Stack](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![Tech Stack](https://img.shields.io/badge/Cloudflare_Workers_×6-F38020?logo=cloudflare)
![Tech Stack](https://img.shields.io/badge/DeepSeek-4F46E5)
![Tech Stack](https://img.shields.io/badge/TMDB-01D277?logo=themoviedatabase)
![Tech Stack](https://img.shields.io/badge/MusicBrainz-BA478F)
![Tech Stack](https://img.shields.io/badge/Resend-000000?logo=resend)

---

## 六大页面 / Six Pages

| 页面 / Page | 路由 / Route | 角色 / Role | 数据来源 / Data |
|---|---|---|---|
| **首页 AI 推荐** | `/` `/search` | 输入 1–2 部参考片 → 渐进式 AI 问答 → 5 张定制推荐（2 热门 + 2 冷门 + 1 惊喜） | DeepSeek + TMDB（实时） |
| **Discover 精选合辑** | `/discover` | 按类型/主题/情绪浏览预设推荐对，一键回填首页 | `src/data/discover.json` + 社区提交（KV） |
| **Intelligence 情报中心** | `/intelligence` | 影视音乐每日数据中心：总览 / 电影 / 剧集 / 音乐 / 即将上映 / 本周热榜 / 搜索 | `public/api/*.json`（每日流水线生成） |
| **Wall 影视墙** | `/wall` | 按上线日期累积的电影墙，自动收录、分页、状态与类型筛选 | `public/api/wall.json`（每日增长） |
| **Festivals 电影节日历** | `/festivals` | 全球电影节排片：今天 / 本周 / 月历 / 电影节库 / 变更记录 | `public/api/festivals*.json`（30 分钟一抓） |
| **My Data 我的数据** | `/my-data` | 收藏与搜索历史的导出/导入、口令加密、跨设备迁移码 | 浏览器本地存储 + discover worker |

另有 `/admin`（管理后台，口令登录）与 `/entry`（开屏四图入口）。

---

## 架构 / Architecture

```
浏览器 (React 18 + Vite SPA)
  └── Cloudflare Pages 项目 kims-video  ← bloodyrex.xyz 真身（GitHub Pages 仅旁路备份）

API 层：api.bloodyrex.xyz → Router Worker「kims-video」(workers/router.js)
  ├── 内置 /poster-proxy（TMDB / coverartarchive 图片代理 + 边缘缓存）
  ├── /discover/*  /wall/*  /migrate/*  → kims-video-discover
  ├── /admin/*                          → kims-video-admin
  ├── /api/wall/*                       → kims-video-wall
  ├── /intelligence/{digest,subscribe,send-digest,send-test,unsubscribe} → kims-video-digest
  ├── /intelligence/*（其余）            → kims-video-intel
  └── POST /*（AI 推荐 / AI 搜索）        → kims-video-intel（通用 AI 代理）

存储：Cloudflare KV（DISCOVER_KV / SUBSCRIBE_KV）+ 边缘缓存 + 仓库内静态 JSON（public/api/、data/festivals/）
外部：DeepSeek（AI）、TMDB v4（影视）、MusicBrainz + Last.fm（音乐）、Resend（邮件）、电影节官方站点
```

6 个 Worker 均为**自包含机械切片**（不互相 import，避免 KV 前缀漂移）。部署顺序固定：5 个子 worker（`workers_dev=false`，无公网路由）→ router（保住 `api.bloodyrex.xyz` 自定义域名）。

---

## 自动化 / Automation

| 任务 | 时间（北京） | 触发 |
|---|---|---|
| 情报数据抓取（movies / tv / music / coming / wall / digest） | 01:28 | `intelligence-daily.yml` cron `28 17 * * *`，失败重试 3 次 |
| 电影节日历抓取 | 每 30 分钟（:07 / :37） | `festival-daily.yml`，脚本按站点状态自行节流，无变化不 commit |
| 每日邮件摘要（主） | 06:28 | `digest-backup.yml` 调 Worker `/intelligence/send-digest` |
| 每日邮件摘要（备） | 06:35 | digest worker Cron `35 22 * * *`，KV 幂等标记防重发 |
| 前端部署 | push 后 | `deploy-frontend.yml`：`verify.mjs` 门禁 → build → Cloudflare Pages |
| Worker 部署 | push 后 | `deploy-worker.yml`（Node 24）：5 子 worker + router |

数据流水线结果直接 commit 回仓库（`[data]` 提交），前端消费静态 JSON——站点无需人工维护。

---

## 项目结构 / Project Structure

```
src/
├── App.jsx                       # 路由表（/ /discover /intelligence /wall /festivals /my-data /admin /entry）
├── i18n.jsx                      # zh-CN / en-US 双语
├── components/
│   ├── NewHomePage.jsx           # 首页（AI 推荐 + 内嵌面板）
│   ├── DiscoverPage.jsx          # 精选合辑（DiscoverComponents/）
│   ├── IntelligencePage.jsx      # 情报中心（IntelViews/ 六个子视图）
│   ├── WallPage.jsx              # 影视墙（WallCards / WallDetailView）
│   ├── FestivalCalendarPage.jsx  # 电影节日历（5 个 tab + 详情页）
│   ├── MyDataPage.jsx / MyDataPanel.jsx  # 我的数据：独立页 + 首页内嵌版，共享逻辑需同步改
│   ├── AdminPage.jsx             # 管理后台（intel 配置、结果审核）
│   ├── PixelAvatar.jsx           # 像素分身（内嵌 public/pixel-avatar-v16.html）
│   └── Cards.jsx / IntelCards.jsx / DetailModals.jsx / SiteFooter.jsx ...
├── hooks/                        # useMovieDetail / useJsonData / useDiscoverData / useOverlayLock
├── logic/useMovieEngine.js       # 推荐引擎
├── services/                     # api / adminApi / discoverApi / migrationApi / prompts / seo / aiConfig
└── utils/                        # personalStore（本地数据）/ poster / cache / stylePreference / url

workers/                          # 6 个 Worker 源码：router + discover / intel / digest / admin / wall
wrangler.toml                     # router（[[services]] 绑定 5 个子 worker）
wrangler.{discover,intel,digest,admin,wall}.toml
config/                           # intelligence.config.js（抓取源与开关）、壁纸主题/尺寸
scripts/                          # fetch-intelligence-data.js、music-pipeline.js、festivals/*（7 站 adapter）
data/festivals/                   # registry / snapshots / changes / raw 快照
public/api/                       # 线上消费的静态 JSON 快照
public/entry/                     # 开屏四图（横/竖屏）
docs/SYSTEM-MANUAL.md             # 系统手册（算法与运维）
tests/e2e/                        # CDP 端到端用例
```

---

## 部署 / Deploy

### 前端
push `main`（`src/**`、`public/**`、`index.html`、`vite.config.*`、`package.json`）→ `deploy-frontend.yml`：
`npm ci` → `node scripts/festivals/verify.mjs`（未授权详情文件阻断门禁）→ `npm run build` → `wrangler pages deploy dist --project-name kims-video`。
GitHub Pages 步骤为 `continue-on-error` 的旁路，不影响线上。

### Worker
push `workers/**` / `wrangler*.toml` / 壁纸配置 → `deploy-worker.yml`：先 5 个子 worker，最后 router。

### Actions Secrets
`CLOUDFLARE_API_TOKEN` · `CLOUDFLARE_ACCOUNT_ID` · `TMDB_API_READ_ACCESS_TOKEN` · `DEEPSEEK_API_KEY` · `RESEND_API_KEY` · `DIGEST_SECRET` · `LASTFM_API_KEY`
Worker 运行时密钥（如 `ADMIN_PASSWORD`）用 `wrangler secret put` 手动维护。

### 本地开发
```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # prebuild 生成 sitemap，postbuild 生成类型页/详情页
```

---

## 技术栈 / Tech Stack

| 层 | 技术 |
|---|---|
| 构建 | Vite 6（CI 前端 Node 20，Worker 部署 Node 24） |
| 前端 | React 18.3 + React Router 7 + Tailwind CSS 4 |
| 后端 | Cloudflare Workers ×6（ESM + Service Bindings） |
| 存储 | Cloudflare KV + 边缘缓存 + 仓库静态 JSON |
| AI | DeepSeek Chat（推荐问答 / 摘要 / 翻译） |
| 数据 | TMDB v4 · MusicBrainz · Last.fm · 电影节官方站点（BIFF 釜山、BFI、Cannes、HKIFF、IDFA、IFFR、Venice） |
| 邮件 | Resend（`digest@bloodyrex.xyz`） |
| 部署 | Cloudflare Pages + GitHub Actions |

---

MIT © BLOODYREX (Rex Huang)
