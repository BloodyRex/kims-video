# Phase 2 完结报告 — Intel Worker (workers/intel.js)

## 完成时间
2026-11-20

## 实现方式（已与你确认）

**机械切片**：从 `workers-1.4.js` 按函数/常量名定位，逐字节提取，零改写。非 shared 模块重写。

## 交付产物

| 文件 | 行数/大小 | 说明 |
|------|-----------|------|
| `workers/intel.js` | 1764 行 / 95434 字节 | 自包含 intel worker，不依赖 shared/*.cjs |
| `extract_intel.cjs` | — | 切片工具：原文件变更后可重跑再生 |
| `verify_intel.cjs` | — | 独立复核：逐字节比对切片与原文 |

## 覆盖端点

| 方法 | 路径 | 处理函数 |
|------|------|----------|
| GET | `/intelligence/overview` | handleIntelOverview |
| GET | `/intelligence/movies` | handleIntelMovies |
| GET | `/intelligence/tv` | handleIntelTV |
| GET | `/intelligence/coming` | handleIntelComing |
| GET | `/intelligence/weekly` | handleIntelWeekly |
| GET | `/intelligence/hidden-gems` | handleIntelHiddenGems（GET 走 Legacy） |
| GET | `/intelligence/debug` | handleIntelDebug |
| GET | `/intelligence/trailer` | router 内联（逐字节复制） |
| POST | `/intelligence/hidden-gems` | handleIntelHiddenGems（pipeline-fed） |

## 排除（留给 Phase 3 及后续）

- `handleIntelDigest` + 全部邮件摘要渲染逻辑 → Phase 3（digest-worker）
- `handleIntelMusicV2` + 音乐管线（Last.fm / MusicBrainz range / DeepSeek 专辑策选等 10+ 函数）→ 后续 Phase
- `GENRE_ZH` / `intelGenreZH` / `INTEL_TAG_CATEGORY`（仅音乐管线使用）
- `handleSubscribe` / `handleUnsubscribe` / `sendDigestToAll` 等邮件发送 → Phase 3
- Discover/Wall/Admin/Migrate 区块 → Phase 1 / 未分配

## 验收结果 ✅

### 1. 语法
- [x] `node --check workers/intel.js` 通过
- [x] `node --check workers/discover.js` 通过（未受影响）
- [x] `node --check workers-1.4.js` 通过（原始文件完好）

### 2. 逐字节一致性（独立复核）
- [x] `verify_intel.cjs` 输出 `Verbatim-identical: 49/49; mismatches: 0`
- 49 = 43 个函数 + 6 个顶层常量

### 3. 无残留引用
- [x] 22 个被排除符号（音乐/digest/discover/genre 等）在 intel.js 中引用计数全部为 0

### 4. 回滚备份
- [x] `workers-1.4.js` git 状态为未修改
- [x] 切片/复核脚本保留，可随时再生或验证

## 与 shared/*.cjs 的关系（重要说明）

Phase 2 按「机械切片」方案，`workers/intel.js` **自包含**，未 import `src/shared/*.cjs`。
这意味着：
- `src/shared/` 四件套（Phase 0 产出）目前**只被 Phase 1 的 discover.js 引用**，且 discover.js 里也仍保留本地副本
- shared 与 intel 的去重（消除重复代码）延后到 Phase 4「清理与统一部署」统一处理

## 已知边界

1. `workers/intel.js` 尚未接入 `wrangler.toml`（`main` 仍指向 `workers-1.4.js`）——Phase 4 处理部署接线
2. 与 shared 模块的语义漂移（`withCache` 空占位等）属 Phase 0 遗留，Phase 4 统一决定去留

## 下一步

Phase 3：digest-worker（`/intelligence/subscribe`、`/intelligence/send-digest`、`/intelligence/unsubscribe`、`/intelligence/digest` 等邮件端点）。

---
**Phase 2 结论**：Intel Worker 已就绪，逐字节一致、语法通过、回滚清晰。未上线。
