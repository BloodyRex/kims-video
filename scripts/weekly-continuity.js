/**
 * Weekly continuity for date-windowed intelligence sections
 * (Rex 2026-09-30 decision).
 *
 * Rule: 每周第一天（周一）选入展示的作品本周内固定保留；周二起只在前一天的基础上新增，
 * 不再对前一天已展示的内容重新筛选，直到本周结束；下周一重置、重新筛选。
 *
 * Scope (ONLY sections whose membership is driven by a release / first-air / street-date window):
 *   movies.json → releasedThisWeek, nowPlaying
 *   tv.json     → premieresThisWeek, ongoing
 *   music.json  → picks
 * Explicitly OUT of scope (Rex decisions 2026-09-30):
 *   即将上映 / 即将播出 / 总览即将上映 / 排片日历 coming.json / 编辑精选 / 发现页每日精选 /
 *   影视墙 / 剧集墙 / 每日邮件（邮件保持每日快照） /
 *   发现页社区发现、每日摘要（非作品列表）.
 *
 * Hard constraint this design respects: Cloudflare Workers Free = 50 subrequests per
 * invocation, and the movie endpoint already runs at 47/50 (measured). Locked items are
 * therefore CARRIED FORWARD verbatim from yesterday's published file — never re-fetched —
 * so the weekly accumulation adds ZERO subrequests. Re-fetching detail for the accumulated
 * set would breach the ceiling from Wednesday onward (measured on 3 real weeks).
 *
 * Safety valve: per-section cap (default 25). When the cap is hit, only TODAY's new
 * (not-yet-locked) entries are dropped, from the tail upward. Locked items are never evicted.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export const WEEKLY_SCOPE = {
  "movies.json": ["releasedThisWeek", "nowPlaying"],
  "tv.json": ["premieresThisWeek", "ongoing"],
  "music.json": ["picks"],
};

export const WEEKLY_LOCK_FILE = "weekly-lock.json";

/** Stable identity for a content item (movies/tv use tmdbId, albums use mbid). */
export function itemKey(item) {
  if (!item || typeof item !== "object") return null;
  const v = item.tmdbId ?? item.id ?? item.mbid ?? item.title;
  if (v == null || v === "") return null;
  return String(v);
}

