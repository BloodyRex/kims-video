#!/usr/bin/env node
/**
 * Festival Calendar —— 每日/高频更新编排
 *
 * 数据流（严格单向，AI 不参与事实）：
 *   Official Source → Fetch/Parse → Normalize → Validate → Store → Change Detection → Publish
 *
 * 用法：
 *   node scripts/festivals/run.mjs                  # 按注册表状态节流（CI 每 30 分钟调用一次）
 *   node scripts/festivals/run.mjs --force          # 忽略节流，立即重抓
 *   node scripts/festivals/run.mjs --only=biff-2026 # 只处理某届
 *   node scripts/festivals/run.mjs --proxy=http://127.0.0.1:7897   # 本地（被墙环境）走代理
 *   node scripts/festivals/run.mjs --dry-run        # 只抓取与校验，不写盘
 *
 * 失败安全：任何一步失败都保留旧数据，绝不发布更差的结果（见 normalize.validate 的硬性规则）。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createFetcher, nowIso, daysBetween } from "./lib.mjs";
import { normalize, validate } from "./normalize.mjs";
import { detectChanges, summarize } from "./diff.mjs";
import { buildPublished, registryOnlyStore } from "./publish.mjs";
import * as biff from "./adapters/biff.mjs";
import * as idfa from "./adapters/idfa.mjs";
import * as bfi from "./adapters/bfi.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DATA_DIR = join(ROOT, "data", "festivals");
const EDITIONS_DIR = join(DATA_DIR, "editions");
const SNAPS_DIR = join(DATA_DIR, "snapshots");
const API_DIR = join(ROOT, "public", "api");
const API_FEST_DIR = join(API_DIR, "festivals");

const ADAPTERS = { biff, idfa, bfi };
const CHANGES_MAX = 1000;

const args = process.argv.slice(2);
const flag = (name) => args.some((a) => a === `--${name}`);
const opt = (name, dflt = null) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};

const FORCE = flag("force");
const DRY = flag("dry-run");
const ONLY = opt("only");
const PROXY = opt("proxy");
const log = (...a) => console.log(...a);

const readJson = (p, fallback) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
};
const writeJson = (p, obj) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(obj, null, 1) + "\n");
};

function localDay(iso, timeZone) {
  try {
    return new Date(iso).toLocaleDateString("en-CA", { timeZone });
  } catch {
    return iso.slice(0, 10);
  }
}

/** 按注册表状态决定本次是否抓取（>30天 24h / ≤30天 6h / 进行中 30min / 排片待发布 立即） */
function fetchIntervalMinutes(edition, lastStatus, now) {
  const tz = edition.timezone || "UTC";
  const today = localDay(now, tz);
  const policy = edition.fetch || { farHours: 24, nearDays: 30, nearHours: 6, liveMinutes: 30 };
  const live = today >= edition.startDate && today <= edition.endDate;
  if (live) return policy.liveMinutes ?? 30;
  const daysToStart = daysBetween(today, edition.startDate);
  if (daysToStart <= (policy.nearDays ?? 30)) {
    // 节目/排片尚未公布时，官网随时可能上线 —— 用更高频率
    const pending = lastStatus?.statusDetail && lastStatus.statusDetail.schedule !== "LIVE";
    return pending ? Math.max(30, Math.round((policy.nearHours ?? 6) * 60 / 2)) : (policy.nearHours ?? 6) * 60;
  }
  return (policy.farHours ?? 24) * 60;
}

function isDue(edition, state, now) {
  const last = state?.editions?.[edition.id];
  if (!last?.lastFetchedAt) return { due: true, reason: "never fetched" };
  if (FORCE) return { due: true, reason: "forced" };
  const interval = fetchIntervalMinutes(edition, last, now);
  const ageMin = (Date.parse(now) - Date.parse(last.lastFetchedAt)) / 60000;
  if (ageMin >= interval) return { due: true, reason: `age ${Math.round(ageMin)}min ≥ ${interval}min` };
  return { due: false, reason: `age ${Math.round(ageMin)}min < ${interval}min` };
}

