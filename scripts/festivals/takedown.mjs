#!/usr/bin/env node
/**
 * Festival Calendar —— 公开产物下架（授权门禁对齐）工具
 *
 *   node scripts/festivals/takedown.mjs            # 默认 DRY-RUN：只报告将要发生的变化，绝不写盘
 *   node scripts/festivals/takedown.mjs --apply     # 真正执行（写盘 / 删除未授权残留）
 *
 * 设计原则（P1）：
 *   1. 单一真源 —— 目标公开产物一律由 publish.mjs 的 buildPublished() 重建，
 *      绝不手工编辑 public/api/**。buildPublished() 内置授权门禁（只 granted 放行），
 *      因此「下架 = 用同一真源把未授权内容重建成空」，与 run.mjs 的发布路径完全一致。
 *   2. 默认安全 —— 不带 --apply 时是纯只读 DRY-RUN：不 mkdir、不写、不删。
 *   3. 只读磁盘存储 —— 只读取 data/festivals/**（registry / editions / changes），
 *      绝不修改任何 store 或 data 文件；本工具只影响 public/api/**。
 *
 * 产物对齐规则（与 run.mjs 写盘块逐字节一致）：
 *   - public/api/festivals.json        ← published.summary
 *   - public/api/festival-changes.json ← published.changesFeed
 *   - public/api/festivals/<slug>.json ← 仅 publishable（granted）届次；其余一律属残留，需下架
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildPublished, registryOnlyStore, blockedEditions } from "./publish.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA_DIR = join(ROOT, "data", "festivals");
const EDITIONS_DIR = join(DATA_DIR, "editions");
const API_DIR = join(ROOT, "public", "api");
const API_FEST_DIR = join(API_DIR, "festivals");

const APPLY = process.argv.slice(2).some((a) => a === "--apply");
const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

const readJson = (p, fallback) => {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; }
};

/* ── 1. 与 run.mjs 完全一致地装载磁盘存储（只读） ── */
const registry = readJson(join(DATA_DIR, "registry.json"), { festivals: [] });
const changeLog = readJson(join(DATA_DIR, "changes.json"), { changes: [] });

const stores = [];
for (const festival of registry.festivals || []) {
  for (const edition of festival.editions || []) {
    const store = readJson(join(EDITIONS_DIR, `${edition.id}.json`), null);
    if (store) stores.push(store);
    else if (!festival.adapter) stores.push(registryOnlyStore(festival, edition, now));
  }
}

/* ── 2. 用唯一真源重建「目标公开产物」（内置授权门禁） ── */
const published = buildPublished({ stores, changes: changeLog.changes || [], now });
const blocked = blockedEditions(stores);
const publishableSlugs = new Set(Object.keys(published.details));

/* ── 3. 与当前 public/api 现状做只读 diff ── */
const toDelete = [];   // 未授权残留详情文件 → 下架
const toWriteDetail = []; // 已授权但缺失的详情文件 → 写入
if (existsSync(API_FEST_DIR)) {
  for (const f of readdirSync(API_FEST_DIR)) {
    if (!f.endsWith(".json")) continue;
    const slug = f.replace(/\.json$/, "");
    if (!publishableSlugs.has(slug)) toDelete.push({ file: `public/api/festivals/${f}`, slug });
  }
} else {
  mkdirSync(API_FEST_DIR, { recursive: true }); // 仅 --apply 时才会真正落盘
}
for (const slug of publishableSlugs) {
  if (!existsSync(join(API_FEST_DIR, `${slug}.json`))) toWriteDetail.push({ file: `public/api/festivals/${slug}.json`, slug });
}

// 索引 / 变更流：比较「卡片数 / 变更数」判断是否会发生变化
const curIndex = readJson(join(API_DIR, "festivals.json"), null);
const curChanges = readJson(join(API_DIR, "festival-changes.json"), null);
const curCardCount = Array.isArray(curIndex?.festivals) ? curIndex.festivals.length : null;
const curChangeCount = Array.isArray(curChanges?.changes) ? curChanges.changes.length : null;
const newCardCount = published.summary.festivals.length;
const newChangeCount = published.changesFeed.changes.length;

/* ── 4. 报告 ── */
const line = "─".repeat(72);
console.log(line);
console.log(`[takedown] ${APPLY ? "APPLY" : "DRY-RUN"}  ·  ${now}`);
console.log(line);
console.log(`磁盘届次存储: ${stores.length}  |  授权阻断: ${blocked.length}  |  可发布(granted): ${publishableSlugs.size}`);
if (blocked.length) {
  console.log(`  阻断清单: ${blocked.map((b) => `${b.slug}(${b.authorization ?? "missing"})`).join(", ")}`);
}
console.log("");
console.log(`目标索引 festivals.json      : 卡片 ${curCardCount ?? "(缺失)"} → ${newCardCount}`);
console.log(`目标变更流 festival-changes  : 变更 ${curChangeCount ?? "(缺失)"} → ${newChangeCount}`);
console.log("");
if (toDelete.length) {
  console.log(`将下架 ${toDelete.length} 个未授权详情文件:`);
  for (const d of toDelete) console.log(`  − ${d.file}`);
} else {
  console.log("无未授权详情文件残留。");
}
if (toWriteDetail.length) {
  console.log(`将写入 ${toWriteDetail.length} 个已授权详情文件:`);
  for (const d of toWriteDetail) console.log(`  + ${d.file}`);
}
console.log("");
console.log(`将覆盖: public/api/festivals.json（${curCardCount ?? "∅"} → ${newCardCount} 卡片）`);
console.log(`将覆盖: public/api/festival-changes.json（${curChangeCount ?? "∅"} → ${newChangeCount} 变更）`);

if (!APPLY) {
  console.log("");
  console.log(line);
  console.log("DRY-RUN —— 未改动任何文件。加 --apply 执行。");
  console.log(line);
  process.exit(0);
}

/* ── 5. 执行（仅 public/api/**） ── */
console.log("");
console.log(line);
console.log("APPLY —— 写入 public/api/** …");
for (const d of toDelete) { rmSync(join(ROOT, d.file), { force: true }); console.log(`  removed ${d.file}`); }
mkdirSync(API_FEST_DIR, { recursive: true });
for (const store of stores) {
  if (!publishableSlugs.has(store.slug)) continue;
  const detail = { ...store };
  delete detail.warnings;
  detail.films = (detail.films || []).map(({ idx, ...rest }) => rest);
  writeFileSync(join(API_FEST_DIR, `${store.slug}.json`), JSON.stringify(detail, null, 1) + "\n");
  console.log(`  wrote   public/api/festivals/${store.slug}.json`);
}
writeFileSync(join(API_DIR, "festivals.json"), JSON.stringify(published.summary, null, 1) + "\n");
writeFileSync(join(API_DIR, "festival-changes.json"), JSON.stringify(published.changesFeed, null, 1) + "\n");
console.log(`  wrote   public/api/festivals.json (${newCardCount} cards)`);
console.log(`  wrote   public/api/festival-changes.json (${newChangeCount} changes)`);
console.log(line);
console.log("[takedown] done — 运行 `node scripts/festivals/verify.mjs` 复核。");
