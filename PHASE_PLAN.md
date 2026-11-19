# Kims Video Worker Split — Phase Plan v1.5

## Overall Architecture

```
workers-1.4.js  (original monolithic Worker — 4361 lines)
       │
       ├───► workers/discover.js      (~800 lines — /discover, /wall/collect, /wall/recs)
       ├───► workers/intel.js         (~2200 lines — /intelligence/*, /wall/recs subsets)
       ├───► workers/digest.js        (~800 lines — /subscribe, /send-digest, /unsubscribe, /digest)
       └───► shared/                 (~500 lines — pure functions, constants, utils)
                ├── constants.js
                ├── tmdb.js
                ├── cache.js
                └── utils.js
```

---

## Phase 0: 基建 — 抽离 shared/ 纯函数库 ✅ 已完成

## Phase 1: discover-worker — 社区推荐与墙纸入口 ✅ 已完成

### 1.1 范围 ✅ 已交付
从 `workers-1.4.js` 中提取并独立为 `workers/discover.js`：
- ✅ `/discover/results` (handleDiscoverList, handleDiscoverCreate)
- ✅ `/discover/results/:id/like` (handleDiscoverLike)
- ✅ `/discover/results/upload` (handleDiscoverUpload)
- ✅ `/wall/collect` (collectWallRecs)
- ✅ `/wall/recs` (wall recs API)
- ✅ KV 交互：DISCOVER_KV (result:* 键)

### 1.2 新增文件 ✅ 已交付
- `workers/discover.js` (~400 lines)
- `shared/` 四件套（见 Phase 0）

### 1.3 验收 ✅ 通过
- [x] `node --check workers/discover.js` 通过
- [x] `node --check src/shared/*.cjs` 四文件均通过
- [x] 共享库模块加载验证通过 (require test)
- [x] `workers-1.4.js` 原始文件未修改

### 1.4 迁移功能并入（Phase 3 后追加，已确认）✅
- ✅ `/migrate/create` (POST) + `/migrate/:token` (GET) 机械并入 discover-worker
- ✅ 迁移辅助区（MIGRATE_* 常量 + migrateRandomToken + migrateValidateBlob + migratePurgeExpired）
- ✅ discover 新增 `scheduled` 处理器跑 migratePurgeExpired 清理
- 决策依据：迁移与 discover 共享 DISCOVER_R2/KV 绑定、代码仅 60 行、语义同属用户侧；独立 worker 不值得