async function main() {
  const now = nowIso();
  const registry = readJson(join(DATA_DIR, "registry.json"), { festivals: [] });
  const state = readJson(join(DATA_DIR, "state.json"), { editions: {} });
  const changeLog = readJson(join(DATA_DIR, "changes.json"), { changes: [] });
  const fetchTextOpts = { proxy: PROXY };
  const { fetchText } = createFetcher(fetchTextOpts);

  const report = { at: now, proxy: !!PROXY, force: FORCE, editions: [], errors: [] };

  for (const festival of registry.festivals || []) {
    for (const edition of festival.editions || []) {
      if (ONLY && edition.id !== ONLY) continue;
      const storePath = join(EDITIONS_DIR, `${edition.id}.json`);
      const previous = readJson(storePath, null);
      const st = state.editions[edition.id] || {};
      const { due, reason } = isDue(edition, state, now);
      const entry = { slug: edition.id, due, reason, status: previous?.status || null };

      const adapter = festival.adapter ? ADAPTERS[festival.adapter] : null;
      if (!adapter) {
        entry.action = "registry-only (no adapter)";
        report.editions.push(entry);
        continue;
      }
      if (!due) {
        entry.action = "skipped (throttled)";
        report.editions.push(entry);
        continue;
      }

      let raw;
      try {
        raw = await adapter.fetchEdition({ festival, edition, fetchText, log });
      } catch (e) {
        entry.action = "fetch failed";
        entry.error = String(e?.message || e);
        state.editions[edition.id] = {
          ...st,
          lastAttemptAt: now,
          failCount: (st.failCount || 0) + 1,
          lastError: entry.error,
        };
        report.editions.push(entry);
        report.errors.push(`${edition.id}: fetch threw ${entry.error}`);
        continue;
      }

      const store = normalize({ festival, edition, raw });
      const verdict = validate(store, previous);
      entry.parsed = {
        films: store.stats.films,
        screenings: store.stats.screenings,
        venues: store.stats.venues,
        days: store.stats.days,
        sourcesOk: store.sources.filter((s) => s.ok).length,
        sourcesTotal: store.sources.length,
        status: store.status,
        lifecycle: store.lifecycle,
      };
      entry.warnings = verdict.warnings;

      if (!verdict.ok) {
        entry.action = "REJECTED (kept previous data)";
        entry.errors = verdict.errors;
        state.editions[edition.id] = {
          ...st,
          lastAttemptAt: now,
          failCount: (st.failCount || 0) + 1,
          lastError: verdict.errors.slice(0, 3).join(" | "),
        };
        report.editions.push(entry);
        report.errors.push(`${edition.id}: ${verdict.errors.slice(0, 3).join(" | ")}`);
        continue;
      }

      if (DRY) {
        entry.action = "validated (dry-run, not written)";
        report.editions.push(entry);
        continue;
      }

      // 变更检测（写盘前先算，旧快照仍完整）
      const rawChanges = detectChanges(previous, store, { at: now, siteLabel: festival.name.en });
      const { changes, collapsed } = summarize(rawChanges);
      if (rawChanges.length) {
        changeLog.changes = [...changes, ...(changeLog.changes || [])].slice(0, CHANGES_MAX);
        changeLog.updated = now;
      }

      if (previous) writeJson(join(SNAPS_DIR, `${edition.id}.json`), previous);
      writeJson(storePath, store);
      writeJson(join(DATA_DIR, "changes.json"), changeLog);
      state.editions[edition.id] = {
        lastFetchedAt: store.fetchedAt,
        lastVerifiedAt: store.lastVerifiedAt,
        lastChangedAt: rawChanges.length ? now : st.lastChangedAt || null,
        lastStatus: store.status,
        statusDetail: store.statusDetail,
        lifecycle: store.lifecycle,
        counts: { films: store.stats.films, screenings: store.stats.screenings },
        failCount: 0,
        lastError: null,
        changesLastRun: rawChanges.length,
        collapsed,
      };
      entry.action = "updated";
      entry.changes = rawChanges.length;
      report.editions.push(entry);
      log(`[run] ${edition.id}: updated — ${store.stats.screenings} screenings, ${rawChanges.length} change record(s)`);
    }
  }

  // ── 发布：始终从磁盘上的「当前最佳数据」生成，保证局部失败也能发布 ──
  // 注意：--only 只约束「抓取」阶段；发布必须收录注册表内全部届次，
  // 否则单站运行（如 --only=idfa-2026）会把其它站从 public/api/festivals.json 索引里挤掉。
  const stores = [];
  for (const festival of registry.festivals || []) {
    for (const edition of festival.editions || []) {
      const store = readJson(join(EDITIONS_DIR, `${edition.id}.json`), null);
      if (store) stores.push(store);
      else if (!festival.adapter) stores.push(registryOnlyStore(festival, edition, now));
    }
  }

  if (!DRY && stores.length) {
    const published = buildPublished({ stores, changes: changeLog.changes || [], now });
    for (const store of stores) {
      const detail = { ...store };
      delete detail.warnings;
      detail.films = (detail.films || []).map(({ idx, ...rest }) => rest);
      writeJson(join(API_FEST_DIR, `${store.slug}.json`), detail);
    }
    writeJson(join(API_DIR, "festivals.json"), published.summary);
    writeJson(join(API_DIR, "festival-changes.json"), published.changesFeed);
    report.published = {
      festivals: published.summary.festivals.length,
      stats: published.summary.stats,
      detailFiles: stores.map((s) => s.slug),
    };
    log(`[run] published public/api/festivals.json — ${JSON.stringify(published.summary.stats)}`);
  }

  if (!DRY) {
    state.updated = now;
    writeJson(join(DATA_DIR, "state.json"), state);
  }

  writeJson(join(ROOT, "data", "festivals", "last-run.json"), report);
  log("[run] report:\n" + JSON.stringify(report, null, 1));
  if (!stores.length) {
    console.error("[run] no edition store available — nothing published");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("[run] fatal:", e);
  process.exit(1);
});
