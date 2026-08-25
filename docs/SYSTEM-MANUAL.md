# Kim's Video — 系统使用手册（v1.3.0）

> 本文档面向任何 AI 工具或开发者：读完即可完整理解本网站的架构、页面功能、推荐算法、隐藏设计、数据流水线与运维方式。配套的面向用户的 README.md 更侧重功能介绍，本文档侧重**运行逻辑**。

---

## 1. 项目概览与网址

一句话：**AI 影视推荐 + 每日影音情报 + 影视墙 + 社区精选** 的娱乐平台，数据由 Cloudflare Worker 聚合、DeepSeek AI 增强、GitHub Actions 每日快照、GitHub Pages 托管。

| 资源 | 地址 |
|---|---|
| 网站（GitHub Pages + CNAME） | https://bloodyrex.xyz |
| API（Cloudflare Worker） | https://api.bloodyrex.xyz |
| 情报数据静态快照 | https://bloodyrex.xyz/api/*.json |
| 仓库 | https://github.com/BloodyRex/kims-video |
| 邮件发送方 | digest@bloodyrex.xyz（Resend） |
| Google Analytics | G-P7PY236BK9（index.html 内 gtag.js） |
| Sitemap / robots | https://bloodyrex.xyz/sitemap.xml / robots.txt |

---

## 2. 架构与数据流

```
用户 → GitHub Pages SPA (React 18 + Vite 6 + Tailwind 4)
          │ fetch（同域 /api 由 vite proxy 转发，生产直连 api.bloodyrex.xyz）
          ▼
    Cloudflare Worker（单文件 workers-1.4.js，全部后端逻辑）
          │
          ├─ TMDB API（电影/剧集数据，zh-CN + en-US 双语）
          ├─ MusicBrainz + CoverArtArchive（音乐新发行）
          ├─ Last.fm（歌手热度过滤）
          ├─ DeepSeek API（AI 推荐、问答、摘要、精选、翻译）
          ├─ Resend API（每日邮件）
          ├─ KV（订阅者 / 社区精选 / 影视墙推荐收集 / 邮件去重 / 缓存）
          └─ R2（社区精选缩略图）
          │
          ▼
   GitHub Actions 每日流水线 → 提交 public/api/*.json → 触发 Pages 部署
```

**每日周期（UTC = 北京时间 - 8h）**

| 时间（北京时间） | 事件 |
|---|---|
| 01:28 | `intelligence-daily.yml` 流水线：拉取全部情报数据 → 写静态 JSON → 提交 → 部署 Pages |
| 06:28 | `digest-backup.yml` 调用 Worker `/intelligence/send-digest` → Resend 向全部订阅者发当日邮件 |
| 全天 | 用户使用 AI 推荐 / 浏览情报 / 影视墙 / 社区精选 |

邮件无 Worker Cron Trigger（wrangler.toml 无 triggers），唯一触发源是 GitHub Actions。

---

## 3. 技术栈

React 18 + react-router-dom 7 + Vite 6 + Tailwind CSS 4（前端）；Cloudflare Worker（ESM 单文件）；DeepSeek（deepseek-v4-flash）；TMDB / MusicBrainz / Last.fm；Resend；Cloudflare KV + R2；GitHub Actions（4 个 workflow）；Wrangler 部署。

---

## 4. 前端 SPA

### 4.1 路由（src/App.jsx）

| 路径 | 组件 | 说明 |
|---|---|---|
| `/`（= `/discover`） | EntryPage | AI 推荐引擎入口（输入 1-2 部参考片） |
| `/discover/genre/:slug` | DiscoverPage | 社区精选分类页（15+ 分类，可分享 URL） |
| `/recommend` | EntryPage | 推荐入口别名 |
| `/intelligence(/movies\|tv\|music\|coming\|weekly\|search)` | IntelligencePage | 情报中心，tab 切换 |
| `/wall` | WallPage | 影视墙 |
| `/admin` | AdminPage | 后台管理（**隐藏入口，见 4.4**） |

SPA 路由修复：`public/_redirects` = `/* /index.html 200` + index.html 内 sessionStorage 恢复路径脚本。

### 4.2 页面功能

**① 首页（AI 推荐引擎）**：输入 1-2 部参考片 → DeepSeek 渐进式问答（5-8 题，动态生成，测试不同电影特征）→ 输出 **5 个推荐 = 2 热门 + 2 冷门 + 1 惊喜**（结构化 JSON schema 输出）。支持：任意单张替换（记录已展示标题避免重复）、URL 分享（含详情路由）、PNG 截图下载（dom-to-image-more）、每部电影独立详情页（TMDB 双语数据）。AI 输出经 `repairRecommendationFields` 用 TMDB 校验/修复字段。

