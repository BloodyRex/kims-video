# Kim's Video · 全球电影节排片日历（FESTIVAL CALENDAR）实施方案

> 状态：待 Rex 确认（2026-10-08）
> 依据：对 `E:\Desktop\kims_video\1.4- Intelligence`（HEAD `4b43ea8`，2026-10-02）的实测 + 20 个电影节官网连通性探测 + 11 个官方深层 programme/schedule 页解析探测

---

## 0. 结论摘要（先说判断）

1. **能做，而且是纯增量**：数据在 GitHub Actions 抓取 → 生成静态 JSON → 前端 `useJsonData` 读取 → Cloudflare Pages 部署。**不需要新数据库、不需要改 Worker 的抓取逻辑、不需要重构任何现有页面。**
2. **但"官方一手 screening 级数据"的真实成本被计划书低估了**：实测 11 个官方深层节目页，**只有 1 个**（正在举行的釜山 BIFF）在服务端 HTML 里直接给出"片名 + 时间 + 影厅"；其余要么只到"节目/日期"级，要么是 JS 应用/票务平台（IDFA、Berlinale、Viennale、Sundance…），需要逐站逆向其内部 JSON/票务 API。
3. **"Phase 1 = 约 50 个电影节"在当前维护能力下不现实**：每个电影节 = 一个专用适配器（首版 3–6 小时 + 官网改版后持续维护），并且本机直连多数官网失败（被墙），开发期验证必须借 CI。
4. 提议的把控方式：**先拿 1 个电影节把「官方抓取 → 标准化 → 校验 → 变更检测 → 发布 → UI」整条链路跑通（P0），再按优先级扩站（P1：8–12 站）**，把"电影节数量"当成注册表里持续追加的行，而不是一次性目标。这与计划书自己的"不要为了数量牺牲数据准确性"一致。

---

## 1. 项目现状（实测，非猜测）

| 项 | 实测结果 |
|---|---|
| 仓库 | `https://github.com/BloodyRex/kims-video.git`，分支 `main`，HEAD `4b43ea8`（2026-10-02 15:26 UTC），工作树 = `1.4- Intelligence/`，当前工作树干净 |
| ⚠️ 陷阱 | 根目录 `E:\Desktop\kims_video\.git` 是**空目录**，在根目录执行任何 git 命令都会 `fatal: not a git repository`；所有 git 操作必须在 `1.4- Intelligence/` 里执行 |
| 前端 | React 18.3.1 + react-router-dom 7.18.1 + Vite 6.3.2 + Tailwind v4.1.4，**纯 JS（无 TypeScript）**，无状态管理库 |
| npm 脚本 | `prebuild`(generate-sitemap) / `dev` / `build`(vite build) / `postbuild`(generate-discover-page + generate-genre-pages + generate-detail-pages) / `preview` —— **没有 lint、没有 typecheck、没有 test** |
| 数据通路 | `scripts/*.js` 在 GitHub Actions 运行 → 写 `public/api/*.json` → commit `chore: daily intelligence data update [data]` → push → `deploy-frontend.yml` 部署 Pages |
| 定时任务 | `.github/workflows/intelligence-daily.yml` cron `28 17 * * *`（≈北京 01:28）；`digest-backup.yml` cron `28 22 * * *` |
| 前端取数 | 静态 JSON：`useJsonData("/api/overview.json")`、`/api/digest.json`、`/api/tv.json` …（页面**不直接吃 Worker**） |
| Worker | `workers-1.4.js`（3,636 行）：AI 代理 / poster-proxy / Discover API / Admin API / digest 发送；路由分发从第 3368 行 `const path = url.pathname` 开始 |
| 存储 | KV（`DISCOVER_KV`、`SUBSCRIBE_KV`）+ R2（`kims-discover-thumbnails`）+ `caches.default`；**没有 D1 / 关系数据库** |
| 视觉规范 | 黑底；荧光黄 `#ffff00`、品红 `#ff00ff`、青 `#00ffff`；`border-4 border-black`、`shadow-[6px_6px_0_0_rgba(0,0,0,1)]`、`pixel-font`；header `border-b-8 border-[#ff00ff] shadow-[0_8px_0_0_rgba(0,255,255,1)]`；pill 型 tab（active = `bg-black text-white`） |
| 可复用件 | `SectionHeader`、`LoadingSpinner`、`DataError`（Loading/Empty/Error 三态已有）、`WallStyleCard` 网格、`DetailOverlay`、`useJsonData`；`/intelligence/:sub` 的子路由 + tab 模式 |
| 首页入口 | `src/components/NewHomePage.jsx:311–339` 现有三个入口按钮（`/discover`、`/intelligence`、`/wall`） |
| 现有 festival 代码 | 全库 grep `festival` —— **无任何结果**（真·零起点） |

---

## 2. 官方数据可行性实测（本方案的关键依据）

**连通性**：本机探测 20 个官网，直连大量失败（Cannes / TIFF / Annecy / Sitges 等 TLS 阻断或 connection reset），经本机代理 18/20 可访问 → **本机不是抓取环境，海外 CI runner 才是**。

