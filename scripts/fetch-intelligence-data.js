#!/usr/bin/env node
/**
 * Intelligence Daily Data Pipeline
 * Calls Cloudflare Worker endpoints, saves JSON to public/api/
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { INTELLIGENCE_CONFIG } from "../config/intelligence.config.js";
import { collectMusicCandidates, stripDebugFields } from "./music-pipeline.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const API_DIR = join(__dirname, "..", "public", "api");

const beijingDate = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

const hasChineseText = (text) => /\u4e00-\u9fff/.test(text || "");

const WORKER_BASE = process.env.WORKER_BASE_URL || "https://api.bloodyrex.xyz";

async function fetchJSON(endpoint, options) {
  const url = `${WORKER_BASE}${endpoint}`;
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${endpoint}: ${res.status} — ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ── NEW RULE: For China mainland/HK/TW movies，ONLY Chinese title required ──
/**
 * Detect if movie is from China mainland / Hong Kong / Taiwan
 * Based on TMDB originCountry codes or title keywords
 */
function isChineseRegionMovie(item) {
  const origin = Array.isArray(item.originCountry) ? item.originCountry : [];

  // Direct country match: CN, HKG,TWN
  if (origin.includes('CN') || origin.includes('HKG') || origin.includes('TWN')) {
    return true;
  }

  // Title keywords indicating Chinese region release
  const zhRegionKeywords = ['内地上映', '中国大陆', '中国香港', '中国台湾', 
                            'HK 上映 ', 'TVB', 'Hong Kong', 'Taiwan film'];
  if (zhRegionKeywords.some(kw => item.title && item.title.includes(kw))) {
    return true;
  }

  return false;
}

// Universal Chinese content filter
// fileName context: movies.json → all movie items; tv.json → all TV items;
// coming.json → items carry mediaType. Used to en-exempt TV (mirror Worker).
function filterChineseContent(data, fileName = "") {
  if (!data || typeof data !== "object") return;
  const hasChinese = (text) => /[一 - 鿿]/.test(text || "");
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (!Array.isArray(val) || val.length === 0) continue;
    const sample = val[0];
    if (!sample || typeof sample !== "object") continue;
    // Only filter arrays where items have a title/name (content items)
    if (!("title" in sample || "name" in sample)) continue;
    // Don't filter music items (global content, Chinese not required)
    if (key === "music") continue;
    // Digest topTrends are small tags (title only, no summary/overview) — never
    // content-filter them, or every digest ships with empty trend tags
    if (key === "topTrends") continue;
    // TV ongoing: also check latest season is within 6 months
    if (key === "ongoing") {
      const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
      data[key] = val.filter(item => !item.latestAirDate || item.latestAirDate >= sixMonthsAgo);
      continue;
    }
    
    // Upcoming/next*/overview scored sections: scoring-based selection in the
    // Worker (pop floor + zh bonus) already decided what belongs here — do NOT
    // re-apply a hard Chinese filter, or hot non-zh titles (which qualify on
    // popularity alone) get killed a second time.
    // 2026-08-24 P1-2: overview.comingSoon joined this list — it IS
    // movies.upcoming's scored set, but the unlisted hard gate emptied the
    // overview 即将上映 movie row to 0/6 (live data). Same for weeklyHotTv.
    if (key === "upcoming" || key === "next7Days" || key === "next30Days"
      || key === "comingSoon" || key === "weeklyHotTv") {
      continue;
    }

    data[key] = val.filter(item => {
      const hasChinese = (text) => typeof text === "string" && /[\u4e00-\u9fff]/.test(text);

      // ── MIXED DUAL SOURCE: TVTVAZE fallback to TMDB for international shows ──
      if (item.source === 'tvmaze') {
        // TVMAZE 来源剧集：仅要求有英文标题即可（无中文名/简介）
        return Boolean(item.title || item.name) && 
               Boolean(item.rating ?? item.summary); // ⏸️容错：有评分或简介即可
      }

      // China mainland / HK/TW movies, ONLY title with Chinese needed  
      if (isChineseRegionMovie(item)) {
        return hasChinese(item.title || item.name);  // ✅ NO summary check required
      }

      // Other regions (international): keep original strict TMDB filter (keep zh bonus)
      return hasChinese(item.title || item.name) &&
             hasChinese(item.summary || item.overview);
    });
  }
}