/** Beijing-date string → ISO date of that week's Monday (TZ-safe: parse at UTC noon). */
export function weekStart(dateStr) {
  const d = new Date(`${String(dateStr || "").slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const offset = (d.getUTCDay() + 6) % 7; // Monday = 0 … Sunday = 6
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

export function loadWeeklyLock(dir) {
  const p = join(dir, WEEKLY_LOCK_FILE);
  if (!existsSync(p)) return null;
  try {
    const s = JSON.parse(readFileSync(p, "utf8"));
    return s && typeof s === "object" ? s : null;
  } catch (e) {
    console.warn(`⚠ weekly-lock.json unreadable (${e.message}) — starting a fresh week`);
    return null;
  }
}

export function saveWeeklyLock(dir, state) {
  const p = join(dir, WEEKLY_LOCK_FILE);
  const canonical = (s) => JSON.stringify({ ...s, updated: null }, null, 2);
  let prev = null;
  if (existsSync(p)) {
    try { prev = canonical(JSON.parse(readFileSync(p, "utf8"))); } catch {}
  }
  if (prev !== null && prev === canonical(state)) {
    // Only the `updated` stamp would differ — leave the file alone (no noise commit).
    return false;
  }
  writeFileSync(p, JSON.stringify(state, null, 2), "utf8");
  console.log(
    `OK weekly-lock.json — 周起点 ${state.weekStart}，锁定栏目 ${Object.keys(state.sections || {}).length} 个，上限 ${state.cap}/栏目`
  );
  return true;
}

function dedupeByKey(arr) {
  const seen = new Set();
  const out = [];
  for (const it of arr || []) {
    const k = itemKey(it);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

// ── Dead-entry check (Rex decision #5: 周中被下架/查不到的条目剔除并记录) ──
// CI has no TMDB token, so existence is probed through the poster asset URL
// (image.tmdb.org …/w500/<file>.jpg) — zero Worker subrequests. Two strikes required
// to drop, and any network error counts as "no evidence" (never drops a good card).
function probeUrl(item) {
  const raw = item.poster || item._posterUrl || "";
  if (!raw || typeof raw !== "string") return null;
  return raw; // absolute TMDB/CDN URL as published
}

async function probeExists(url, timeoutMs = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: "HEAD", signal: ctl.signal, redirect: "follow" });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: null, status: 0, error: e.message }; // unknown — no evidence
  } finally {
    clearTimeout(t);
  }
}

/**
 * Merge today's fresh section into the week's locked set.
 * @returns {Promise<{data:object, state:object, report:Array, changed:boolean}>}
 */
export async function applyWeeklyContinuity({
  file,
  fresh,
  previous,
  state,
  today,
  cap = 25,
  caps = null,
  enabled = true,
  verifyDead = true,
  probe = probeExists,
}) {
  const sections = WEEKLY_SCOPE[file];
  const report = [];
  if (!sections || !fresh || typeof fresh !== "object") {
    return { data: fresh, state, report, changed: false };
  }

  const wk = weekStart(today);
  let st = state && typeof state === "object" ? { ...state } : {};
  st.sections = { ...(st.sections || {}) };
  st.failures = { ...(st.failures || {}) };

  // New week → reset: this run's fresh list becomes the locked set.
  if (!st.weekStart || st.weekStart !== wk) {
    if (st.weekStart && st.weekStart !== wk) {
      console.log(`↻ weekly-lock — 新的一周开始 (${st.weekStart} → ${wk})：上周累计已重置`);
    }
    st = { updated: today, weekStart: wk, cap, sections: {}, failures: {} };
  }
  st.cap = cap;
  st.updated = today;

  let changed = false;

  for (const section of sections) {
    const lockKey = `${file}.${section}`;
    // Per-section cap override (config: weeklyContinuity.caps) — sections that gain many
    // items per day (music: ~15/day) need a higher valve than the global default.
    const sectionCap = Number(caps?.[lockKey]) > 0 ? Number(caps[lockKey]) : cap;
    const lockedIds = new Set(enabled && Array.isArray(st.sections[lockKey]) ? st.sections[lockKey] : []);
    const freshList = dedupeByKey(fresh[section]);
    const prevList = dedupeByKey(previous?.[section]);

    if (!enabled) {
      // Disabled: pass today's selection straight through and clear the lock for this
      // section, so re-enabling starts a clean week from that day.
      if (st.sections[lockKey]) { delete st.sections[lockKey]; changed = true; }
      report.push({ section, disabled: true, total: freshList.length });
      continue;
    }

    if (!freshList.length && !lockedIds.size) {
      // Nothing to lock and nothing locked — leave the section as-is.
      continue;
    }

    // ── Carried items: locked previously, absent from today's fresh selection ──
    // Verbatim from yesterday's published file → their stored detail fields
    // (S/E, CN release date, zh title) are reused, no TMDB re-fetch.
    let carried = prevList.filter((it) => {
      const k = itemKey(it);
      return k && lockedIds.has(k) && !freshList.some((f) => itemKey(f) === k);
    });

    // Dead-entry check on carried items only (2 strikes → drop).
    let dead = [];
    if (verifyDead && carried.length) {
      const results = await Promise.all(carried.map((it) => {
        const url = probeUrl(it);
        return url ? probe(url) : Promise.resolve({ ok: null, status: 0 });
      }));
      carried = carried.filter((it, i) => {
        const k = itemKey(it);
        const r = results[i];
        if (r.ok === true) { delete st.failures[`${lockKey}:${k}`]; return true; }
        if (r.ok === false && (r.status === 404 || r.status === 410)) {
          const n = (st.failures[`${lockKey}:${k}`] || 0) + 1;
          st.failures[`${lockKey}:${k}`] = n;
          if (n >= 2) {
            dead.push(k);
            console.warn(`⚠ weekly-lock — ${lockKey}: 条目 ${k}《${it.title || ""}》已两次取不到资源 (HTTP ${r.status})，本周剔除`);
            delete st.failures[`${lockKey}:${k}`];
            return false;
          }
          console.warn(`⚠ weekly-lock — ${lockKey}: 条目 ${k} 资源返回 HTTP ${r.status}（第 ${n}/2 次，暂留观）`);
          return true;
        }
        return true; // unknown/unverifiable (network error, no poster URL) → keep
      });
    }

    // ── Data-source failure protection (Rex decision #5) ──
    // Today's section came back EMPTY while the week already holds items (cold-cache
    // subrequest truncation / upstream outage / empty AI result): keep the week's locked
    // set verbatim instead of erasing it. Mirrors the pipeline's existing never-empty
    // guard for tv.ongoing, extended to every in-scope section. Dead entries are still
    // pruned above by the 2-strike check.
    if (!freshList.length && lockedIds.size) {
      const before = JSON.stringify(fresh[section]);
      fresh[section] = carried;
      const ids = carried.map(itemKey).filter(Boolean);
      if (before !== JSON.stringify(carried)) changed = true;
      if (JSON.stringify(st.sections[lockKey] || []) !== JSON.stringify(ids)) changed = true;
      st.sections[lockKey] = ids;
      console.warn(
        `⚠ weekly-lock — ${lockKey}: 今日数据为空（疑似数据源失败）→ 沿用本周已锁定的 ${carried.length} 条`
      );
      report.push({ section: lockKey, carried: carried.length, dead: dead.length, emptyFallback: true, total: carried.length, cap: sectionCap });
      continue;
    }

    // ── Safety valve: cap the section WITHOUT evicting locked items ──
    const lockedInFresh = freshList.filter((it) => lockedIds.has(itemKey(it)));
    const newToday = freshList.filter((it) => !lockedIds.has(itemKey(it)));
    const slots = Math.max(0, sectionCap - (lockedInFresh.length + carried.length));
    const keptNew = newToday.slice(0, slots);
    const dropped = newToday.slice(slots);
    if (dropped.length) {
      console.warn(
        `⚠ weekly-lock — ${lockKey}: 已满 ${sectionCap} 条，今日新增中舍弃 ${dropped.length} 条（保留全部已锁定作品）：${dropped.map((d) => itemKey(d)).join(", ")}`
      );
    }

    // Order: today's ranked list first (locked + kept new, original order), carried last.
    const droppedSet = new Set(dropped.map((d) => itemKey(d)));
    const merged = [
      ...freshList.filter((it) => !droppedSet.has(itemKey(it))),
      ...carried,
    ];

    const ids = merged.map(itemKey).filter(Boolean);
    const prevIds = Array.isArray(st.sections[lockKey]) ? st.sections[lockKey] : [];
    if (JSON.stringify(prevIds) !== JSON.stringify(ids) || JSON.stringify(fresh[section]) !== JSON.stringify(merged)) {
      changed = true;
    }
    st.sections[lockKey] = ids;
    fresh[section] = merged;

    report.push({
      section: lockKey,
      lockedBefore: lockedIds.size,
      carried: carried.length,
      dead: dead.length,
      newToday: newToday.length,
      keptNew: keptNew.length,
      dropped: dropped.length,
      total: merged.length,
      cap: sectionCap,
    });
  }

  // Prune failure counters for sections that are no longer locked.
  for (const key of Object.keys(st.failures)) {
    const base = key.split(":")[0];
    if (!st.sections[base]) delete st.failures[key];
  }

  return { data: fresh, state: st, report, changed };
}