**② 情报中心**：7 个 tab——总览 / 本周热榜 / 即将上映 / 电影 / 剧集 / 音乐 / 搜索。数据全部来自 `public/api/*.json` 静态快照（零实时 API 调用）。电影 tab 内：本周上映 / 即将上映 / 热映中；剧集 tab 内：本周首播 / 即将播出 / 热播中（带 S/E 追踪）；音乐 tab 内：热门趋势 / 编辑推荐 / 隐藏宝石 / 环球音乐。搜索 tab 为本地全文搜索。

**③ 影视墙**：按上映日期降序累积的电影墙（数据 `public/api/wall.json`），每页 24 张。筛选：
- 状态：已上线 / 未上线
- 类型标签：9 个桶 = 8 个常见类型（Action/Sci-Fi/Comedy/Romance/Horror/Drama/Animation/Thriller/Documentary）+ **"其他/OTHER"**（其余全部落入，`COMMON_GENRES` 外归桶）
- **隐藏分类按钮"来自社区 / FROM COMMUNITY"**：按 `source: "rec"` 过滤用户通过 `/wall/collect` 提交的片（卡片本身不显示来源徽标，仅过滤）。按钮有专属彗星边框动画（CSS keyframes，顺时针实头拖尾）。

**④ 社区精选（Curated Picks）**：预配置推荐对画廊（`src/data/discover.json`），按类型/主题分类；用户可上传缩略图、点赞（存 KV）；推荐对一键跳转首页自动载入两部电影。

### 4.3 设计风格

黑底霓虹（Vaporwave/retro-futurist）：`#111` 背景 + 动态渐变光斑 + SVG 噪点纹理（App.css）；主色粉 `#ff00ff`、青 `#00ffff`、黄 `#ffff00`、绿 `#00ff00`；**像素字体 "Press Start 2P"**（内联 @font-face 保证 dom-to-image 截图可用）+ Noto Sans SC；卡片粗黑边框 + 硬阴影（`shadow-[2px_2px_0_0_#000]`）+ 按下位移效果；全站中英双语（i18n，`?lang=` 参数 + hreflang）。

### 4.4 隐藏设计

- **Footer 登录入口**：footer 右下角一个几乎不可见的 `·`（`text-[8px] opacity-20 hover:opacity-100`），点击进入 `/admin`。
- **Admin 后台**（AdminPage.jsx + adminApi.js）：管理社区精选（列表/删除/改分类），需 `POST /admin/login` 验证 `ADMIN_PASSWORD`，签发 token 后调 `/admin/results` 等。

### 4.5 SEO

JSON-LD（WebSite + SearchAction + 详情页）、OG 标签、hreflang（zh/en/x-default）、`generate-sitemap.js` 构建时生成 sitemap（30 URL）、`generate-detail-pages.js` 预渲染 18 个电影详情静态页 + 8 个类型页（`dist/genre/`、`dist/d/`）。

---

## 5. 后端（Cloudflare Worker，workers-1.4.js）

### 5.1 端点清单

| 端点 | 方法 | 功能 |
|---|---|---|
| `/poster-proxy` | GET | 代理 TMDB/CoverArtArchive 图片（国内网络可达），Cache API 缓存 1 天；**邮件海报必须走它** |
| `/intelligence/{overview,movies,tv,music,coming,weekly,digest,debug}` | GET | 情报数据生成（流水线调用，输出静态 JSON） |
| `/intelligence/hidden-gems` | GET/POST | GET=legacy（自抓 now_playing）；POST=**v2：流水线把当天 movies.json/tv.json 作为 body 传入**，AI 双池精选（见 6.5） |
| `/intelligence/music/v2` | POST | 音乐 AI 精选（流水线传候选） |
| `/intelligence/trailer` | GET | TMDB 预告片 key 查询 |
| `/intelligence/translate-overview` | POST | wall 英文简介批量中译（DeepSeek） |
| `/intelligence/subscribe` | POST | 订阅邮件（KV `sub:{email}`） |
| `/intelligence/unsubscribe` | GET/POST | 退订（Worker 渲染 HTML 页面） |
| `/intelligence/send-digest` | POST | 发当日邮件给全部订阅者（Bearer DIGEST_SECRET，KV 去重） |
| `/intelligence/send-test` | POST | 发单封测试邮件（Bearer DIGEST_SECRET，只发请求体指定邮箱） |
| `/wall/collect` | POST | 用户推荐片收集（KV `wallRec:*`，IP 限流 120/10min） |
| `/wall/recs` | GET | 返回收集的推荐片（流水线 merge 进 wall） |
| `/discover/results` | GET/POST | 社区精选列表（genre/sort/limit 过滤）/ 创建 |
| `/discover/results/{id}/like`、`/upload` | POST | 点赞 / 缩略图上传（R2） |
| `/discover/thumbnail/{id}` | GET | R2 缩略图读取（CDN 缓存 1 天） |
| `/admin/login`、`/admin/results(/{id})` | POST / GET / DELETE / PATCH | 后台管理（Bearer token） |