async function main() {
  if (!existsSync(API_DIR)) mkdirSync(API_DIR, { recursive: true });

  const tasks = [
    // Overview LAST: it reuses now_playing/upcoming/on_the_air data that movies/tv
    // fetch first — running it after them hits their withCache entries (TTL 1h),
    // dropping its subrequest count from ~55 (over the 50 limit → 500) to ~14.
    { endpoint: "/intelligence/movies", file: "movies.json" },
    { endpoint: "/intelligence/tv", file: "tv.json" },
    // coming.json is NO LONGER fetched from the Worker (2026-08-23): it re-ran an
    // independent selection whose TV picks diverged from tv.json.upcoming (7 of 8
    // titles mismatched, live data 2026-08-22). Built locally below by merging the
    // two files above — single source of truth, zero extra Worker subrequests.
    // Music is handled separately via pipeline (see below)
    { endpoint: "/intelligence/weekly", file: "weekly.json" },
    { endpoint: "/intelligence/hidden-gems", file: "hidden-gems.json" },
    { endpoint: "/intelligence/digest", file: "digest.json" },
    { endpoint: "/intelligence/overview", file: "overview.json" },
  ];

  let anyChange = false;
  let failCount = 0;

  for (const task of tasks) {
    const filePath = join(API_DIR, task.file);
    try {
      let data;
      // Hidden gems: POST this run's movies/tv intelligence so the Worker curates
      // from TODAY's data (CDN static files are still yesterday's at this point)
      if (task.endpoint === "/intelligence/hidden-gems") {
        const moviesToday = JSON.parse(readFileSync(join(API_DIR, "movies.json"), "utf8"));
        const tvToday = JSON.parse(readFileSync(join(API_DIR, "tv.json"), "utf8"));
        data = await fetchJSON(task.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ movies: moviesToday, tv: tvToday }),
        });
      } else {
        data = await fetchJSON(task.endpoint);
      }

      // Universal filter: all content items must have Chinese title + summary
      filterChineseContent(data, task.file);

      // Check if data actually changed
      let oldData = null;
      if (existsSync(filePath)) {
        try {
          oldData = JSON.parse(readFileSync(filePath, "utf8"));
        } catch {}
      }

      writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
      const changed = !oldData || JSON.stringify(oldData.stats || oldData) !== JSON.stringify(data.stats || data);
      if (changed) anyChange = true;

      console.log(`OK ${task.file} — ${changed ? "NEW DATA" : "unchanged"}`);
    } catch (e) {
      console.error(`FAIL ${task.file}: ${e.message}`);
      failCount++;
      // Don't set exit code — non-critical endpoint failure shouldn't block commit
    }
  }

  // ── Coming Soon: built locally from TODAY's movies.json + tv.json (2026-08-23) ──
  // Replaces the old /intelligence/coming Worker call whose independent re-selection
  // produced TV lists that contradicted tv.json.upcoming. Now: single source of
  // truth — movies.upcoming ⊆ next30 always, TV side = tv.upcoming verbatim.
  // mediaType tags are REQUIRED: the wall builder below filters
  // coming.next7/next30 by `mediaType === "movie"`, and the Search view maps
  // `_type` off it too.
  try {
    const moviesData = JSON.parse(readFileSync(join(API_DIR, "movies.json"), "utf8"));
    const tvData = JSON.parse(readFileSync(join(API_DIR, "tv.json"), "utf8"));
    const daysOf = (item) => {
      if (typeof item.daysUntil === "number") return item.daysUntil;
      const d = item.releaseDate || "";
      return d ? Math.max(0, Math.ceil((new Date(d) - new Date(beijingDate() + "T00:00:00+08:00")) / 86400000)) : 999;
    };
    const allItems = [
      ...(moviesData.upcoming || []).map(i => ({ ...i, mediaType: "movie", daysUntil: daysOf(i) })),
      // explicit mediaType: tv.json.upcoming only carries it on source=tvmaze
      // entries — TMDB-sourced shows would fall through the wall/search filters
      ...(tvData.upcoming || []).map(i => ({ ...i, mediaType: "tv", daysUntil: daysOf(i) })),
    ].filter(i => i.daysUntil !== null && i.daysUntil <= 999);
    const comingData = {
      updated: beijingDate(),
      next7Days: allItems.filter(i => i.daysUntil <= 7),
      next30Days: allItems.filter(i => i.daysUntil <= 30),
    };
    const comingPath = join(API_DIR, "coming.json");
    let oldComing = null;
    if (existsSync(comingPath)) { try { oldComing = JSON.parse(readFileSync(comingPath, "utf8")); } catch {} }
    writeFileSync(comingPath, JSON.stringify(comingData, null, 2), "utf8");
    const comingChanged = !oldComing || JSON.stringify(oldComing.next7Days || []) !== JSON.stringify(comingData.next7Days)
      || JSON.stringify(oldComing.next30Days || []) !== JSON.stringify(comingData.next30Days);
    if (comingChanged) anyChange = true;
    console.log(`OK coming.json — local merge: ${comingData.next7Days.length} in 7d / ${comingData.next30Days.length} in 30d (${comingChanged ? "NEW DATA" : "unchanged"})`);

    // ── discover-daily.json: mirror of overview.editorsPicks for the Discover page ──
    // The Discover top row shows the same fixed-6 daily picks as Intelligence 总览.
    // Read from the JUST-WRITTEN overview.json (the fetch-loop's `data` variable is
    // out of scope here — that bug silently skipped this file on 2026-08-23).
    // DiscoverPage falls back to /api/overview.json client-side if missing.
    const ovDaily = JSON.parse(readFileSync(join(API_DIR, "overview.json"), "utf8"));
    if (ovDaily?.editorsPicks?.length) {
      writeFileSync(
        join(API_DIR, "discover-daily.json"),
        JSON.stringify({ updated: beijingDate(), picks: ovDaily.editorsPicks }, null, 2),
        "utf8"
      );
      console.log(`OK discover-daily.json — ${ovDaily.editorsPicks.length} daily picks`);
    }
  } catch (e) {
    console.error(`FAIL coming.json (local build): ${e.message}`);
    failCount++; // movies/tv missing is serious — counts toward the all-fail retry signal
  }

  // ── Wall: cumulative movie wall (persistent, grows daily) ──
  async function buildWall() {
    const wallPath = join(API_DIR, "wall.json");
    let wall = [];
    if (existsSync(wallPath)) {
      try {
        wall = JSON.parse(readFileSync(wallPath, "utf8")).movies || [];
      } catch {}
    }
    const seen = new Set(wall.map((m) => String(m.tmdbId)));
    const today = beijingDate();
    const sources = [];
    let upgraded = 0;
    const delta = []; // today's new additions → wall-delta.json (daily email section)

    // Cleanup: remove previously-collected TV shows (wall is movies-only).
    // Blacklist ids probed 2026-08-18 (movie 404 + tv 200); re-checked each run.
    const WALL_TV_BLACKLIST = new Set([
      154887, 121913, 99618, 106840, 82596, 105961, 97645, 96102, 92925,
      91569, 64010, 61593, 114765, 3729, 4589, 4586, 16069, 1424353,
    ]);
    const preLen = wall.length;
    wall = wall.filter((m) => !WALL_TV_BLACKLIST.has(Number(m.tmdbId)));
    if (wall.length !== preLen) {
      console.log(`OK wall.json — removed ${preLen - wall.length} TV shows (movies-only rule)`);
    }

    for (const file of ["movies.json", "coming.json"]) {
      let data;
      try {
        data = JSON.parse(readFileSync(join(API_DIR, file), "utf8"));
      } catch {
        continue; // endpoint failed this run — keep existing wall intact
      }
      if (file === "movies.json") {
        for (const key of ["releasedToday", "releasedThisWeek", "upcoming", "nowPlaying"]) {
          if (Array.isArray(data[key])) sources.push(...data[key]);
        }
      } else {
        for (const key of ["next7Days", "next30Days"]) {
          if (Array.isArray(data[key])) {
            sources.push(...data[key].filter((it) => it.mediaType === "movie"));
          }
        }
      }
    }

    let added = 0;
    for (const it of sources) {
      if (!it || it.tmdbId == null) continue;
      // Wall is MOVIES ONLY — drop anything that isn't a film
      if (it.mediaType && it.mediaType !== "movie") continue;
      const id = String(it.tmdbId);
      if (seen.has(id)) {
        // Upgrade to Chinese title when a later snapshot has one (keep firstSeen)
        if (!hasChineseText(wall.find((m) => String(m.tmdbId) === id).title) && hasChineseText(it.title)) {
          const idx = wall.findIndex((m) => String(m.tmdbId) === id);
          wall[idx] = {
            tmdbId: it.tmdbId,
            mediaType: "movie",
            title: it.title || it.name || "",
            titleEn: it.titleEn || "",
            year: it.year || "",
            releaseDate: it.releaseDate || "",
            poster: it.poster || "",
            rating: it.rating || 0,
            genre: Array.isArray(it.genre) ? it.genre : [],
            firstSeen: wall[idx].firstSeen,
          };
          upgraded++;
        }
        continue;
      }
      seen.add(id);
      const entry = {
        tmdbId: it.tmdbId,
        mediaType: "movie",
        title: it.title || it.name || "",
        titleEn: it.titleEn || "",
        year: it.year || "",
        releaseDate: it.releaseDate || "",
        poster: it.poster || "",
        rating: it.rating || 0,
        genre: Array.isArray(it.genre) ? it.genre : [],
        firstSeen: today,
      };
      wall.push(entry);
      delta.push(entry);
      added++;
    }

    // Merge user-recommended films (collected from ResultsPage via /wall/collect → KV wallRec:*)
    // Wall rule: MOVIES ONLY. TV shows are excluded here — they belong to a future 剧集墙.
    // (WALL_TV_BLACKLIST declared above; probed via TMDB movie 404 + tv 200 on 2026-08-18)
    try {
      const recsRes = await fetch(`${WORKER_BASE}/wall/recs`);
      if (recsRes.ok) {
        const recsData = await recsRes.json();
        for (const r of recsData.items || []) {
          if (!r?.tmdbId) continue;
          if (WALL_TV_BLACKLIST.has(Number(r.tmdbId))) continue; // TV → skip, not a film
          const id = String(r.tmdbId);
          if (seen.has(id)) continue;
          seen.add(id);
          const recEntry = {
            tmdbId: r.tmdbId,
            mediaType: r.mediaType || "movie",
            title: r.title || "",
            titleEn: r.titleEn || "",
            year: r.year || "",
            releaseDate: r.releaseDate || "",
            poster: r.poster || "",
            rating: r.rating || 0,
            genre: Array.isArray(r.genre) ? r.genre : [],
            source: r.source || "rec",
            firstSeen: r.firstSeen || today,
          };
          wall.push(recEntry);
          delta.push(recEntry);
          added++;
        }
      }
    } catch (e) {
      console.warn("wall-recs merge failed:", e.message);
    }

    // Always re-sort + rewrite: sort must apply even on no-new-item runs
    // (2026-08-18: date-less rec items were sinking to the bottom on the
    // first run after the fix, but only when new items triggered a write).
    // Date-descending; entries WITHOUT a releaseDate (e.g. user-recommended
    // rec items that never got a TMDB date) sort by firstSeen instead, after
    // dated items — not via "" localeCompare which sinks them below 1902 films.
    wall.sort((a, b) => {
      const da = a.releaseDate || "";
      const db = b.releaseDate || "";
      if (!da && !db) return String(b.firstSeen || "").localeCompare(String(a.firstSeen || ""));
      if (!da) return 1; // a has no date → a after b
      if (!db) return -1; // b has no date → b after a
      return String(db).localeCompare(String(da));
    });
    if (added > 0 || upgraded > 0) {
      writeFileSync(
        wallPath,
        JSON.stringify({ updated: today, count: wall.length, movies: wall }, null, 2),
        "utf8"
      );
      anyChange = true;
      console.log(`OK wall.json — +${added} new, ${upgraded} title-upgraded, ${wall.length} total`);
    } else {
      // No new items, but write anyway so the (fixed) sort order reaches the site
      writeFileSync(
        wallPath,
        JSON.stringify({ updated: today, count: wall.length, movies: wall }, null, 2),
        "utf8"
      );
      anyChange = true;
      console.log(`OK wall.json — re-sorted (${wall.length} total)`);
    }

    // Wall delta: today's new additions — consumed by the daily email
    // ("🏛️ 影视墙今日新增" section). Written every run so the file stays fresh.
    writeFileSync(
      join(API_DIR, "wall-delta.json"),
      JSON.stringify({ updated: today, count: delta.length, movies: delta }, null, 2),
      "utf8"
    );
    if (delta.length > 0) anyChange = true;
    console.log(`OK wall-delta.json — ${delta.length} new today`);
  }

  await buildWall();

  // ── TV Wall: per-season cumulative wall (2026-08-24, Rex approved) ──
  // Mirrors buildWall's delta/dedup machinery but keyed on `tmdbId:S{season}`
  // (one card PER SEASON), laid out by latestAirDate (recent activity) instead
  // of series premiere date. Shows premiering before 2010 are excluded unless
  // they arrive via user/community channels (source rec/community).
  async function buildTvWall() {
    const tvWallPath = join(API_DIR, "tvwall.json");
    let tvwall = [];
    try {
      tvwall = JSON.parse(readFileSync(tvWallPath, "utf8")).shows || [];
    } catch {}
    const seen = new Set(tvwall.map((m) => `${m.tmdbId}:S${m.season ?? "?"}`));
    const today = beijingDate();
    const delta = [];
    let added = 0;
    let upgradedEps = 0;

    // Sources: today's tv.json (premieres/ongoing) + weekly.json trending TV.
    // upcoming entries only qualify once AIRED (daysUntil <= 0 / no daysUntil
    // with an aired date) — un-aired shows belong to 即将播出, not the wall.
    const sources = [];
    const pushAll = (list, tag) => { for (const it of list || []) sources.push({ it, tag }); };
    try {
      const tvData = JSON.parse(readFileSync(join(API_DIR, "tv.json"), "utf8"));
      pushAll(tvData.premieresThisWeek, "premieres");
      pushAll(tvData.ongoing, "ongoing");
      pushAll((tvData.upcoming || []).filter((s) => typeof s.daysUntil !== "number" || s.daysUntil <= 0), "upcoming-aired");
    } catch {}
    try {
      const wk = JSON.parse(readFileSync(join(API_DIR, "weekly.json"), "utf8"));
      pushAll(wk.tv, "trending");
    } catch {}

    for (const { it, tag } of sources) {
      if (!it || it.tmdbId == null) continue;
      const season = it.season != null ? Number(it.season) : null;
      if (season == null) continue; // no season data → cannot place on a season wall yet
      // Pre-2010 rule (Rex): skip old series unless community/user-collected
      const premiereYear = Number(String(it.releaseDate || "").slice(0, 4));
      const community = tag === "rec" || tag === "community" || it.source === "rec";
      if (!community && premiereYear > 0 && premiereYear < 2010) continue;
      const key = `${it.tmdbId}:S${season}`;
      if (seen.has(key)) {
        // Same-season episode progress: upgrade in place, NOT a new card
        const idx = tvwall.findIndex((m) => `${m.tmdbId}:S${m.season}` === key);
        if (idx >= 0 && String(it.latestAirDate || "") > String(tvwall[idx].latestAirDate || "")) {
          tvwall[idx].episode = it.episode ?? tvwall[idx].episode;
          tvwall[idx].latestAirDate = it.latestAirDate || tvwall[idx].latestAirDate;
          upgradedEps++;
        }
        continue;
      }
      seen.add(key);
      const entry = {
        tmdbId: it.tmdbId,
        season,
        episode: it.episode ?? null,
        latestAirDate: it.latestAirDate || "",
        title: it.title || "",
        titleEn: it.titleEn || "",
        year: it.year || (it.releaseDate || "").slice(0, 4),
        seriesFirstAirDate: it.releaseDate || "",
        poster: it.poster || "",
        rating: it.rating || 0,
        genre: Array.isArray(it.genre) ? it.genre : [],
        summary: it.summary || "",
        source: community ? tag : tag.replace("-aired", ""),
        firstSeen: today,
      };
      tvwall.push(entry);
      delta.push(entry);
      added++;
    }

    // Sort by latestAirDate desc (the wall's axis = recent activity); items
    // without one sink to the end ordered by firstSeen.
    tvwall.sort((a, b) => {
      const da = a.latestAirDate || "";
      const db = b.latestAirDate || "";
      if (!da && !db) return String(b.firstSeen || "").localeCompare(String(a.firstSeen || ""));
      if (!da) return 1;
      if (!db) return -1;
      return String(db).localeCompare(String(da));
    });
    writeFileSync(
      tvWallPath,
      JSON.stringify({ updated: today, count: tvwall.length, shows: tvwall }, null, 2),
      "utf8"
    );
    anyChange = true;
    console.log(`OK tvwall.json — +${added} new seasons, ${upgradedEps} ep-upgraded, ${tvwall.length} total`);

    writeFileSync(
      join(API_DIR, "tvwall-delta.json"),
      JSON.stringify({ updated: today, count: delta.length, shows: delta }, null, 2),
      "utf8"
    );
  }

  await buildTvWall();


  // ── Wall translate: AI-translate missing zh overviews into wall.json (batch, newest-first) ──
  async function translateWall() {
    const wallPath = join(API_DIR, "wall.json");
    let wall = [];
    try {
      wall = JSON.parse(readFileSync(wallPath, "utf8")).movies || [];
    } catch {
      return;
    }
    const pending = wall
      .filter((m) => !m.summary && !m.summarySkip)
      .sort((a, b) => String(b.firstSeen || "").localeCompare(String(a.firstSeen || "")));
    if (!pending.length) {
      console.log("OK wall-translate — nothing pending");
      return;
    }
    const LIMIT = 40; // daily cap — ≈250 tokens/film, 40/day clears backlog in ~2 weeks
    const batch = pending.slice(0, LIMIT);
    let translated = 0;
    let noOverview = 0;
    let failed = 0;
    for (const m of batch) {
      try {
        const res = await fetch(`${WORKER_BASE}/intelligence/translate-overview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tmdbId: m.tmdbId }),
        });
        if (!res.ok) {
          failed++;
          continue;
        }
        const d = await res.json();
        const c = d.content || {};
        if (c.hasOverview === false) {
          m.summarySkip = true; // no EN overview on TMDB — never retry
          noOverview++;
        } else if (c.translated) {
          m.summary = c.translated;
          translated++;
        } else {
          failed++; // DeepSeek hiccup — retried on a later run
        }
      } catch {
        failed++;
      }
    }
    if (translated > 0 || noOverview > 0) {
      writeFileSync(
        wallPath,
        JSON.stringify({ updated: beijingDate(), count: wall.length, movies: wall }, null, 2),
        "utf8"
      );
      anyChange = true;
    }
    console.log(
      `OK wall-translate — +${translated} translated, ${noOverview} skipped (no EN overview), ${failed} failed, ${pending.length - batch.length} still pending`
    );
  }
  // ── Wall translate: MOVED TO LOCAL (scripts/translate-wall-local.js, Ollama+
  // DeepSeek fallback). CI no longer spends DeepSeek tokens on translation;
  // local script handles it with qwen3.5:9b and falls back to the Worker's
  // translate-overview endpoint only when Ollama is down or fails. If the local
  // script hasn't run, pending entries simply remain without zh summary —
  // wall cards are unaffected. ──
  // await translateWall(); // DISABLED 2026-08-16 — see above

  // ── Music Pipeline (separate, runs in Node.js, no Worker subrequest limits) ──
  console.log("\n[MUSIC] Starting pipeline...");
  const musicStart = Date.now();
  try {
    const { candidates, topCandidates, stats: musicStats } = await collectMusicCandidates(INTELLIGENCE_CONFIG);

    // Write candidate.json (stripped debug fields, for Worker AI)
    const candidatePayload = {
      updated: beijingDate(),
      candidates: topCandidates.map(stripDebugFields),
    };
    writeFileSync(join(API_DIR, "candidate.json"), JSON.stringify(candidatePayload, null, 2), "utf8");
    console.log(`OK candidate.json — ${topCandidates.length} candidates for AI`);

    // Write candidate-debug.json (full debug info)
    const debugPayload = {
      updated: beijingDate(),
      config: INTELLIGENCE_CONFIG,
      stats: musicStats,
      candidates,
    };
    writeFileSync(join(API_DIR, "candidate-debug.json"), JSON.stringify(debugPayload, null, 2), "utf8");
    console.log(`OK candidate-debug.json — ${candidates.length} total`);

    // POST candidates to Worker V2 for AI curation
    const musicRes = await fetch(`${WORKER_BASE}/intelligence/music/v2`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates: topCandidates.map(stripDebugFields) }),
    });
    if (!musicRes.ok) {
      const errBody = await musicRes.text().catch(() => "");
      throw new Error(`Worker V2: ${musicRes.status} — ${errBody.slice(0, 200)}`);
    }
    const musicData = await musicRes.json();
    const picksCount = musicData?.picks?.length || 0;

    // Merge mbid/cover from original candidates (Worker may drop these)
    if (musicData.picks) {
      musicData.picks = musicData.picks.map(pick => {
        const original = topCandidates[pick.index];
        if (original?.mbid || original?.cover) {
          return { ...pick, mbid: pick.mbid || original.mbid, cover: pick.cover || original.cover };
        }
        return pick;
      });
    }

    // Write music.json (same format as before — frontend unaffected)
    writeFileSync(join(API_DIR, "music.json"), JSON.stringify(musicData, null, 2), "utf8");
    console.log(`OK music.json — ${picksCount} picks from AI`);
    anyChange = true;
    console.log(`[MUSIC] Done in $((Date.now() - musicStart) / 1000)s`);
  } catch (e) {
    console.error(`FAIL music pipeline: ${e.message}`);
    // Don't set exit code — music pipeline failure shouldn't block commit of other data
  }

  if (!anyChange) {
    console.log("\nNo data changes detected — skipping commit.");
  } else {
    console.log("Data updated — ready for commit.");
  }

  // If ALL endpoints failed, signal retry (partial failure still commits)
  const tasksTotal = tasks.length;
  if (failCount === tasksTotal) {
    console.error(`FAIL ALL ${failCount}/${tasksTotal} endpoints failed — triggering retry`);
    process.exitCode = 1;
  }

  console.log("Pipeline done:", beijingDate());
}

main();