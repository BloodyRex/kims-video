/**
 * Build wall.json from git history — ONE-TIME BACKFILL SCRIPT
 *
 * Walks every git commit that touched public/api/movies.json,
 * extracts all movie items (releasedThisWeek / upcoming / nowPlaying),
 * dedupes by tmdbId, keeps the FIRST-seen date as `firstSeen`,
 * and writes a slimmed public/api/wall.json sorted by releaseDate desc.
 *
 * Run from project root:  node scripts/build-wall-backfill.js
 */

import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const API_DIR = join(__dirname, "..", "public", "api");
const WALL_PATH = join(API_DIR, "wall.json");

const MOVIE_KEYS = ["releasedToday", "releasedThisWeek", "upcoming", "nowPlaying"];

const hasChineseText = (text) => /[\u4e00-\u9fff]/.test(text || "");

/** Keep only the fields the wall page needs (no summaries — size control). */
function pickFields(it, firstSeen) {
  return {
    tmdbId: it.tmdbId,
    title: it.title || it.name || "",
    titleEn: it.titleEn || "",
    year: it.year || "",
    releaseDate: it.releaseDate || "",
    poster: it.poster || "",
    rating: it.rating || 0,
    genre: Array.isArray(it.genre) ? it.genre : [],
    firstSeen,
  };
}

function main() {
  // 1. All commits that touched movies.json, oldest first: "date hash"
  const logLines = execSync(
    'git log --format="%ad %H" --date=short -- public/api/movies.json',
    { encoding: "utf8" }
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .reverse(); // oldest → newest

  if (!logLines.length) {
    console.error("No git history found for public/api/movies.json");
    process.exit(1);
  }

  const seen = new Map(); // tmdbId → wall item
  let parsedCommits = 0;
  let skippedEmpty = 0;
  let upgraded = 0;

  for (const line of logLines) {
    const [date, hash] = line.trim().split(/\s+/);
    let raw;
    try {
      raw = execSync(`git show ${hash}:public/api/movies.json`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      continue; // commit may not contain the file (rename edge cases)
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue; // corrupt / partial snapshot, skip
    }

    let count = 0;
    for (const key of MOVIE_KEYS) {
      const arr = data?.[key];
      if (!Array.isArray(arr)) continue;
      for (const it of arr) {
        if (!it || it.tmdbId == null) continue;
        const id = String(it.tmdbId);
        if (seen.has(id)) {
          // Upgrade to Chinese title when a later snapshot has one (keep firstSeen)
          const existing = seen.get(id);
          if (!hasChineseText(existing.title) && hasChineseText(it.title)) {
            seen.set(id, pickFields(it, existing.firstSeen));
            upgraded++;
          }
          continue;
        }
        seen.set(id, pickFields(it, date));
        count++;
      }
    }
    if (count > 0) parsedCommits++;
    else skippedEmpty++;
  }

  const movies = [...seen.values()].sort((a, b) =>
    String(b.releaseDate || "").localeCompare(String(a.releaseDate || ""))
  );

  if (!existsSync(API_DIR)) mkdirSync(API_DIR, { recursive: true });
  const payload = {
    updated: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }),
    count: movies.length,
    movies,
  };
  writeFileSync(WALL_PATH, JSON.stringify(payload, null, 2), "utf8");

  // Stats
  const dates = movies.filter(m => m.releaseDate).map(m => m.releaseDate);
  const genres = {};
  for (const m of movies) for (const g of m.genre) genres[g] = (genres[g] || 0) + 1;

  console.log(`commits with new items: ${parsedCommits} (${skippedEmpty} snapshots added nothing — already deduped)`);
  console.log(`total movies:   ${movies.length} (title upgrades applied: ${upgraded})`);
  console.log(`date range:     ${dates.length ? dates[dates.length - 1] : "?"} → ${dates[0] || "?"}`);
  console.log(`written:        ${WALL_PATH} (${JSON.stringify(payload).length} bytes)`);
  console.log("\nTop genres:");
  Object.entries(genres)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([g, n]) => console.log(`  ${g}: ${n}`));
}

main();
