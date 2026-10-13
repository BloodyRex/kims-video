#!/usr/bin/env node
/**
 * collect-festival-alerts.mjs — 电影节排片「抓取失败 / 来源变更」告警收集器。
 *
 * 为什么需要它：
 *   festival-daily.yml 每 30 分钟跑一次 run.mjs，但 run.mjs 只在「有数据变化」时才
 *   commit/push。某届连续抓取失败时数据不变 → 不 commit → 没有任何外部信号，失败会
 *   一直静默。本脚本把「失败」从既有产物里读出来，变成一条明确的告警。
 *
 * 读什么（全部来自既有产物，不新增任何被 git 跟踪的文件）：
 *   data/festivals/last-run.json    —— 最近一次 run 的 report
 *      editions[]: { slug, parsed:{films,screenings,sourcesOk,sourcesTotal}, action, error?, errors? }
 *      errors[]:   字符串 "slug: msg"（fetch 抛错 / 校验拒绝）
 *   data/festivals/state.json       —— 每届 { lastFetchedAt, lastError, failCount, counts:{screenings} }
 *   data/festivals/registry.json   —— 届次 { id, name } + festival 级 authorization
 *   data/festivals/editions/*.json —— stats / sources[] / warnings / status
 *
 * 判定口径（failCount 阈值与 set-authorization.mjs 的「反复失败」一致：>=3）：
 *   1. fetch-failure   —— last-run 该届 error/errors 命中，或 state.lastError 非空，或 failCount>=3
 *   2. source-degraded —— 某来源 ok=false，或来源成功率 < 0.5
 *   3. source-changed  —— 本次实抓 sourcesTotal 与已存 doc 的来源数不一致（来源变了但没落库）
 *   4. data-regression —— 实抓 screenings 比上次成功时变少（官方撤了排片）
 *
 * 输出：
 *   --format json   机器可读（默认），供 workflow 决定是否开 issue
 *   --format text   人读摘要，供 workflow 打印到 run log
 *   --check         自检：内置样例验证判定逻辑，不碰真实数据
 *   --no-state      不读写告警去重状态（调试用）
 *
 * 退出码：0=无告警；1=有告警；2=自检失败；3=数据文件缺失/损坏。
 *
 * 幂等：默认写 data/festivals/.alert-state.json（点开头，未被 git 跟踪），记录已告警的
 *       (届次, 类型, 指纹)。同一问题只在状态变化时重复告警。
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, "..", "..", "data", "festivals");
const EDITIONS_DIR = join(DATA_DIR, "editions");
const SNAPS_DIR = join(DATA_DIR, "snapshots");
const STATE_FILE = join(DATA_DIR, "state.json");
const LAST_RUN_FILE = join(DATA_DIR, "last-run.json");
const REGISTRY_FILE = join(DATA_DIR, "registry.json");
const ALERT_STATE_FILE = join(DATA_DIR, ".alert-state.json");

// 与 set-authorization.mjs 的「反复失败」阈值一致：连续 3 次才算。
const FAIL_COUNT_THRESHOLD = 3;
// 来源成功率低于此值视为异常（官方站改版 / 反爬时常见）。
const SOURCE_SUCCESS_FLOOR = 0.5;

function readJsonSafe(path, fallback = null) {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function readEditionIds(registry) {
  const ids = [];
  for (const f of registry?.festivals || []) {
    for (const e of f.editions || []) {
      if (e?.id) ids.push({ id: e.id, name: e.name || e.id, authorization: f.authorization || e.authorization || "pending" });
    }
  }
  return ids;
}

/** 实抓（last-run）里每届的解析结果与错误。 */
function indexLastRun(lastRun) {
  const byEdition = new Map();
  for (const ed of lastRun?.editions || []) {
    if (!ed?.slug) continue;
    const rec = byEdition.get(ed.slug) || { slug: ed.slug, error: null, errors: [], parsed: null };
    if (ed.error) rec.error = String(ed.error);
    for (const e of ed.errors || []) rec.errors.push(String(e));
    if (ed.parsed && typeof ed.parsed === "object") rec.parsed = ed.parsed;
    byEdition.set(ed.slug, rec);
  }
  // report.errors 是字符串 "slug: msg"；能对上届次的并入该届，对不上的当全局。
  const globalErrors = [];
  for (const raw of lastRun?.errors || []) {
    const s = String(raw);
    const m = s.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m && byEdition.has(m[1])) {
      byEdition.get(m[1]).errors.push(m[2]);
    } else {
      globalErrors.push(s);
    }
  }
  return { byEdition, globalErrors };
}