### 1.5 重切片修复（Phase 4，已确认 B1）✅
- ✅ 修复 KV key 前缀 bug：Phase 1 手写版把 `result:` 错写成 `discover:result:`（根因是 shared/constants.cjs 的 `KV_PREFIX.discover` 为发明值），导致 discover 与 admin 数据互相读不到、旧数据丢失
- ✅ 改为机械切片自包含（与 intel/digest 一致），去掉 src/shared/*.cjs 依赖
- ✅ 验收：20/20 命名函数/常量 + 4 路由块逐字节一致，`discover:result:`=0，`prefix:"result:"`=1，shared 依赖=0

## Phase 2: intel-worker — 智力总览与电影/电视入口 ✅ 已完成

### 2.1 范围 ✅ 已交付
从 `workers-1.4.js` **机械切片**（逐字节提取，逻辑零改动）独立为 `workers/intel.js`：
- ✅ `/intelligence/overview` (handleIntelOverview)
- ✅ `/intelligence/movies` (handleIntelMovies)
- ✅ `/intelligence/tv` (handleIntelTV)
- ✅ `/intelligence/coming` (handleIntelComing)
- ✅ `/intelligence/weekly` (handleIntelWeekly)
- ✅ `/intelligence/hidden-gems` (handleIntelHiddenGems + curateFromIntelligence + Legacy)
- ✅ `/intelligence/debug` (handleIntelDebug)
- ✅ `/intelligence/trailer`（router 内联，逐字节复制）
- ✅ POST `/intelligence/hidden-gems`（pipeline-fed 路径）
- ❌ 排除：digest、音乐管线（handleIntelMusicV2 及全部 Last.fm/DeepSeek 音乐辅助函数）→ 留给 Phase 3

### 2.2 新增文件 ✅ 已交付
- `workers/intel.js`（1764 行，95434 字节）— 自包含，**不依赖 shared/*.cjs**（按你选择的机械切片方案）
- `extract_intel.cjs` — 切片工具（原文件变更后可重跑再生）
- `verify_intel.cjs` — 独立复核脚本（逐字节比对）

### 2.3 关键决策（已与你确认）
- **实现方式**：机械切片，非 shared 重写 → 零行为偏差；与 shared 去重延后到 Phase 4
- **端点范围**：计划 6 个 + weekly + trailer；digest/音乐留给 Phase 3
- **shared 模块语义漂移**（withCache 空占位等）在 Phase 0/1 已按「仅语法通过」验收，本次不受影响

### 2.4 验收 ✅ 通过
- [x] `node --check workers/intel.js` 通过
- [x] 49/49 个函数/常量逐字节与原文一致（verify_intel.cjs 独立复核）
- [x] 无对已排除符号（音乐/digest/discover/genre 等 22 个）的残留引用
- [x] `workers-1.4.js` 原始文件未修改（git 确认）
- [x] `workers/discover.js` 未受影响（339 行，语法通过）

### 2.5 扩展（Phase 4，已确认）✅
吸收通用 AI 代理 + ai-config + translate-overview + music/v2：
- ✅ 新增函数 6 个（searchTMDBList / fetchTMDBEnrichment / translateText / intelGenreZH / intelEnrichAlbums / handleIntelMusicV2）+ 常量 2 个（GENRE_ZH / INTEL_TAG_CATEGORY）
- ✅ 新增路由 4 组：GET `/intelligence/ai-config`、POST `/intelligence/translate-overview`、POST `/intelligence/music/v2`、通用 AI 代理（body.tmdbId/searchTitle/searchQuery/prompt）
- ✅ 验收：8/8 新增声明 + 3 路由块逐字节一致，Bearer 18 处完整，无未定义引用
- 结果：intel.js 1764 → 2203 行

## Phase 3: digest-worker — 邮件订阅与摘要发送 ✅ 已完成

### 3.1 范围 ✅ 已交付
从 `workers-1.4.js` **机械切片**（逐字节提取）独立为 `workers/digest.js`：
- ✅ GET `/intelligence/digest` (handleIntelDigest)
- ✅ GET/POST `/intelligence/unsubscribe` (handleUnsubscribe)
- ✅ POST `/intelligence/subscribe` (handleSubscribe)
- ✅ POST `/intelligence/send-digest` (handleSendDigest + sendDigestToAll)
- ✅ POST `/intelligence/send-test`（router 内联，逐字节复制）
- ✅ `scheduled` cron → sendDigestToAll（幂等 guard）
- ❌ 排除：迁移功能（/migrate/* + migratePurgeExpired 等）→ 未分配阶段，scheduled 中的 purge 调用已移除

### 3.2 新增文件 ✅ 已交付
- `workers/digest.js`（1458 行，87814 字节）— 自包含
- `extract_digest.cjs` — 切片工具
- `verify_digest.cjs` — 独立复核脚本

### 3.3 依赖闭包（外部 5 个函数）
withCache / intelToday / intelDaysAgo / intelParseJSON / intelFetchTMDB（handleIntelDigest 的 AI 摘要需 TMDB 趋势数据）

### 3.4 验收 ✅ 通过
- [x] `node --check workers/digest.js` 通过
- [x] 19/19 命名函数逐字节与原文一致
- [x] send-test 内联块逐字节一致
- [x] 敏感串完整（`Bearer ${env.RESEND_API_KEY}` / `DIGEST_SECRET` / TMDB token，直读磁盘未被 read_file 脱敏影响）
- [x] 无对 intel/music/discover/migrate 符号的代码级引用（2 处均为注释误报）
- [x] `workers-1.4.js` 原始文件未修改（git 确认）

## Phase 4: 清理与统一部署 (进行中)

### 4.1 决策（已与你确认）
- **A1 路由层**：保留薄 router worker，Service Bindings 按路径转发 5 个子 worker
- **admin → 第 4 个 worker**，**wallpaper → 第 5 个 worker**
- **B1 统一自包含**：discover.js 重切片去 shared 依赖（已修 KV 前缀 bug）
- **intel 吸收**：通用 AI 代理 + ai-config + translate-overview + music/v2

### 4.2 已完成的代码拼图 ✅
| # | 任务 | 状态 |
|---|------|------|
| 1 | 重切片 discover.js（修 `result:` 前缀 bug + 去 shared） | ✅ 317 行 |
| 2 | 扩展 intel.js（AI 代理 + 3 端点） | ✅ 2203 行 |
| 3 | 建 router.js（poster-proxy 内置 + 5 worker 分发） | ✅ 62 行 |
| — | admin.js | ✅ 178 行 |
| — | wall.js | ✅ 88 行 |
| — | digest.js | ✅ 1458 行 |

### 4.3 剩余任务（接线，已完成）✅
| # | 任务 |
|---|------|
| 4 | wrangler 接线：6 worker 配置 + [[services]] 绑定 + KV/R2/Secrets 分配 + Cron ✅ |
| 5 | CI 部署脚本 + 验证 + 部署上线 ✅ |

### 4.4 部署上线结果 ✅
- 6 worker 全部部署成功（router + discover/intel/digest/admin/wall）
- 线上端点实测通过：router health / discover results / intel ai-config / wall config / digest unsubscribe / admin 401
- KV 前缀修复已确认（discover 正常返回 `result:*` 数据）
- 部署踩坑记录：
  - wrangler 4 要求 Node ≥22 → CI 改 node-version: 24
  - 新 worker 首部署需 `workers_dev = false`（service-binding-only，跳过 workers.dev 子域名注册的最终一致性竞态）
  - git 凭证缺 workflow scope → 去掉 remote URL 内嵌 token，走 gh credential helper

### 4.5 遗留事项（需手动处理）
| 事项 | 说明 |
|------|------|
| admin ADMIN_PASSWORD / GITHUB_TOKEN | 非 GitHub secret，需在 Cloudflare 后台对 kims-video-admin 手动 `wrangler secret put`；未设置时 admin 登录返回"Admin not configured"（优雅降级）|
| wall ARK_API_KEY | 需手动设置；未设置时 /api/wall/gen 返回 501（与拆分前一致）|
| src/shared/ 目录 | 死代码（已全部自包含），未提交，可删除 |
| workers-1.4.js | 保留未改，作为回滚（重新部署即回退 monolith）|