### 5.2 存储结构（Cloudflare KV ×2 + R2 ×1）

- `SUBSCRIBE_KV`：`sub:{email}`（订阅者）、`digest:{date}`（当日邮件 HTML 缓存 24h）、`digestStatus:{date}`（发送去重标记）
- `DISCOVER_KV`：`result:{id}`（社区精选文档，含 likes）、`wallRec:{tmdbId}`（用户推荐片）、`wallrl:{ip}`（限流计数）、`__warmup`
- `DISCOVER_R2`：`thumbnails/{id}.png`

### 5.3 关键约束：Cloudflare 免费版 50 子请求上限

- 单次 invocation 子请求（fetch + KV/R2/D1）上限 **50**；Cache API 的 match/put **不计入**（只占 6 并发连接）。
- 每个 `withCache` 冷点 = match + 2×fetch + put = **4 子请求**。
- 铁律：**每个端点全冷缓存时必须 <50**（流水线首跑/部署后必现）。当前预算：movies 20 / tv ~46 / coming 8 / weekly 12 / overview 32。
- 超限表现：端点 500 `Too many subrequests` → 流水线 FAIL。

---

## 6. 核心算法

### 6.1 复合评分 intelComputeScore（周榜/热映/首播等排序）

`score = (w_pop×S_pop + w_date×S_date + w_qual×S_qual) / 100`，三子项均 0-100：

| 类型 | w_pop | w_date | w_qual | hlFuture | hlPast |
|---|---|---|---|---|---|
| movie | 0.25 | 0.55 | 0.20 | 14 天 | 7 天 |
| tv | 0.25 | 0.45 | 0.30 | 14 天 | 7 天 |
| music | 0.50 | 0.20 | 0.30 | 21 天 | 14 天 |

- **S_pop**：popularity 在当前批内归一化 `(pop-min)/(max-min)×100`。
- **S_date**：非对称半衰期衰减 `100×exp(-ln2/halfLife×|天数差|)`，未来用 hlFuture、过去用 hlPast；**无日期 → 0 分沉底**。
- **S_qual**：`vote_average/10×100`；有票但 0 分 → 中性 50；无数据 → 温和基线 40（不抬升不埋没）。

### 6.2 多样性选择 intelSelectDiverse（本周/在映/首播/热播）

1. 按 6.1 打分排序；
2. **区域保留**：中文(zh:2) / 日(ja:1) / 韩(ko:1) 各自先保最高分名额（剧集用 cn/hmt/jp/kr: 1/1/1/1）；`classifyRegion` 按 original_language + origin_country 判定；
3. **类型上限**：同一主类型最多 4 部（genre_ids[0]）；
4. 最终按分数降序截取目标数（周榜 15、热映 15、首播 15）。

### 6.3 评分制 intelSelectScored（即将上映专用，2026-08-12 起）

`score = (0.6×S_pop归一化 + 0.4×S_zh) / 100`；**S_zh = 标题含中文 +50 + 简介含中文 +50**。

- 先按**绝对 popularity 门槛**过滤：电影 ≥15、剧集 ≥8（门槛才是控制数量/质量的手段，纯评分会永远满额且全中文）；
- 无中文但高热度的片可凭人气入选（设计意图：中文从"淘汰项"变"加分项"）；
- 上限 15。

### 6.4 即将上映 90 天窗口（替代 TMDB /movie/upcoming）

`/movie/upcoming` 是滚动 3 周窗口且每天重复 → 改用 discover 查询：`primary_release_date.gte=today, lte=today+90, sort=popularity.desc`（`intelFetchUpcomingMovies`），电影/剧集都只取第 1 页（数据验证：pop≥15 电影、pop≥8 剧集全在第 1 页）。

