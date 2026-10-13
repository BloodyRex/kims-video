#!/usr/bin/env node
/**
 * 电影节授权状态设置（P1 门禁真源同步）
 *
 *   node scripts/festivals/set-authorization.mjs --edition cannes-2026 --authorization testing
 *   node scripts/festivals/set-authorization.mjs --edition cannes-2026 --authorization pending --apply
 *
 * 为什么必须同步两处（这是 set-authorization.yml 按钮链路的历史缺口）：
 *   门禁判据的真源是「磁盘 editions 文件里的 festival.authorization」，registry 只是抓取阶段的输入：
 *     - run.mjs:280  publishable = stores.filter(s => authorizationAllows(s.festival?.authorization))
 *                  ↑ 读 data/festivals/editions/<id>.json
 *     - verify.mjs:97/104/118/129  读 editions/*.json 与 public/api 卡片
 *   只改 registry.json 时，门禁读到的是 editions 里的旧值 → 按钮点了却不放行；
 *   若把状态改成 pending，editions 与 public/api 仍是 testing，verify 反而判为
 *   「公开索引含未放行届次 / 旧公开文件残留」→ CI 变红。
 *
 * 设计原则：
 *   1. 单一入口 —— 后台按钮（set-authorization.yml）与本地维护共用同一实现。
 *   2. 外科替换 —— 这些文件是 CRLF + 不规则缩进，禁止 JSON.stringify 重写；
 *      只替换/插入 authorization 这一行，其余字节逐字节不变。
 *   3. 默认 DRY-RUN —— 不带 --apply 绝不写盘；写盘前用 JSON.parse 校验语法。
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REGISTRY_PATH = join(ROOT, "data", "festivals", "registry.json");
const EDITIONS_DIR = join(ROOT, "data", "festivals", "editions");

const VALID = ["granted", "testing", "pending"];

/* ── CLI ── */
const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
};
const editionId = argOf("edition");
const authorization = argOf("authorization");
const noteZh = argOf("note-zh");
const noteEn = argOf("note-en");
const APPLY = args.includes("--apply");

if (!editionId || !authorization) {
  console.error("usage: node set-authorization.mjs --edition <id> --authorization <granted|testing|pending> [--note-zh <text> --note-en <text>] [--apply]");
  process.exit(2);
}
if (!VALID.includes(authorization)) {
  console.error(`ERROR: invalid authorization '${authorization}' (expected ${VALID.join(" | ")})`);
  process.exit(2);
}
// authorizationNote 可选：zh/en 必须同时给出才写入；都不给则原样保留（避免误清空）；只给一个视为用法错误。
const hasZh = typeof noteZh === "string" && noteZh.trim() !== "";
const hasEn = typeof noteEn === "string" && noteEn.trim() !== "";
if (hasZh !== hasEn) {
  console.error("ERROR: --note-zh 与 --note-en 必须同时提供（authorizationNote 是 {zh,en} 对象）");
  process.exit(2);
}
const SET_NOTE = hasZh && hasEn;

/* ── 文本工具（保留 CRLF：split("\n") 后 "\r" 仍留在行尾，join 时原样还原）── */
const readLines = (p) => readFileSync(p, "utf8").split("\n");

/** 把 JSON 字符串字面量替换成空串，避免括号配对被字符串里的 { } 干扰 */
const maskStrings = (s) => s.replace(/"(?:[^"\\]|\\.)*"/g, '""');

const stripCr = (line) => line.replace(/\r$/, "");
/** 原行以 CR 结尾则补 CR（保持 CRLF 行尾） */
const lineCr = (line) => (line.endsWith("\r") ? "\r" : "");
/** 行尾风格：原行以逗号结尾则补 ",",再补 CR。用于替换后保持原有分隔符 */
const tailOf = (line) => (stripCr(line).trimEnd().endsWith(",") ? "," : "") + lineCr(line);
const indentOf = (line) => (/^\s*/.exec(line) || [""])[0];

