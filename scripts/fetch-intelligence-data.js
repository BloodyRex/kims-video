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

  for (const task of tasks) {
    const filePath = join(API_DIR, task.file);
    try {
      const data = await fetchJSON(task.endpoint);

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
      process.exitCode = 1;
    }
  }

  // ── Music Pipeline (separate, runs in Node.js, no Worker subrequest limits) ──
  console.log("\n[MUSIC] Starting pipeline...");
  const musicStart = Date.now();
  try {
    const { candidates, topCandidates, stats: musicStats } = await collectMusicCandidates(INTELLIGENCE_CONFIG);

    // Write candidate.json (stripped debug fields, for Worker AI)
    const candidatePayload = {
      updated: new Date().toISOString().split("T")[0],
      candidates: topCandidates.map(stripDebugFields),
    };
    writeFileSync(join(API_DIR, "candidate.json"), JSON.stringify(candidatePayload, null, 2), "utf8");
    console.log(`OK candidate.json — ${topCandidates.length} candidates for AI`);

    // Write candidate-debug.json (full debug info)
    const debugPayload = {
      updated: new Date().toISOString().split("T")[0],
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

    // Write music.json (same format as before — frontend unaffected)
    writeFileSync(join(API_DIR, "music.json"), JSON.stringify(musicData, null, 2), "utf8");
    console.log(`OK music.json — ${picksCount} picks from AI`);
    anyChange = true;
    console.log(`[MUSIC] Done in ${((Date.now() - musicStart) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.error(`FAIL music pipeline: ${e.message}`);
    process.exitCode = 1;
  }

  if (!anyChange) {
    console.log("\nNo data changes detected — skipping commit.");
  } else {
    console.log("\nData updated — ready for commit.");
  }

  console.log("Pipeline done:", new Date().toISOString().split("T")[0]);
}

main();