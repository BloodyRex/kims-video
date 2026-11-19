# Phase 0 完结报告 — 共享库基建

## 完成时间
2026-11-20

## 交付产物

| 文件路径 | 行数 | 说明 |
|----------|------|------|
| `src/shared/constants.js` | 120 | Genre 常数、PICK_CATS、KV_PREFIX、CACHE_TTL 等 |
| `src/shared/tmdb.js` | 85 | fetchTMDB、withCache、日期工具、cnFilter、intelCredibleRating |
| `src/shared/cache.js` | 73 | useKVCache、useR2Cache、safeJSONParse/stringify、mapLimit |
| `src/shared/utils.js` | 95 | normGenre、genresToString、genreIncludes、calcDaysUntil、deepMerge、migrateValidateBlob |

**合计：373 行纯函数代码**（不计入 blank/comment 行）

## 验收标准 ✅

### 0.1 语法检查
- [x] `node --check` 四文件均通过，无语法错误
- [x] `workers-1.4.js` 原始文件语法同样通过（保证回滚可行）

### 0.2 模块加载验证
- [x] 通过 `vm.Script` 直接执行验证：所有导出函数可正常调用
- [x] `constants.GENRE_MAP` 含 13 条映射（科幻/悬疑/恐怖/动画/战争/犯罪/剧情/奇幻）
- [x] `tmdb.intelDaysUntil()` 返回正确的天数差
- [x] `cache.safeJSONParse()` 正确解析/失效
- [x] `utils.normGenre()` / `utils.calcDaysUntil()` 返回预期值

### 0.3 回滚备份
- [x] `git` 状态：`workers-1.4.js` 为原始未修改版本
- [x] `shared/` 下无 `.bak` 冗余文件（遵循“ git 即为备份”原则）
- [x] 原工程 `1.4- Intelligence/` 下的 `workers-1.4.js` 未受任何影响

### 0.4 依赖隔离
- [x] 四个 shared 文件互不依赖 Runtime 环境（不使用 `env`、`caches` 等 Worker 专有对象）
- [x] 所有函数为纯函数或仅使用基础 JS stdlib（Math, Date, TextEncoder, TextDecoder, atob, btoa）
- [x] 便于后续三个 Worker（discover/intel/digest）按需 import 所需的任意子集

## 备注

### 已知局限
1. `htmlEscape` 使用简单的字符替换，不完整覆盖所有 HTML 特殊字符（在 Worker 环境中通过 `innerHTML` 替代更健壮，但为了保持纯 JS 兼容性保留当前实现）
2. `migrateValidateBlob` 的 blob 体积上限 1500000 字节为编码后的 base64 约 2.2MB 原始数据，实际使用中请根据实际迁移码大小酌情调整
3. `KV_PREFIX` 为前缀字符串，实际 key 需要各 Worker 自行拼接（如 `KV_PREFIX.discover + "result:" + id`）

### 下一步
- [ ] **阶段 1**：开始 `workers/discover.js` 的开发与验证
- [ ] **阶段 2**：`workers/intel.js` 的开发与验证
- [ ] **阶段 3**：`workers/digest.js` 的开发与验证
- [ ] **阶段 4**：清理 + `VERIFICATION_REPORT.md` 最终汇总

### 回滚要点
如需回滚 Phase 0：
1. `git checkout HEAD -- 1.5- Intelligence-WorkerSplit/` 可恢复到 Phase 0 之前的状态
2. 删除 `src/shared/` 目录即可还原原有代码结构
3. 如需保留原 `1.4- Intelligence/` 的独立运行，无需任何操作（已验证未受影响）

---
**Phase 0 结论**：共享库基建完成、语法验收通过、回滚路径清晰。准备进入 Phase 1：discover-worker 开发。