/**
 * 在 registry.json 中定位「指定 festival」对象的行范围（用其 festival 级 "id" 行作锚点）。
 * 深度用「字符串掩码后」的行计算（避免字符串字面量里的 { } 干扰括号配对），
 * id 匹配用原始行（掩码会抹掉 id 字面量，两者不可混用）。
 */
function findFestivalSpan(lines, festivalId) {
  const masked = maskStrings(lines.join("\n")).split("\n");
  const braces = (l) => (l.split("{").length - 1) - (l.split("}").length - 1);
  const depthBefore = [];
  let d = 0;
  for (let i = 0; i < masked.length; i++) {
    depthBefore[i] = d;
    d += braces(masked[i]);
  }
  // festival 级 "id" 行：festivals 数组内（深度 2）
  const idRe = new RegExp(`^\\s*"id":\\s*"${festivalId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*,?\\s*$`);
  let idLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (depthBefore[i] === 2 && idRe.test(stripCr(lines[i]))) { idLine = i; break; }
  }
  if (idLine < 0) return null;
  // 向上找最近开启花括号的行 = festival 对象起点
  const festivalDepth = depthBefore[idLine];
  let start = -1;
  for (let j = idLine; j >= 0; j--) {
    if (depthBefore[j] === festivalDepth - 1 && masked[j].includes("{") && !masked[j].includes("}")) { start = j; break; }
  }
  if (start < 0) return null;
  // 向下走 running depth，回到 festivalDepth - 1 的那一行即闭合行（可正确处理同行内联对象）
  let d2 = festivalDepth;
  for (let k = start + 1; k < masked.length; k++) {
    d2 += braces(masked[k]);
    if (d2 <= festivalDepth - 1) return [start, k];
  }
  return null;
}

/** 外科替换 span 内的 authorization；无该键则在 officialUrl 行后插入。返回旧值（无键时返回 null） */
function setAuthorizationInSpan(lines, start, end, label) {
  for (let i = start; i <= end; i++) {
    const m = /^(\s*)"authorization":\s*"([^"]*)"\s*,?\s*$/.exec(stripCr(lines[i]));
    if (m) {
      const old = m[2];
      // 保留原行的行尾风格（逗号 + CR），不改变 JSON 分隔符
      lines[i] = `${m[1]}"authorization": "${authorization}"${tailOf(lines[i])}`;
      return old;
    }
  }
  for (let i = start; i <= end; i++) {
    if (/^\s*"officialUrl":\s*"(?:[^"\\]|\\.)*"\s*,?\s*$/.test(stripCr(lines[i]))) {
      const indent = indentOf(lines[i]);
      lines.splice(i + 1, 0, `${indent}"authorization": "${authorization}",${lineCr(lines[i])}`);
      return null;
    }
  }
  console.error(`ERROR: ${label} 的 festival 块既无 authorization 也无 officialUrl 字段`);
  process.exit(1);
}

/**
 * 外科设置 span 内的 authorizationNote（{zh,en} 嵌套对象）。
 *   已存在 → 只替换 zh/en 两个字符串字面量，保留缩进/行尾/块结构字节；
 *   不存在 → 在 authorization 行后插入整块（继承其缩进与行尾风格，逗号随相邻字段补）。
 * 返回 true 表示原本已存在该键。
 */