### 6.5 Hidden Gems v2（今日电影/剧集推荐，2026-08-13 起）

- 流水线把**当天** movies.json/tv.json POST 给端点（CDN 静态文件此时仍是昨日，不能读）；
- 候选池：电影 = releasedThisWeek + nowPlaying + upcoming；剧集 = premieresThisWeek + ongoing + upcoming；统一 rating≥7、tmdbId 去重、上限 15；
- DeepSeek 从双池各选 **3-5 部**（输出 mediaType + index + 中文推荐语 why + aiScore + tags + audience），剧集带 S/E；
- **失败兜底**：AI 不可用时按评分降序各取 3 部（fallback:true），邮件显示简介代替推荐语——邮件永远有推荐内容。

### 6.6 音乐 pipeline（Node.js 侧，无子请求限制）

MusicBrainz 近 30 天新发行（3 页×100）→ Last.fm 歌手热度过滤（listeners≥500，`intelFilterByArtistPopularity`）→ 候选 18 条 → POST `/intelligence/music/v2` AI 精选 15 条（4 分类：热门趋势/编辑推荐/隐藏宝石/环球音乐，带 highlight 与 listeners）。

### 6.7 每日邮件 digest（fetchDigestData + renderDigestHtml，零 TMDB 调用）

`fetchDigestData` 读 8 个静态 JSON（digest/overview/tv/music/movies/hidden-gems/wall-delta/tvwall-delta），一次取数；`renderDigestHtml(data, now, locale)` 按语言渲染（zh/en 各一份，字段缺失时 zh↔en 回退）。2026-08-25 起为双语版：

1. **每日摘要**：headline(+En) + summary(+En) + industryHighlights 要点 bullet + topTrends 标签（AI 失败时程序化兜底）；
2. **影视日历**：未来 30 天排片（电影 6 + 剧集 6，daysUntil 排序）；
3. **今日电影推荐**：hidden-gems 中 mediaType≠tv 的前 5（92px 海报 + 评分 + whyWatch(+En) + tags(+En)，标题链 `/?from=digest&r={id}` 直达详情）；
4. **今日剧集推荐**：mediaType=tv 的前 5（含 S/E，链接加 `&type=tv`）；
5. **音乐精选**：4 分类各 2 首；
6. **🧱 影视墙今日新增**（条件板块）：wall-delta 电影 + tvwall-delta 剧集各前 4，**仅当天有增量才渲染**。

所有外链带 `utm_source=digest&utm_medium=email&utm_campaign=daily`；海报一律 poster-proxy（w185）；Header 显示发送日期（数据非当日时附"数据截至 X"）。**Subject = 当日头条**：`🎬 {headline} · Kim's Video {date}`。digest 端点 DeepSeek 调用含 1 次重试。

### 6.8 影视墙构建（buildWall，流水线内）

- 每日从 movies.json（releasedToday/releasedThisWeek/upcoming/nowPlaying）+ coming.json（next7Days/next30Days 的电影）合并进累积墙；
- tmdbId 去重；已有条目若后到快照有中文标题则升级标题（保留 firstSeen）；`/wall/recs` 用户推荐并入（source:"rec"）；
- 产出 `wall.json`（含 count/updated）+ **`wall-delta.json`（当日新增，供邮件"影视墙今日新增"板块，此板块当前已从邮件移除但文件仍生成）**；
- 再经 `/intelligence/translate-overview` 批量补译英文简介（DeepSeek，每日限量批）。

---

## 7. 数据流水线（GitHub Actions）

**intelligence-daily.yml**（17:28 UTC）：checkout → 跑 `scripts/fetch-intelligence-data.js` → git 提交 public/api/ → push。

tasks 顺序（刻意设计）：**movies → tv → coming → weekly → hidden-gems → digest → overview**，随后 buildWall + wall 翻译 + 音乐 pipeline。overview 放最后是因为它复用 movies/tv 的 withCache 1h 缓存（全冷 ~55 子请求会超 50，命中缓存后 ~14）。hidden-gems 用 POST 传当日数据。非关键端点失败不阻断提交（failCount 全败才 exit 1）。

**deploy-worker.yml**：push workers-1.4.js/wrangler.toml 触发 → wrangler deploy → **重新 put 4 个 secret**（TMDB/RESEND/DIGEST + 无 DEEPSEEK/ADMIN——这两个必须手动 `wrangler secret put`）。concurrency group 防并发。