/** state.json 里每届最近一次成功/失败的结果。 */
function indexState(state) {
  const byEdition = new Map();
  for (const [slug, s] of Object.entries(state?.editions || {})) {
    byEdition.set(slug, {
      lastFetchedAt: s?.lastFetchedAt || null,
      lastError: s?.lastError || null,
      failCount: typeof s?.failCount === "number" ? s.failCount : 0,
      lastScreenings: s?.counts?.screenings ?? null,
    });
  }
  return byEdition;
}

function readEditionDoc(slug) {
  return readJsonSafe(join(EDITIONS_DIR, `${slug}.json`), null);
}

/** 来源成功率：ok 的来源数 / 总来源数。无来源返回 null（不臆断）。 */
function sourceSuccessRate(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  const ok = sources.filter((s) => s?.ok).length;
  return ok / sources.length;
}

function fingerprint(slug, kind, detail) {
  return `${slug}|${kind}|${detail}`;
}

function mkAlert(slug, name, kind, severity, message, detail, fp) {
  return { editionId: slug, editionName: name, kind, severity, message, detail, fingerprint: fingerprint(slug, kind, fp) };
}

/**
 * 核心判定。返回告警数组：
 *   { editionId, editionName, kind, severity, message, detail, fingerprint }
 */
function collectAlerts({ registry, lastRun, state }) {
  const alerts = [];
  const editions = readEditionIds(registry);
  const { byEdition: runIndex, globalErrors } = indexLastRun(lastRun);
  const stateIndex = indexState(state);

  for (const ed of editions) {
    const run = runIndex.get(ed.id) || { error: null, errors: [], parsed: null };
    const st = stateIndex.get(ed.id) || {};
    const doc = readEditionDoc(ed.id);

    // ---- 1. 抓取失败 ----
    const failCount = st.failCount || 0;
    const lastError = run.error || run.errors[0] || st.lastError || null;
    const failed = run.error || run.errors.length > 0 || st.lastError || failCount >= FAIL_COUNT_THRESHOLD;
    if (failed) {
      alerts.push(mkAlert(
        ed.id, ed.name, "fetch-failure",
        failCount >= FAIL_COUNT_THRESHOLD ? "high" : "medium",
        `「${ed.name}」抓取失败${failCount >= FAIL_COUNT_THRESHOLD ? "（反复失败）" : ""}`,
        `failCount=${failCount}${lastError ? `; lastError=${lastError}` : ""}`,
        `${failCount}|${lastError || ""}`,
      ));
    }

    // ---- 2. 来源不可用 / 成功率过低 ----
    const docSources = doc?.sources || [];
    const rate = sourceSuccessRate(docSources);
    const broken = docSources.filter((s) => s && s.ok === false);
    if (broken.length > 0 || (rate !== null && rate < SOURCE_SUCCESS_FLOOR)) {
      const names = broken.map((s) => s?.name || s?.url || "unknown").join(", ");
      alerts.push(mkAlert(
        ed.id, ed.name, "source-degraded", "high",
        `「${ed.name}」官方来源不可用或成功率过低`,
        `successRate=${rate === null ? "n/a" : rate.toFixed(2)}; broken=[${names}]`,
        `${rate === null ? "n/a" : rate.toFixed(2)}|${names}`,
      ));
    }

    // ---- 3. 来源变更：实抓来源数与已存 doc 不一致（来源变了但没落库）----
    if (run.parsed && Array.isArray(docSources) && docSources.length > 0) {
      const liveTotal = run.parsed.sourcesTotal;
      const storedTotal = docSources.length;
      if (typeof liveTotal === "number" && liveTotal !== storedTotal) {
        alerts.push(mkAlert(
          ed.id, ed.name, "source-changed", "medium",
          `「${ed.name}」官方来源数量变更（已落库数据未同步）`,
          `live sourcesTotal=${liveTotal}; stored doc sources=${storedTotal}`,
          `${storedTotal}->${liveTotal}`,
        ));
      }
    }

    // ---- 4. 数据回退：实抓 screenings 比上次快照变少（官方撤了排片）----
    // 基线用 snapshots/{slug}.json（run.mjs 在覆盖 store 前写入的上一版），
    // 不用 state.counts——后者在同一次运行里已被覆盖，与 live 永远相等。
    const snapDoc = readJsonSafe(join(SNAPS_DIR, `${ed.id}.json`), null);
    const snapScreenings = snapDoc?.stats?.screenings;
    if (run.parsed && typeof snapScreenings === "number") {
      const live = run.parsed.screenings;
      if (typeof live === "number" && live < snapScreenings) {
        alerts.push(mkAlert(
          ed.id, ed.name, "data-regression", "medium",
          `「${ed.name}」排片数量回退`,
          `snapshot=${snapScreenings} → live=${live}（-${snapScreenings - live}）`,
          `${snapScreenings}->${live}`,
        ));
      }
    }
  }

  // 全局错误（对不上具体届次的）也报出来，避免漏报。
  for (const ge of globalErrors) {
    alerts.push(mkAlert(
      "(global)", "(global)", "fetch-failure", "high",
      "电影节管线全局错误", ge, ge,
    ));
  }

  return alerts;
}