function setNoteInSpan(lines, start, end, zh, en, label) {
  const braces = (l) => (l.split("{").length - 1) - (l.split("}").length - 1);

  // 1) 定位已有的 authorizationNote 行
  let nLine = -1;
  for (let i = start; i <= end; i++) {
    if (/^\s*"authorizationNote":\s*\{\s*$/.test(stripCr(lines[i]))) { nLine = i; break; }
  }
  if (nLine >= 0) {
    // 找闭合行：从 nLine 起 running brace depth 归零（用掩码行，避免字符串里的 { } 干扰）
    const mask = maskStrings(lines.slice(nLine, end + 1).join("\n")).split("\n");
    let d = 0;
    let nEnd = end;
    for (let k = 0; k < mask.length; k++) { d += braces(mask[k]); if (d === 0) { nEnd = nLine + k; break; } }
    let gotZh = false;
    let gotEn = false;
    for (let i = nLine; i <= nEnd; i++) {
      const mz = /^(\s*)"zh":\s*"((?:[^"\\]|\\.)*)"(\s*,?)\s*$/.exec(stripCr(lines[i]));
      if (mz && !gotZh) { lines[i] = `${mz[1]}"zh": ${JSON.stringify(zh)}${mz[3]}${lineCr(lines[i])}`; gotZh = true; continue; }
      const me = /^(\s*)"en":\s*"((?:[^"\\]|\\.)*)"(\s*,?)\s*$/.exec(stripCr(lines[i]));
      if (me && !gotEn) { lines[i] = `${me[1]}"en": ${JSON.stringify(en)}${me[3]}${lineCr(lines[i])}`; gotEn = true; continue; }
    }
    if (!gotZh || !gotEn) {
      console.error(`ERROR: ${label} 的 authorizationNote 块缺少 zh/en 字段，拒绝改写`);
      process.exit(1);
    }
    return true;
  }

  // 2) 不存在 → 在 authorization 行后插入整块
  for (let i = start; i <= end; i++) {
    if (/^\s*"authorization":\s*"[^"]*"\s*,?\s*$/.test(stripCr(lines[i]))) {
      const indent = indentOf(lines[i]);
      const cr = lineCr(lines[i]);
      const hadComma = stripCr(lines[i]).trimEnd().endsWith(",");
      if (!hadComma) lines[i] = `${stripCr(lines[i])},${cr}`; // 原为末字段则补逗号
      lines.splice(
        i + 1,
        0,
        `${indent}"authorizationNote": {${cr}`,
        `${indent}  "zh": ${JSON.stringify(zh)},${cr}`,
        `${indent}  "en": ${JSON.stringify(en)}${cr}`,
        `${indent}}${hadComma ? "," : ""}${cr}`
      );
      return false;
    }
  }
  console.error(`ERROR: ${label} 的 festival 块无 authorization 行，无法插入 authorizationNote`);
  process.exit(1);
}

/* ── 0) 结构校验：确认 edition 确实在 registry 里（JSON 解析，权威）── */
const registryObj = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
const owner = (registryObj.festivals || []).find((f) =>
  (f.editions || []).some((e) => e.id === editionId)
);
if (!owner) {
  console.error(`ERROR: edition '${editionId}' 不在 data/festivals/registry.json 中`);
  process.exit(1);
}

/* ── 1) registry.json（festival 级）── */
const rawReg = readFileSync(REGISTRY_PATH, "utf8");
const regLines = rawReg.split("\n");
const span = findFestivalSpan(regLines, owner.id);
if (!span) {
  console.error(`ERROR: 未能在 ${REGISTRY_PATH} 文本中定位 festival '${owner.id}' 的块`);
  process.exit(1);
}
const oldRegistry = setAuthorizationInSpan(regLines, span[0], span[1], "registry.json");
let regNoteExisted = null;
if (SET_NOTE) {
  // authorization 插入可能新增一行 → 重新定位 span
  const span2 = findFestivalSpan(regLines, owner.id);
  regNoteExisted = setNoteInSpan(regLines, span2[0], span2[1], noteZh, noteEn, "registry.json");
}
const newReg = regLines.join("\n");
JSON.parse(newReg); // 写盘前语法校验