**11 个官方深层 programme / schedule 页解析结果**（统计服务端 HTML 中的时间模式 / 日期模式 / 影厅关键词）：

| 站点 | HTTP | 体积 | 时间× | 日期× | 影厅× | 能达到的数据级别 |
|---|---|---|---|---|---|---|
| BIFF 釜山（10/06–10/15，**正在举行**） | 200 | 63–75KB | 4–8 | 4 | 114–128 | ✅ **screening 级**（片名 + 时间 + 影厅） |
| DOK Leipzig | 200 | 88KB | 2 | 23 | 9 | 节目 / 日期级 |
| HKIFF 香港 | 200 | 102KB | 0 | 29 | 19 | 日期 / 节目级（场次进逐片详情页） |
| Sitges | 200 | 168KB | **0** | 5 | 12 | 节目级（场次客户端渲染） |
| IFFR 2026 | 200 | 77KB | 0 | 4 | 0 | 影片目录级 |
| Berlinale | 200 | 185KB | 1 | 1 | 1 | JS 壳，需逆向 |
| Viennale | **404** | — | — | — | — | 路径需重新定位 |
| IDFA（Next.js） | **404** | — | — | — | — | 需定位其内部 JSON API |

**由此定下两条硬约束**：
- 适配器必须**可降级**：解析失败 → 保留上一次有效数据 + 标记 `lastVerified` 陈旧 + UI 显示 `SCHEDULE_PENDING` / 陈旧提示；**绝不用 AI 猜事实**。
- 首版不以"电影节数量"为 KPI，而以"链路可靠 + 每站可验证"为标准。

---

## 3. 目标架构（增量，复用现有基建）

**数据流**（严格按计划书第八节）：
`Official Source → Fetch/Parse → Normalize → Validate → Store → Change Detection → AI Enrichment → Publish`

### 3.1 新增文件（全部新增，不改现有脚本逻辑）

```
data/festivals/
  registry.json                 # Festival + Edition + 官方 Source 清单 + 抓取策略 + 状态
  state.json                    # 每站 lastFetched / lastChanged / lastVerified / 失败计数
  screenings/<slug>.json        # 标准化场次数据（发布源）
  snapshots/<slug>.json         # 上一次快照（diff 用）
  changes.json                  # 变更历史（只追加，永不覆盖）
scripts/festivals/
  fetch.mjs                     # 编排：按 registry 状态决定本次抓哪些站
  adapters/<slug>.mjs           # 每站一个解析器（首版：biff.mjs）
  normalize.mjs                 # 统一片名/日期/时间/时区/影厅/单元字段
  validate.mjs                  # schema + 关键字段非空 + 日期格式 + 来源必须存在
  diff.mjs                      # Change Detection（时间/日期/影厅/取消/新增/单元调整）
  enrich.mjs                    # AI：翻译片名 + 一句话简介（绝不写日期/时间/影厅/取消）
public/api/
  festivals.json                # 首页用：列表 + 今日统计 + 状态
  festival-changes.json         # 变更流
  festivals/<slug>.json         # 详情 + 完整排片（按需加载）
.github/workflows/
  festival-daily.yml            # 30 分钟轮询 + 站点级节流
```

### 3.2 数据模型（字段级）

- `Festival{ id, slug, name{zh,en}, city, country, region, types[], officialUrl, sources[], editions[] }`
- `Edition{ id, festivalId, year, editionLabel, startDate, endDate, timezone, status, programmeUrl, scheduleUrl }`
- `Programme/Section{ id, editionId, name, kind(COMPETITION/…), url }`
- `Film{ id, title, originalTitle, year, runtime, countries[], premiereStatus, genres[], sections[], officialUrl }`
- `Screening{ id, filmId, editionId, date(YYYY-MM-DD), localTime(HH:MM), timezone, venueId, venueName, section, access(PUBLIC/TICKET/ACCREDITED/PRESS/INDUSTRY/INVITATION), ticketStatus, qaGuest|null, officialSourceUrl, lastVerifiedAt }`
- `Venue{ id, name, url|null }`
- `Source{ id, kind(SCHEDULE/PROGRAMME/OFFICIAL_SITE/PDF/PRESS/TICKETING/AUTHORITY), url, fetchedAt, httpStatus, parser }`
- `Change{ id, entity, entityRef, field, oldValue, newValue, changedAt, officialSourceUrl, severity }`

**状态枚举**：`CONFIRMED / SCREENING_LIVE / PROGRAM_RELEASED / SCHEDULE_LIVE / SCHEDULE_PENDING / CHANGED / CANCELLED / TBC`
→ "尚未公布排片" = `SCHEDULE_PENDING`，**显式展示，绝不留空**。

### 3.3 调度（复用现有机制，不造轮子）

- 单个 workflow `festival-daily.yml`，`cron: "*/30 * * * *"`；脚本按**每站状态**决定本次是否真的抓：
  `>30 天 → 24h` ｜ `≤30 天 → 6h` ｜ `正在举行 → 30–60 分钟` ｜ `检测到节目/排片发布 → 立即`
