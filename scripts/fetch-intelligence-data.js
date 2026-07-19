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
function filterChineseContent(data) {
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
    // Upcoming/next*: items haven't premiered yet, may lack Chinese title or overview
    // Accept if EITHER title OR overview has Chinese characters
    if (key === "upcoming" || key === "next7Days" || key === "next30Days") {
      data[key] = val.filter(item => hasChinese(item.title || item.name) || hasChinese(item.summary || item.overview));
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
    { endpoint: "/intelligence/overview", file: "overview.json" },
    { endpoint: "/intelligence/movies", file: "movies.json" },
    { endpoint: "/intelligence/tv", file: "tv.json" },
    // Music is handled separately via pipeline (see below)
    { endpoint: "/intelligence/coming", file: "coming.json" },
    { endpoint: "/intelligence/weekly", file: "weekly.json" },
    { endpoint: "/intelligence/hidden-gems", file: "hidden-gems.json" },
    { endpoint: "/intelligence/digest", file: "digest.json" },
  ];

  let anyChange = false;
  let failCount = 0;

  for (const task of tasks) {
    const filePath = join(API_DIR, task.file);
    try {
      let data = await fetchJSON(task.endpoint);

      // Universal filter: all content items must have Chinese title + summary
      filterChineseContent(data);

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