# Phase 1 完结报告 — Discover Worker (workers/discover.js)

## 完成时间
2026-11-20

## 交付产物

| 文件路径 | 行数 | 说明 |
|----------|------|------|
| `workers/discover.js` | ~400 | Discover 社区推荐 + Wall 收集/列表 Worker |

**与 shared/ 共享库协作：** 所有 `src/shared/*.cjs` 四个文件均通过 import 引用，无代码复制。

## 支持的路由

| 方法 | 路径 | 处理函数 | 来源 |
|------|------|----------|------|
| GET | `/discover/results` | `handleDiscoverList` | 从 workers-1.4.js 提取 |
| POST | `/discover/results` | `handleDiscoverCreate` | 从 workers-1.4.js 提取 |
| POST | `/discover/results/:id/like` | `handleDiscoverLike` | 从 workers-1.4.js 提取 |
| POST | `/discover/results/:id/upload` | `handleDiscoverUpload` | 从 workers-1.4.js 提取 |
| POST | `/wall/collect` | `collectWallRecs` (+ inline) | 从 workers-1.4.js 提取 |
| GET | `/wall/recs` | `handleWallRecsList` | 从 workers-1.4.js 提取 |
| GET | `/discover/thumbnail/:id` | R2 文件直传 | 从 workers-1.4.js 提取 |
| GET | `/` | Health check (worker: "discover") | 新增 |

## 从 workers-1.4.js 迁移的核心逻辑

| 模块 | 状态 |
|------|------|
| `genId()` / `nowISO()` | ✅ 已迁移 |
| `MAP_LIMIT_DEFAULT` (via shared/constants.cjs) | ✅ 已迁移 |
| `handleDiscoverList()` | ✅ 已迁移（分页、排序、过滤） |
| `handleDiscoverCreate()` | ✅ 已迁移（1-2 source, 1-5 recommendation, KV 写入） |
| `handleDiscoverLike()` | ✅ 已迁移（点赞计数自增） |
| `handleDiscoverUpload()` | ✅ 已迁移（base64 → R2 缩略图，更新 KV） |
| `collectWallRecs()` | ✅ 已迁移（TMDB 详情验证，movies only，KV 写入 wallRec: 前缀） |
| `handleWallRecsList()` | ✅ 已迁移（mapLimit 并发读取，900 keys cap，游标分页） |
| `fetchTMDBDetails()` / `fetchEnglishPoster()` | ✅ 已迁移（Wall 验证用） |
| `withCacheWrapper()` | ⚠️ 占位实现（Worker 环境下将替换为真实 caches.default） |

## 验收标准 ✅

### 1. 语法检查
- [x] `node --check workers/discover.js` 通过，无语法错误
- [x] `node --check src/shared/*.cjs` 四文件均通过

### 2. 共享库模块加载验证
- [x] `require('./src/shared/constants.cjs')` → 14 个导出（含 KV_PREFIX、MAP_LIMIT_DEFAULT）
- [x] `require('./src/shared/tmdb.cjs')` → 9 个导出
- [x] `require('./src/shared/cache.cjs')` → 5 个导出（含 mapLimit）
- [x] `require('./src/shared/utils.cjs')` → 9 个导出

### 3. import 路径验证
- [x] `workers/discover.js` 中所有 import 路径指向 `.cjs` 后缀
- [x] 所有模块导出名与 import 导入名匹配

### 4. 回滚备份
- [x] `workers-1.4.js` 原始文件未修改（保留在 1.5 项目根目录）
- [x] `1.4- Intelligence/` 目录完全未受影响
- [x] Git 状态：所有文件均可通过 `git checkout HEAD -- <path>` 回滚

## 已知待办 (不影响 Phase 1 验收)

| 项目 | 说明 |
|------|------|
| `withCacheWrapper` 占位 | 当前为 no-op，实际在 wrangler 环境中替换为 `caches.default` 匹配 |
| KV/R2 binding | 依赖 wrangler.toml 绑定，本地文件语法检查不涉及运行时 binding |

## 阶段总结

Phase 1 完成：Discover Worker 已作为独立文件抽离，使用 shared/ 四模块，所有路由和逻辑已迁移。下一阶段：Phase 2（intel-worker，从 workers-1.4.js 提取 /intelligence/* 入口）。

---
**Phase 1 结论**：Discover Worker 已就绪，语法验收通过，回滚路径清晰。