- **只在有变化时 commit**（无变化 → 不推送 → 不触发 Pages 重新部署），沿用现有 `[data]` 提交风格。
- 抓取与解析全部在 CI 完成；**Worker 不承担抓取**（CF 子请求数 / CPU 限制，且无 HTML 解析环境）。
- 官方 PDF/HTML 证据快照 → P2 再考虑进 R2，repo 只存解析后的 JSON。

### 3.4 前端（复用现有视觉与组件，不新建视觉体系）

- 路由：`/festivals`（TODAY）、`/festivals/week`、`/festivals/month`、`/festivals/changes`、`/festivals/:slug`；沿用 `/intelligence/:sub` 的子路由 + pill tab 写法。
- 首屏 TODAY：`TODAY · 08 OCT 2026` + `N FESTIVALS / N SCREENINGS / N UPCOMING / N CHANGES` + 正在举行的 Festival Card（今日场次、状态徽章、`[ FULL SCHEDULE ]`、`[ OFFICIAL SOURCE ↗ ]`、`Last verified: 14 min ago`）。
- MONTH 只展现电影节档期（不塞片名），具体影片进详情页。
- 变更卡：`⚠ SCHEDULE CHANGED  19:30 → 20:00  Hall 3 → Hall 5  OFFICIAL SOURCE ↗  Updated 14 min ago`。
- 三态复用 `LoadingSpinner` / `DataError` / 空态组件；大数据量：今日场次分组折叠，详情页按需拉 `/api/festivals/<slug>.json`。
- 首页第 4 个入口按钮 + 顶部/底部导航项；`i18n.jsx` 追加 zh/en 文案（不改现有 key）。

### 3.5 与 Intelligence / Daily Digest 集成（P2，默认不做）

`digest.json` 增 `festivals` 段（TODAY'S FESTIVALS / NEW PROGRAMMES / SCHEDULE CHANGES / CANCELLATIONS），Intelligence 页加 `FESTIVAL INTELLIGENCE` 区块，订阅邮件读**同一份数据** —— 不建第二套电影节库。

---

## 4. 分期与验收映射

| 阶段 | 内容 | 预估 |
|---|---|---|
| **P0** | registry + 1 个适配器（BIFF，正在举行，已实测可抓 screening 级）+ normalize/validate/diff + `public/api/festivals.json` + `/festivals` 页面（TODAY/WEEK/MONTH + 状态 + 来源 + last verified）+ 首页第 4 入口 + `npm run build` 通过 | 1–2 天 |
| **P1** | 适配器扩到 8–12 站（HKIFF / DOK / Sitges / Viennale / IDFA / Berlinale / IFFR / Sundance…），FESTIVALS 列表页 + 详情排片 + CHANGES + 筛选（时间/地区/类型/Access）+ 30 分钟 workflow + 降级策略实测 | 3–5 天 |
| **P2** | 规模扩到 100–150、Admin 内 Registry 维护面板、R2 证据快照、Digest 集成 | 按批推进 |

**验收对照（计划书第二十二节）**：数据/产品/自动化/UI 四类均有明确落点；工程类中"运行现有 lint / typecheck / test"实际只能落到 **`npm run build` + 校验脚本断言 + 浏览器手测**（项目无 lint/typecheck/test 脚本）；"Phase 1 约 50 个电影节"改为注册表分批扩站（见第 0 节第 3–4 点）。

---

## 5. 风险与与计划书冲突之处（需确认）

1. **50 站 vs 现实**：建议 P1 先 8–12 站，之后每批追加；坚持"不为数量牺牲准确性"。
2. **30–60 分钟高频**：受 GitHub Actions 额度与官网访问礼仪限制 → 建议 30 分钟轮询 + 站点级节流（只有"正在举行"的站才高频），且无变化不 commit、不部署。
3. **本机直连被墙**：开发期验证必须借 CI 跑真实抓取（沿用上次"临时 workflow 借 secrets 跑真实数据"的做法）。
4. **官网改版**：单站降级（保留旧数据 + 标陈旧 + 页面明示），不用 AI 补事实。
5. **无测试框架**：新增校验脚本自带断言（schema / 必填 / 日期格式 / 来源必须存在），并以 `npm run build` 作为回归门。
6. **存储**：不引入新数据库；KV/R2 仅在"证据快照 / 管理面板"时复用。

---

## 6. 待 Rex 决策

1. 范围与节奏：先做 P0 垂直切片（1 站跑通全链路，1–2 天）还是直接铺 P1（8–12 站，3–6 天）？
2. 交付方式：改完直接 commit + push 走 CI 自动部署（沿用你的习惯），还是先本地/分支验证？
3. 本期是否包含 Daily Digest / Intelligence 集成（计划书第十八节）？
4. 官方 PDF/证据快照是否要进 R2（需 bucket 权限），还是先只存"解析后 JSON + 官方源 URL"？
