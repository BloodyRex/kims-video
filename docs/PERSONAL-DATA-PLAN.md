# 个人数据管理系统 — 实施方案（KIMS VIDEO v1.4）

目标：零账号注册前提下，完整、安全、可迁移地保存并管理：搜索历史、AI 推荐结果、用户偏好；
并支持查看、导出、导入、备份、恢复、跨浏览器/跨设备迁移；PWA 可安装。

## 现状调查结论（Phase 1）
- 栈：React(Vite) 前端 → GitHub Pages(`bloodyrex.xyz`)；Cloudflare Worker(`api.bloodyrex.xyz`) 作 API；
  R2 bucket `kims-discover-thumbnails`(绑定 `DISCOVER_R2`)。
- 推荐结果目前仅存 `sessionStorage`（`kims_recos_${tmdbId}`），关页即失；无 IndexedDB、无服务工
  程器、无 PWA 安装（manifest 字段不全、无 icon、无 sw）。
- “搜索”= 客户端对静态 JSON 全文检索（Intelligence），AI 推荐引擎在 `useMovieEngine.js`。
- 保存点：`useMovieEngine.persist()`（写 session）；水合点：`App.jsx` 与 `NewHomePage.jsx` 的 `?from=`
  → `loadResultsFromCache(sourceId)`。
- 部署：`deploy-frontend.yml`(看 src/**、public/api/**)、`deploy-worker.yml`(看 workers-1.4.js)。
  改 `workers-1.4.js` 会触发 worker CI；改 `src/**` 会触发前端 CI。

## 数据模型（IndexedDB `kims-video-personal`）
- store `recos`(keyPath `id`)：`{ id, sourceId, primary, secondary, recommendations[], everShownTitles[],
  locale, modelTag, createdAt, updatedAt }`
- store `searches`(keyPath `id`)：`{ id, scope('ai_search'|'intelligence'), query, tmdbId?, at }`
- store `meta`(keyPath `key`)：`deviceId` / `prefs` / `lastExport` / `lastImport`
- 全部数据可由 `recos+searches+meta` 组成“完整个人数据包”。

## 模块
1. `src/services/personalStore.js` — 手写最小 IDB 封装 + 快照写入 + 按 sourceId 恢复 + 搜索历史
   + 导出/导入/合并 + AES-GCM/PBKDF2 加密 + 存储占用 + 设备指纹。
2. `src/services/migrationApi.js` — 调 worker `/migrate/create`、`/migrate/<code>`。
3. `src/components/MyDataPage.jsx` — `/my-data` 路由页（像素风）：概览 / 推荐记录(打开·删) / 搜索历史 /
   导出·加密备份 / 生成迁移码 / 导入(码或文件, 合并报告) / 清空(需输入确认)。
4. `useMovieEngine.js` — `persist()` 后写入 IDB 快照；`handleGenerateQuestions` 记录搜索历史。
5. `App.jsx` / `NewHomePage.jsx` — `?from=` 水合加 IDB 回退（restoreRecoForSource）；加 `/my-data` 路由
   + 页脚“我的数据”入口。
6. PWA：`public/icons/{192,512}.png`(脚本生成) + manifest 补全 + `public/sw.js`(极简 network-first，
   不缓存 API/数据) + `main.jsx` 注册。
7. `i18n.jsx` — `mydata.*` / `footer.mydata`（zh+en）。
8. `workers-1.4.js` — `/migrate/create`、`/migrate/<code>` + scheduled `purgeMigrate`（R2 `migrate/` 前缀，
   24h TTL，随机高熵码，非账号凭证）。

## 安全/风险
- 迁移码 = 一次性转移码（24h、随机），非账号；明文传输仅含用户自有数据。
- 导入只做合并(upsert)，不覆盖/删除本地独有记录；冲突时保留本地并计数提示。
- 破坏性操作(清空/删除)需显式确认。
- 提交=CI 自动部署到生产，属不可逆，需 Rex 确认后再 commit+push。