/** 自检：用内置样例验证四条判定路径。 */
function selfCheck() {
  const registry = {
    festivals: [
      { id: "f1", authorization: "testing", editions: [{ id: "biff-2026", name: "BIFF 2026" }, { id: "idfa-2026", name: "IDFA 2026" }] },
    ],
  };
  const lastRun = {
    at: "2026-10-13T00:00:00.000Z",
    editions: [
      { slug: "biff-2026", action: "updated", parsed: { films: 255, screenings: 724, sourcesOk: 11, sourcesTotal: 11 }, changes: 0 },
      { slug: "idfa-2026", action: "fetch failed", error: "fetch timeout", errors: ["official site 503"] },
    ],
    errors: ["idfa-2026: official site 503", "proxy unreachable"],
  };
  const state = {
    editions: {
      "biff-2026": { lastFetchedAt: "2026-10-13T00:00:00Z", lastError: null, failCount: 0, counts: { screenings: 724 } },
      "idfa-2026": { lastFetchedAt: "2026-10-13T00:00:00Z", lastError: "official site 503", failCount: 4, counts: { screenings: 28 } },
    },
  };
  const alerts = collectAlerts({ registry, lastRun, state });
  const assert = (cond, msg) => { if (!cond) { console.error("SELF-CHECK FAILED:", msg); process.exit(2); } };
  assert(alerts.some((a) => a.editionId === "idfa-2026" && a.kind === "fetch-failure" && a.severity === "high"), "idfa fetch-failure high");
  assert(alerts.some((a) => a.editionId === "(global)" && a.kind === "fetch-failure"), "global error");
  assert(!alerts.some((a) => a.editionId === "biff-2026"), "biff should have no alert");
  console.log("SELF-CHECK OK (fetch-failure + global)");
}

function main() {
  const args = process.argv.slice(2);
  const has = (f) => args.includes(f);
  const fmt = args.includes("--format") ? args[args.indexOf("--format") + 1] : "json";

  if (has("--check")) return selfCheck();

  const registry = readJsonSafe(REGISTRY_FILE, null);
  const lastRun = readJsonSafe(LAST_RUN_FILE, null);
  const state = readJsonSafe(STATE_FILE, null);
  if (!registry || !lastRun || !state) {
    console.error("FATAL: 缺少必要数据文件（registry.json / last-run.json / state.json）");
    process.exit(3);
  }

  const alerts = collectAlerts({ registry, lastRun, state });

  // 幂等：读已告警指纹，只把「新」告警计入 fresh；随后把当前全部指纹写回。
  const prevState = readJsonSafe(ALERT_STATE_FILE, { fingerprints: [] });
  const prevFps = new Set(prevState.fingerprints || []);
  const fresh = alerts.filter((a) => !prevFps.has(a.fingerprint));
  if (!has("--no-state")) {
    writeFileSync(ALERT_STATE_FILE, JSON.stringify({
      at: new Date().toISOString(),
      fingerprints: alerts.map((a) => a.fingerprint),
    }, null, 2));
  }

  if (fmt === "text") {
    if (alerts.length === 0) {
      console.log("✅ 电影节排片管线无告警");
    } else {
      console.log(`⚠️ 电影节排片管线告警（共 ${alerts.length} 条，新增 ${fresh.length} 条）：`);
      for (const a of alerts) {
        const isNew = fresh.some((f) => f.fingerprint === a.fingerprint) ? "[新]" : "[已知]";
        console.log(`  ${isNew} [${a.severity}] ${a.message} — ${a.detail}`);
      }
    }
  } else {
    console.log(JSON.stringify({
      at: new Date().toISOString(),
      total: alerts.length,
      fresh: fresh.length,
      alerts,
    }, null, 2));
  }

  // 有告警返回 1，让 workflow 可据此开 issue；无告警返回 0。
  process.exit(alerts.length > 0 ? 1 : 0);
}

main();