/* ── 2) editions/<id>.json（festival 级）── */
const edPath = join(EDITIONS_DIR, `${editionId}.json`);
let oldEdition = null;
let edNoteExisted = null;
let hasEdition = false;
const edLines = existsSync(edPath) ? readLines(edPath) : null;
if (edLines) {
  hasEdition = true;
  const rawEd = readFileSync(edPath, "utf8");
  const mask = maskStrings(rawEd).split("\n");
  const braces = (l) => (l.split("{").length - 1) - (l.split("}").length - 1);
  const db = [];
  let dd = 0;
  for (let i = 0; i < mask.length; i++) { db[i] = dd; dd += braces(mask[i]); }
  // 定位 "festival": { ... } 块。注意：键名必须用原始行匹配（maskStrings 会连键名一起抹掉），
  // 深度仍用掩码行算（字符串字面量里的 { } 会干扰括号配对）。
  let fStart = -1;
  for (let i = 0; i < edLines.length; i++) {
    if (/^\s*"festival":\s*\{\s*$/.test(stripCr(edLines[i]))) { fStart = i; break; }
  }
  if (fStart < 0) {
    console.error(`ERROR: 未能在 ${edPath} 中定位 "festival" 对象`);
    process.exit(1);
  }
  // festival 对象内部字段的深度 = "festival": { 所在行的 depthBefore + 1
  const targetDepth = db[fStart] + 1;
  let fEnd = -1;
  let d3 = targetDepth;
  for (let k = fStart + 1; k < mask.length; k++) {
    d3 += braces(mask[k]);
    if (d3 < targetDepth && mask[k].includes("}")) { fEnd = k; break; }
  }
  if (fEnd < 0) {
    console.error(`ERROR: 未能在 ${edPath} 中定位 "festival" 对象闭合`);
    process.exit(1);
  }
  oldEdition = setAuthorizationInSpan(edLines, fStart, fEnd, edPath);
  if (SET_NOTE) {
    // 重定位 festival 块（authorization 插入可能新增行）
    let fStart2 = -1;
    for (let i = 0; i < edLines.length; i++) {
      if (/^\s*"festival":\s*\{\s*$/.test(stripCr(edLines[i]))) { fStart2 = i; break; }
    }
    const mask2 = maskStrings(edLines.join("\n")).split("\n");
    const braces2 = (l) => (l.split("{").length - 1) - (l.split("}").length - 1);
    const db2 = [];
    let dd2 = 0;
    for (let i = 0; i < mask2.length; i++) { db2[i] = dd2; dd2 += braces2(mask2[i]); }
    const targetDepth2 = db2[fStart2] + 1;
    let fEnd2 = -1;
    let d4 = targetDepth2;
    for (let k = fStart2 + 1; k < mask2.length; k++) {
      d4 += braces2(mask2[k]);
      if (d4 < targetDepth2 && mask2[k].includes("}")) { fEnd2 = k; break; }
    }
    edNoteExisted = setNoteInSpan(edLines, fStart2, fEnd2, noteZh, noteEn, edPath);
  }
  JSON.parse(edLines.join("\n")); // 写盘前语法校验
}

/* ── 3) 报告 / 落盘 ── */
const changed = newReg !== rawReg || (hasEdition && edLines.join("\n") !== readFileSync(edPath, "utf8"));
console.log(`[set-authorization] ${editionId}: '${oldRegistry ?? "(missing)"}' -> '${authorization}' (registry.json)`);
if (hasEdition) {
  console.log(`[set-authorization] ${editionId}: '${oldEdition ?? "(missing)"}' -> '${authorization}' (editions/${editionId}.json)`);
} else {
  console.log(`[set-authorization] editions/${editionId}.json 不存在（无 adapter 届次）—— 仅 registry 生效`);
}
if (SET_NOTE) {
  const rn = regNoteExisted ? "已存在→仅改 zh/en" : "原缺失→已插入整块";
  console.log(`[set-authorization] authorizationNote (registry.json): ${rn}`);
  if (hasEdition) {
    const en = edNoteExisted ? "已存在→仅改 zh/en" : "原缺失→已插入整块";
    console.log(`[set-authorization] authorizationNote (editions/${editionId}.json): ${en}`);
  }
} else {
  console.log("[set-authorization] 未传 --note-zh/--note-en —— authorizationNote 保持原值不动");
}

if (!changed) {
  console.log("[set-authorization] 无变化（两处真源均已是对目标值）");
  process.exit(0);
}
if (!APPLY) {
  console.log("[set-authorization] DRY-RUN —— 未写盘。加 --apply 执行。");
  process.exit(0);
}

writeFileSync(REGISTRY_PATH, newReg, "utf8");
if (hasEdition) writeFileSync(edPath, edLines.join("\n"), "utf8");
console.log("[set-authorization] 已写入。运行 node scripts/festivals/verify.mjs 复核。");
