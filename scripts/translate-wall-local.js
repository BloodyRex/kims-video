#!/usr/bin/env node
/**
 * translate-wall-local — Local wall.json translation via Ollama
 * (frob/qwen3.5-instruct:4b), with DeepSeek fallback through the Worker's
 * /intelligence/translate-overview endpoint (which also fetches the EN
 * overview from TMDB for empty summaries).
 *
 * 用法:
 *   node scripts/translate-wall-local.js [--limit N] [--no-push]
 *
 * 行为:
 *   1. 读 public/api/wall.json, 找出 pending 条目 (summary 缺失或非中文)
 *   2. 每条: Ollama 本地翻译 (num_ctx 8192, 重试2次) → 失败走 DeepSeek 兜底
 *      - summary 为英文: Ollama 直接翻译
 *      - summary 为空: 走 DeepSeek 兜底 (端点负责从 TMDB 取英文原文再翻译)
 *      - Ollama 不在运行/翻译失败: 走 DeepSeek 兜底
 *   3. 写回 wall.json, 统计并 commit + push (可用 --no-push 跳过)
 *
 * 依赖: 本机 Ollama (qwen3.5:9b) 可选; 网络可达 https://api.bloodyrex.xyz 必须
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const API_DIR = join("public", "api");
const WALL_PATH = arg("--wall-path", join(API_DIR, "wall.json")) || join(API_DIR, "wall.json");
const WORKER_BASE = "https://api.bloodyrex.xyz";
const OLLAMA_BASE = "http://localhost:11434";
const MODEL = "frob/qwen3.5-instruct:4b";
const DEFAULT_LIMIT = 40;

const hasZh = (s) => /[\u4e00-\u9fff]/.test(s || "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1]) return fallback;
  return process.argv[i + 1];
}
const LIMIT = parseInt(arg("--limit", String(DEFAULT_LIMIT)), 10);
const NO_PUSH = process.argv.includes("--no-push");

// ── Ollama helpers ──
async function ollamaAvailable() {
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/tags`);
    return r.ok;
  } catch {
    return false;
  }
}

async function ollamaTranslate(text) {
  const prompt =
    "你是专业的影视简介翻译。将下面的英文影视简介翻译成简体中文。" +
    "要求：1) 准确、通顺、符合中文表达习惯；2) 片名、人名、地名等专有名词保留常用中文译名，没有通用译名的保留英文；" +
    "3) 只输出译文，不要任何解释或前后缀。\n\n英文原文：\n" + text;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(`${OLLAMA_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: prompt }],
          stream: false,
          options: { temperature: 0.3, num_ctx: 8192 },
        }),
      });
      if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
      const d = await r.json();
      const out = (d?.message?.content || "").trim();
      // 校验: 非空 + 含中文 + 长度合理 (原文 1/4 以上, 避免截断/空转)
      if (out && hasZh(out) && out.length >= Math.floor(text.length / 4)) return out;
      console.warn(`  Ollama 输出异常 (attempt ${attempt}): ${JSON.stringify(out?.slice(0, 40))}`);
    } catch (e) {
      console.warn(`  Ollama 调用失败 (attempt ${attempt}): ${e.message}`);
    }
    await sleep(2000 * attempt);
  }
  return null;
}

// ── DeepSeek fallback via Worker (also fetches EN overview for empty summaries) ──
async function deepseekFallback(tmdbId) {
  try {
    const r = await fetch(`${WORKER_BASE}/intelligence/translate-overview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    return d?.content || null; // { translated, hasOverview }
  } catch (e) {
    console.warn(`  DeepSeek 兜底失败 (tmdbId=${tmdbId}): ${e.message}`);
    return null;
  }
}

// ── EN source fetch via Worker mode="source" (ZERO DeepSeek tokens) ──
// 2026-08-21: Ollama 无法凭空取 TMDB 原文, 之前无 summary 的条目全部被迫走
// DeepSeek 兜底。现在 Worker 端点支持 mode="source" 只返回英文原文, 本地脚本
// 取到原文后喂给 Ollama —— Ollama 承担翻译大头, DeepSeek 仅兜底失败。
async function fetchSourceOverview(tmdbId) {
  try {
    const r = await fetch(`${WORKER_BASE}/intelligence/translate-overview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId, mode: "source" }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    const c = d?.content || null;
    return c?.overviewEn?.trim() ? { overviewEn: c.overviewEn.trim(), hasOverview: true } : { overviewEn: "", hasOverview: false };
  } catch (e) {
    console.warn(`  取原文失败 (tmdbId=${tmdbId}): ${e.message}`);
    return null;
  }
}

// ── Main ──
async function main() {
  if (!existsSync(WALL_PATH)) {
    console.error(`wall.json 不存在: ${WALL_PATH}`);
    process.exit(1);
  }
  const wall = JSON.parse(readFileSync(WALL_PATH, "utf8"));
  const movies = wall.movies || [];

  // pending: summary 缺失或非中文 (与 pipeline 的 !summary && !summarySkip 对齐, 并涵盖英文残留)
  const pending = movies
    .filter((m) => !m.summarySkip && (!m.summary || !hasZh(m.summary)))
    .sort((a, b) => String(b.firstSeen || "").localeCompare(String(a.firstSeen || "")));
  if (!pending.length) {
    console.log("translate-wall-local: nothing pending");
    return;
  }

  const batch = pending.slice(0, LIMIT);
  console.log(`translate-wall-local: ${pending.length} pending, 本次处理 ${batch.length} 条 (limit=${LIMIT})`);

  const ollamaOk = await ollamaAvailable();
  console.log(`Ollama (${MODEL}): ${ollamaOk ? "可用" : "不可用 → 全部走 DeepSeek 兜底"}`);

  let translatedLocal = 0;
  let fallbackDeepseek = 0;
  let noOverview = 0;
  let failed = 0;
  // 逐条写回 — 中途中断不丢已翻译进度 (2026-08-22: Ollama 40条需 1h+,
  // 统一写回遇超时/中断会全部丢失)
  const writeWall = () => {
    wall.updated = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
    wall.count = movies.length;
    writeFileSync(WALL_PATH, JSON.stringify(wall, null, 2), "utf8");
  };
  let dirty = false;

  for (const m of batch) {
    const label = m.title || m.titleEn || m.tmdbId;
    // 已有英文 summary → 直接本地翻译; 空 summary → 先取原文(零 token)再本地翻译;
    // Ollama 失败/不可用 → DeepSeek 兜底 (2026-08-21: 原文获取走 mode="source")
    let enText = m.summary?.trim() || "";
    let result = null;
    let skipNoOverview = false;

    // 1. 无原文时先取 (零 DeepSeek 消耗)
    if (!enText) {
      const src = await fetchSourceOverview(m.tmdbId);
      if (src === null) {
        failed++; // 取原文接口挂了 — 稍后重试
        console.log(`  [${translatedLocal + fallbackDeepseek + noOverview + failed}/${batch.length}] ${String(label).slice(0, 24)} → FAIL(取原文)`);
        continue;
      }
      if (!src.hasOverview) {
        skipNoOverview = true;
        noOverview++;
        console.log(`  [${translatedLocal + fallbackDeepseek + noOverview + failed}/${batch.length}] ${String(label).slice(0, 24)} → skip(无原文)`);
        continue;
      }
      enText = src.overviewEn;
    }

    // 2. Ollama 本地翻译 (有原文即可, 不再要求 summary 预存在)
    if (enText && ollamaOk) {
      const t = await ollamaTranslate(enText);
      if (t) {
        result = { translated: t, hasOverview: true };
        translatedLocal++;
      }
    }

    // 3. DeepSeek 兜底: 本地失败 / Ollama 不可用
    if (!result) {
      const fb = await deepseekFallback(m.tmdbId);
      if (fb) {
        if (fb.hasOverview && fb.translated) {
          result = { translated: fb.translated, hasOverview: true };
          fallbackDeepseek++;
        } else {
          skipNoOverview = true;
          noOverview++;
        }
      } else {
        failed++;
      }
    }

    if (result) {
      m.summary = result.translated;
    } else if (skipNoOverview) {
      m.summarySkip = true; // TMDB 无英文简介, 永久跳过
    }
    console.log(`  [${translatedLocal + fallbackDeepseek + noOverview + failed}/${batch.length}] ${String(label).slice(0, 24)} → ${result ? "ok" : skipNoOverview ? "skip(无原文)" : "FAIL"}`);
    // 逐条落盘 (2026-08-22): 中断/超时只丢当前条, 已完成的进度保留
    if (result || skipNoOverview) { writeWall(); dirty = true; }
    await sleep(500); // 温和限速, 避免打爆 Ollama/Worker
  }

  wall.updated = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  wall.count = movies.length;
  writeFileSync(WALL_PATH, JSON.stringify(wall, null, 2), "utf8");

  console.log(`\n完成: 本地翻译 ${translatedLocal} | DeepSeek 兜底 ${fallbackDeepseek} | 无原文跳过 ${noOverview} | 失败 ${failed}`);
  if (translatedLocal + fallbackDeepseek + noOverview > 0) {
    try {
      execSync("git add public/api/wall.json", { cwd: process.cwd() });
      execSync(
        `git commit -q -m "chore: wall translate (${translatedLocal} local, ${fallbackDeepseek} deepseek, ${noOverview} skip)"`,
        { cwd: process.cwd() }
      );
      console.log("已提交");
      if (!NO_PUSH) {
        execSync("git pull --no-rebase origin main", { cwd: process.cwd(), stdio: "pipe" });
        execSync("git push origin main", { cwd: process.cwd(), stdio: "pipe" });
        console.log("已推送");
      }
    } catch (e) {
      console.warn("git 提交/推送失败 (可手动处理):", e.message);
    }
  }
}

main().catch((e) => {
  console.error("translate-wall-local 异常:", e);
  process.exit(1);
});
