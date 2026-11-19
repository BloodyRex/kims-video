# Phase 3 完结报告 — Digest Worker (workers/digest.js)

## 完成时间
2026-11-20

## 实现方式

机械切片：从 `workers-1.4.js` 按函数名定位 + 花括号配对，逐字节提取，零改写。与 Phase 2 同方案。

## 交付产物

| 文件 | 行数/大小 | 说明 |
|------|-----------|------|
| `workers/digest.js` | 1458 行 / 87814 字节 | 自包含 digest worker |
| `extract_digest.cjs` | — | 切片工具 |
| `verify_digest.cjs` | — | 独立复核（逐字节比对 + 敏感串完整性） |

## 覆盖端点

| 方法 | 路径 | 处理函数 |
|------|------|----------|
| GET | `/intelligence/digest` | handleIntelDigest |
| GET | `/intelligence/unsubscribe` | handleUnsubscribe |
| POST | `/intelligence/subscribe` | handleSubscribe |
| POST | `/intelligence/send-digest` | handleSendDigest → sendDigestToAll |
| POST | `/intelligence/send-test` | router 内联（逐字节复制） |
| POST | `/intelligence/unsubscribe` | handleUnsubscribe |
| cron | `scheduled` | sendDigestToAll（幂等 guard） |

## 提取的 19 个函数 + 1 内联块

函数：withCache、intelToday、intelDaysAgo、intelParseJSON、intelFetchTMDB、
handleIntelDigest、handleUnsubscribe、handleSubscribe、fetchDigestData、
buildWeeklyWorkIndex、weeklyLockedWorks、weekStartOf、renderDigestHtml、
digestShownKeys、pickTodayStar、buildDigestHTML、handleSendDigest、
withTimeout、sendDigestToAll

内联块：send-test 路由（原 4218-4248 行）

## 排除

- **迁移功能**（/migrate/create、/migrate/:token、migrateValidateBlob、migrateRandomToken、migratePurgeExpired）→ 未分配任何阶段。原 scheduled 里会调 migratePurgeExpired 清理过期迁移 blob，本 worker 已移除该调用，并在代码注释中标注。

## 验收结果 ✅

### 1. 语法
- [x] `node --check workers/digest.js` 通过
- [x] intel.js / discover.js / workers-1.4.js 均通过（互不影响）

### 2. 逐字节一致性（独立复核）
- [x] 命名函数 19/19 一致，0 差异
- [x] send-test 内联块逐字节一致

### 3. 敏感串完整性
- [x] `Bearer ${env.RESEND_API_KEY}` 完整
- [x] `Bearer ${env.DIGEST_SECRET}` 完整
- [x] `Bearer ${token}` 完整
（关键点：read_file 工具会把这类模板串脱敏成 `***`，但提取器用 fs 直读磁盘原始字节，故未受影响）

### 4. 无残留引用
- [x] 对 intel/music/discover/migrate 共 42 个符号的引用检查：仅 2 处命中，均为注释（非代码），实际干净

### 5. 回滚备份
- [x] `workers-1.4.js` git 状态为未修改

## 边界说明

1. 迁移功能（/migrate/*）在整个拆分方案中**尚未有归属阶段**——它是独立的「免账号数据迁移」特性，与邮件/发现/情报都无关。后续需要单独决定：新建第 4 个 worker，或保留在 monolith 里。
2. 三个拆分 worker（discover/intel/digest）均尚未接入 `wrangler.toml`（`main` 仍指向 workers-1.4.js）——Phase 4 处理。
3. shared/*.cjs 去重仍延后到 Phase 4。

## 下一步

Phase 4：清理与统一部署（删除/保留 monolith、wrangler.toml 接线、CI 部署脚本、shared 去重）。

---
**Phase 3 结论**：Digest Worker 已就绪，逐字节一致、语法通过、回滚清晰。未上线。
