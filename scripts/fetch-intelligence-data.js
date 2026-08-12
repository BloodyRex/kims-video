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

const hasChineseText = (text) => /[\u4e00-\u9fff]/.test(text || "");

const WORKER_BASE = process.env.WORKER_BASE_URL || "https://api.bloodyrex.xyz";

async function fetchJSON(endpoint) {
  const url = `${WORKER_BASE}${endpoint}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${endpoint}: ${res.status} — ${body.slice(0, 200)}`);
  }
  return res.json();
}

// Universal Chinese content filter
// fileName context: movies.json → all movie items; tv.json → all TV items;
// coming.json → items carry mediaType. Used to en-exempt TV (mirror Worker).
function filterChineseContent(data, fileName = "") {
  if (!data || typeof data !== "object") return;
  const hasChinese = (text) => /[一-鿿]/.test(text || "");
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (!Array.isArray(val) || val.length === 0) continue;
    const sample = val[0];
    if (!sample || typeof sample !== "object") continue;
    // Only filter arrays where items have a title/name (content items)
    if (!("title" in sample || "name" in sample)) continue;
    // Don't filter music items (global content, Chinese not required)
    if (key === "music") continue;
    // TV ongoing: also check latest season is within 6 months
    if (key === "ongoing") {
      const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
      data[key] = val.filter(item => !item.latestAirDate || item.latestAirDate >= sixMonthsAgo);
      continue;
    }
    // Upcoming/next*: scoring-based selection in the Worker (pop floor + zh bonus) already
    // decided what belongs here — do NOT re-apply a hard Chinese filter, or hot non-zh
    // titles (which qualify on popularity alone) get killed a second time.
    if (key === "upcoming" || key === "next7Days" || key === "next30Days") {
      continue;
    }
    data[key] = val.filter(item => {
      const check = (text) => typeof text === "string" && hasChinese(text);
      return check(item.title || item.name) && check(item.summary || item.overview);
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
    // Music is handled separately via pipeline (see below)
    { endpoint: "/intelligence/coming", file: "coming.json" },
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
      let data = await fetchJSON(task.endpoint);

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
      const id = String(it.tmdbId);
      if (seen.has(id)) {
        // Upgrade to Chinese title when a later snapshot has one (keep firstSeen)
        if (!hasChineseText(wall.find((m) => String(m.tmdbId) === id).title) && hasChineseText(it.title)) {
          const idx = wall.findIndex((m) => String(m.tmdbId) === id);
          wall[idx] = {
            tmdbId: it.tmdbId,
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
    try {
      const recsRes = await fetch(`${WORKER_BASE}/wall/recs`);
      if (recsRes.ok) {
        const recsData = await recsRes.json();
        for (const r of recsData.items || []) {
          if (!r?.tmdbId) continue;
          const id = String(r.tmdbId);
          if (seen.has(id)) continue;
          seen.add(id);
          const recEntry = {
            tmdbId: r.tmdbId,
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

    if (added > 0 || upgraded > 0) {
      wall.sort((a, b) => String(b.releaseDate || "").localeCompare(String(a.releaseDate || "")));
      writeFileSync(
        wallPath,
        JSON.stringify({ updated: today, count: wall.length, movies: wall }, null, 2),
        "utf8"
      );
      anyChange = true;
      console.log(`OK wall.json — +${added} new, ${upgraded} title-upgraded, ${wall.length} total`);
    } else {
      console.log(`OK wall.json — unchanged (${wall.length} total)`);
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
    const LIMIT = 8; // daily cap — keeps token cost small (≈250 tokens/film)
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
  await translateWall();

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
    console.log(`[MUSIC] Done in ${((Date.now() - musicStart) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.error(`FAIL music pipeline: ${e.message}`);
    // Don't set exit code — music pipeline failure shouldn't block commit of other data
  }

  if (!anyChange) {
    console.log("\nNo data changes detected — skipping commit.");
  } else {
    console.log("\nData updated — ready for commit.");
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