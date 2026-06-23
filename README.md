# Kim's Video — AI Movie Recommender

一个基于 **DeepSeek AI** + **TMDB** 的个性化影视推荐单页应用。输入你喜欢的作品，AI 通过渐进式问答精准分析审美口味，推荐 5 部量身定制的电影/剧集（2 部热门 + 2 部冷门 + 1 部争议之选），自动获取英文/国际版海报与元数据。

![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Tech Stack](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)
![Tech Stack](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![Tech Stack](https://img.shields.io/badge/Cloudflare_Worker-F38020?logo=cloudflare)
![Tech Stack](https://img.shields.io/badge/DeepSeek-4F46E5)
![Tech Stack](https://img.shields.io/badge/TMDB-01D277?logo=themoviedatabase)
<img width="730" height="897" alt="image" src="https://github.com/user-attachments/assets/a0fcfbc1-ef17-48be-9e04-4c2f971eb61a" />

---

## ✨ 功能

- **🎬 双作品输入** — 可输入 1–2 部参考作品，AI 分析共同特征与差异
- **🧬 渐进式问答** — 根据参考作品动态生成 6–8 个分层问题（快速收敛 → 交集确认 → 细分偏好）
- **🤖 AI 精准推荐** — DeepSeek 驱动，2 部热门 + 2 部冷门 + 1 部争议之选
- **🖼️ 国际版海报** — 自动获取 TMDB 英文/国际版海报，而非中文区海报
- **🔄 换一换** — 对任意卡片单独替换，AI 重新生成不重复的推荐
- **📄 子页面路由** — 每部推荐电影拥有独立资料页（`?from=&r=` URL 驱动），展示 TMDB 完整资料（简介/评分/类型/时长/演员），支持分享与前进后退
- **🔗 URL 分享** — 推荐结果页和子页面均可通过链接分享，接收方恢复推荐列表或查看电影详情
- **🎨 复古像素风 UI** — 荧光粉/电光蓝/亮黄色粗边框 + 阴影，向录像带时代致敬
- **📸 截图保存** — 一键保存推荐结果为 PNG 图片

---

## 🏗️ 架构

```
┌─ Browser ─────────────────────────────────────────────────────────┐
│  Vite + React 18                                                   │
│                                                                    │
│  URL 路由（pushState 驱动）                                        │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  /                     → 输入页                          │     │
│  │  ?from={batchId}       → 推荐结果页                      │     │
│  │  ?from={batchId}&r={id}→ 电影资料子页面                  │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  推荐结果 → 缓存到 sessionStorage (key: kims_recos_{batchId})      │
│  子页面数据 → 通过 TMDB ID 从 Worker 查询（缓存无关）              │
│                                                                    │
│  状态机：input → loading → qa → loading → results / detail        │
│  ↕ POST /                                                           │
└───────────────────┬─────────────────────────────────────────────────┘
                    │
┌─ Cloudflare Worker ────────────────────────────────────────────────┐
│  workers-1.2.txt                                                    │
│  ┌─ Route ────────────────────────────────────────────────┐       │
│  │ poster-proxy → TMDB 海报 CORS 代理                     │       │
│  │ { tmdbId }   → TMDB details（含简介/评分/类型/演员等）  │       │
│  │ { prompt,… } → DeepSeek + TMDB poster/字段补全         │       │
│  └────────────────────────────────────────────────────────┘       │
│  ↕ HTTPS                                                            │
└──┬──────────────────────────────────────────────────────────────────┘
   │
   ├──→ DeepSeek API (chat/completions)
   │
   └──→ TMDB v4 API (search/movie, movie/{id}, credits, images)
         └──→ Cloudflare Cache API 缓存海报/导演/年份/资料（24h TTL）
```

### 前端（Vite + React）
- **Vite 6** — 构建工具，HMR 开发体验
- **React 18** — UI 框架
- **Tailwind CSS 4** — 原子化 CSS
- **dom-to-image-more** — 截图保存（SVG foreignObject 渲染）
- **SPA 路由** — `window.history.pushState` + `popstate` 实现无刷新页面切换
- **sessionStorage** — 推荐结果缓存，支持后退恢复
- 6 步骤状态机：`input → loading_questions → qa → loading_results → results / detail`
- 推荐生成逻辑封装在 `useMovieEngine` 自定义 Hook 中

### 子页面路由设计

```
URL 格式: ?from={sourceId}&r={recTmdbId}

from: 批次标识（推荐列表中第一部电影的 TMDB ID）
r:    当前查看的电影 TMDB ID

路由状态:
  /                    → 输入页
  ?from=xxx            → 推荐结果页（展示 5 部推荐列表）
  ?from=xxx&r=yyy      → 电影资料子页面
```

### 后端（Cloudflare Worker）
- **DeepSeek Chat** — 推荐生成与问题生成
- **TMDB v4** — 海报查询 + 字段补全（导演/年份/原名/类型/简介/评分/演员），英文海报优先
- **Cloudflare Cache API** — 缓存 TMDB 静态数据（24h），降低 API 消耗
- 多路由：`poster-proxy` 海报 CORS 代理，`{ tmdbId }` 直接查询 TMDB，`{ prompt, ... }` 走 DeepSeek + TMDB 增强

---

## 🚀 部署

### 目录结构

```
kims-video/
├── index.html                  # Vite 入口 HTML
├── vite.config.js              # Vite 配置
├── package.json
├── .env                        # VITE_API_URL 环境变量
├── .gitignore
├── public/                     # 静态资源
│   ├── CNAME                   # GitHub Pages 自定义域名
│   ├── .nojekyll
│   ├── robots.txt
│   └── sitemap.xml
├── src/
│   ├── main.jsx                # React 入口
│   ├── App.jsx                 # 主组件
│   ├── App.css                 # Tailwind + 全局样式
│   ├── components/             # UI 组件
│   │   ├── InputPage.jsx       # 输入页
│   │   ├── QAPage.jsx          # 问答页
│   │   ├── ResultsPage.jsx     # 推荐结果页
│   │   ├── MovieDetail.jsx     # 电影详情页
│   │   ├── SaveContent.jsx     # 截图保存布局
│   │   ├── Icons.jsx           # SVG 图标
│   │   └── Loading.jsx         # 加载动画
│   ├── logic/
│   │   └── useMovieEngine.js   # 核心业务逻辑 Hook
│   ├── services/
│   │   ├── api.js              # API 调用
│   │   ├── prompts.js          # AI 提示词模板
│   │   ├── seo.js              # SEO 管理
│   │   └── config.js           # 配置
│   └── utils/
│       ├── cache.js            # sessionStorage 缓存
│       ├── url.js              # URL 管理 / 海报代理
│       └── parseJSON.js        # JSON 安全解析
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions 自动部署
└── workers-1.2.txt             # Cloudflare Worker 源码
```

### 1. 部署 Cloudflare Worker

```bash
npm install -g wrangler
wrangler login
wrangler deploy workers-1.2.txt --name kims-video
```

### 2. 设置环境变量

Cloudflare Dashboard → Worker → Settings → Variables：

| Variable | 说明 | 获取地址 |
|----------|------|----------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key | https://platform.deepseek.com |
| `TMDB_API_READ_ACCESS_TOKEN` | TMDB v4 Bearer Token | https://themoviedb.org/settings/api |

### 3. 配置自定义域名

Worker → Triggers → Custom Domains 添加 `api.bloodyrex.xyz`。

### 4. 部署前端

推送 main 分支 → GitHub Actions 自动构建并部署到 GitHub Pages。

---

## 🛠️ 技术栈

| 组件 | 技术 |
|------|------|
| 构建工具 | Vite 6 |
| UI 框架 | React 18 |
| 样式 | Tailwind CSS 4 |
| 截图 | dom-to-image-more |
| SPA 路由 | pushState + popstate |
| 客户端缓存 | sessionStorage |
| AI | DeepSeek Chat API |
| 海报/元数据 | TMDB v4 API |
| 后端网关 | Cloudflare Workers |
| 自动部署 | GitHub Actions |
| 域名 | bloodyrex.xyz / api.bloodyrex.xyz |

---

## 📜 License

MIT © BLOODYREX