**deploy-frontend.yml**：push src/** 或 public/api/** 或 pipeline 完成后触发 → build（sitemap/discover/genre/detail 生成）→ Pages 部署。

**digest-backup.yml**（22:28 UTC）：curl 调 `/intelligence/send-digest`（Bearer DIGEST_SECRET），非 200 报警。

**send-test-digest.yml**：手动触发，单封测试邮件（默认 rexhr@yahoo.com）。

---

## 8. 邮件系统

- 订阅：情报页/订阅区表单 → POST subscribe → KV 存 `sub:{email}`（含 `locale`，取自用户当前界面语言）→ 立即回发该语言的确认邮件 + 当日 digest（个性化退订链接）。
- 发送（双语）：`/intelligence/send-digest` 遍历 `sub:` 前缀 key，逐个读 KV 取 locale 分组（**读取上限 35 个**——免费版 50 子请求预算保护，超限默认 zh），zh/en 两组分别批量经 Resend 发送；当日 KV 去重（digestStatus），缓存同时存 html + htmlEn + 双语 headline；digest HTML 按日期缓存 24h 保证同日一致。
- 测试：`send-test` 支持请求体 `"locale":"en"` 指定语言预览。
- 退订：邮件底部唯一链接 → Worker 渲染退订页（**页面语言跟随订阅记录 locale**）。
- 新订阅者欢迎邮件复用同一模板（当前发中文版）。

---

## 9. 社区精选（Discover）

数据结构（KV `result:{id}`）：`{ id, createdAt, contributorName(≤30字,默认匿名用户), sourceMovies(1-2部), recommendations(≤5部, 含 director/type/reason/matchedTags), genre, thumbnail, likes }`。创建时可自动把 sourceMovies+recommendations 全部写入 wallRec（ctx.waitUntil）。分类页按 genre 过滤、sort=newest|popular。

---

## 10. 部署与运维

**Secrets（Cloudflare，全部手动或 workflow）**：`TMDB_API_READ_ACCESS_TOKEN`、`RESEND_API_KEY`、`DIGEST_SECRET`、`DEEPSEEK_API_KEY`（手动）、`ADMIN_PASSWORD`（手动）、`LASTFM_API_KEY`（手动）。GitHub Secrets：上述 + `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。

**本地开发**：`npm run dev`（vite proxy 转发 /api 到 api.bloodyrex.xyz，*.json 直读本地）。**构建**：`npm run build`（prebuild 生成 sitemap，postbuild 生成类型页/详情页）。**验证套路**：`node --check workers-1.4.js && node --check scripts/fetch-intelligence-data.js && npx vite build && git checkout -- public/sitemap.xml package-lock.json && hermes verify --skip-start --json`（Windows 下 hermes verify 需 --skip-start，start 阶段会挂起）。

**修改后验证**：push → 等 Deploy Worker success → 手动跑 Intelligence Daily Pipeline → 检查各端点 OK + 无 500 → 用 send-test-digest 发测试邮件（默认 rexhr@yahoo.com）→ 提醒查垃圾/推广文件夹。

---

## 11. 未来规划

- **剧集墙**：当前 wall.json 只收录电影；规划增加按剧集（首播日期排序、S/E 追踪）的累积墙，复用 buildWall 的 delta/去重机制。
- 影视墙卡片复用首页 TMDB 详情视图（README 已标注）。

---

## 12. 经验教训（改代码前必读）

1. **Worker fetch handler 必须返回 Response**：POST 路由里 `return handler(...)` 若返回普通对象 → Cloudflare 直接 500 "Worker threw exception"（顶层 try/catch 也拦不住）。所有端点返回值要包 `Response.json()`。
2. **子请求预算**：任何新增端点/页数改动后，核算全冷子请求 <50（见 5.3）。
3. **DeepSeek 不稳定**：所有 AI 调用要有程序化兜底（digest topTrends、hidden-gems 评分兜底），并加 1 次重试。
4. **pipeline 读当日数据**：流水线内端点需要当天快照时用 POST body 传递，不要读 CDN 静态文件（还是昨日）。
5. **filterChineseContent 的坑**：只过滤带 title/name 且**有 summary/overview** 的内容数组；标签类数组（如 topTrends）必须显式跳过，否则永远为空。
6. **域名图片**：邮件/中国用户图片一律走 `poster-proxy`（TMDB 域名在 CN 网络不可达）。
7. **CNAME 域名**：Pages 用自定义域名 bloodyrex.xyz（CNAME 文件 + DNS），GitHub 仓库名与 Pages 默认域不同。
