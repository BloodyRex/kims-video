#!/usr/bin/env node
/**
 * Festival Calendar — 共享工具（HTTP 抓取、文本清洗、日期）
 * 无第三方依赖：CI 用 Node 20 全局 fetch；本地被墙时才用 --proxy（动态 import undici）。
 */

export const UA =
  "KimVideo-FestivalCalendar/1.0 (+https://bloodyrex.xyz; rexhr@yahoo.com)";

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  "#8217": "\u2019",
  "#8216": "\u2018",
  "#8220": "\u201c",
  "#8221": "\u201d",
  "#8211": "\u2013",
  "#8212": "\u2014",
  "#8230": "\u2026",
};

export function decodeEntities(s) {
  if (!s) return "";
  return String(s)
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+|#\d+);/gi, (m, k) => {
      const key = String(k).toLowerCase();
      return ENTITIES[key] !== undefined ? ENTITIES[key] : ENTITIES["#" + key] !== undefined ? ENTITIES["#" + key] : m;
    });
}

export function stripTags(s) {
  return String(s || "").replace(/<[^>]*>/g, " ");
}

/** 去标签 + 解实体 + 折叠空白 */
export function clean(s) {
  return decodeEntities(stripTags(s)).replace(/\s+/g, " ").trim();
}

export function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** 2026-10-06 + 2 → 2026-10-08 */
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  const pa = Date.parse(a + "T00:00:00Z");
  const pb = Date.parse(b + "T00:00:00Z");
  return Math.round((pb - pa) / 86400000);
}

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** "OCT 8 (THU)" → { month: 10, day: 8 } */
export function parseScheduleHeading(text) {
  const m = String(text || "").match(/([A-Za-z]{3,9})\s+(\d{1,2})/);
  if (!m) return null;
  const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
  if (!month) return null;
  return { month, day: Number(m[2]) };
}

/** 每个 host 之间保持礼貌间隔；并发固定为 2 */
export function createFetcher(opts = {}) {
  const { proxy = null, timeoutMs = 25000, retries = 2, gapMs = 400 } = opts;
  let dispatcherReady = false;
  const lastAt = new Map();
  let queue = Promise.resolve();

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const setupDispatcher = async () => {
    if (!proxy || dispatcherReady) return;
    const undici = await import("undici");
    undici.setGlobalDispatcher(new undici.ProxyAgent(proxy));
    dispatcherReady = true;
  };

  const throttle = (host) => {
    queue = queue.then(async () => {
      const prev = lastAt.get(host) || 0;
      const wait = gapMs - (Date.now() - prev);
      if (wait > 0) await sleep(wait);
      lastAt.set(host, Date.now());
    });
    return queue;
  };

  async function fetchText(url, { label = url } = {}) {
    await setupDispatcher();
    let host = url;
    try {
      host = new URL(url).host;
    } catch {
      /* keep raw */
    }
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      await throttle(host);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          redirect: "follow",
          signal: ctrl.signal,
          headers: {
            "user-agent": UA,
            accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.9",
          },
        });
        const body = await res.text();
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { ok: true, status: res.status, body, url };
      } catch (e) {
        clearTimeout(timer);
        const msg = e?.name === "AbortError" ? `timeout after ${timeoutMs}ms` : String(e?.message || e);
        if (attempt > retries) return { ok: false, status: 0, error: msg, url, label };
        await sleep(1200 * attempt);
      }
    }
    return { ok: false, status: 0, error: "unreachable", url, label };
  }

  return { fetchText, proxy };
}

/** 稳定 id（只含 [a-z0-9-]），供前端做 key 与 detail 页 */
export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
