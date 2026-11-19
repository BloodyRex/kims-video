// verify_intel.cjs — 独立复核：确认 workers/intel.js 中每个提取块与原文件逐字节一致
const fs = require("fs");

const SRC = "workers-1.4.js";
const OUT = "workers/intel.js";

const NAMES = [
  "searchTMDB", "fetchEnglishPoster", "withCache", "fetchTMDBDetails", "fetchTMDBByType",
  "intelMapGenres", "intelToday", "intelDaysAgo", "intelDaysUntil", "intelRatingOk",
  "intelCredibleRating", "intelParseJSON", "deepMerge", "structClone", "getIntelConfig",
  "intelComputeScore", "intelNormalizeMovie", "intelFetchTMDB", "intelFetchPages",
  "intelFetchUpcomingMovies", "intelFetchReleasedMovies", "classifyRegion",
  "intelSelectDiverse", "intelSelectScored", "intelFetchMusicBrainz", "mapLimit",
  "handleIntelOverview", "handleIntelMovies", "intelFetchTVEpisodeDates",
  "intelPickCnReleaseDate", "intelFetchZhDetails", "intelFetchTVMazeWeb",
  "intelTVMazeToCandidate", "intelTVMazeToOutput", "intelTVMazeEnrich",
  "intelEnrichTVMazeBatch", "handleIntelTV", "handleIntelWeekly", "handleIntelComing",
  "handleIntelDebug", "handleIntelHiddenGems", "curateFromIntelligence",
  "handleIntelHiddenGemsLegacy",
  "INTEL_GENRE_IDS", "SCORE_OPTS", "DEFAULT_INTEL_CFG", "INTEL_CFG_CACHE_KEY",
  "MAP_LIMIT_DEFAULT", "TVMAZE_LANG_MAP",
];

function extractBlocks(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const decls = new Map();
  function scanBlock(fromIdx) {
    let depth = 0;
    for (let j = fromIdx; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }
      if (depth <= 0 && j >= fromIdx) return j;
    }
    return lines.length - 1;
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fm = line.match(/^(?:async\s+)?function\s+(\w+)/);
    if (fm) {
      const name = fm[1];
      const end = scanBlock(i);
      decls.set(name, lines.slice(i, end + 1).join("\n"));
      i = end;
      continue;
    }
    const cm = line.match(/^const\s+(\w+)\s*=/);
    if (cm) {
      const name = cm[1];
      let depth = 0;
      let end = i;
      for (let j = i; j < lines.length; j++) {
        for (const ch of lines[j]) {
          if (ch === "{") depth++;
          else if (ch === "}") depth--;
        }
        if (depth <= 0 && lines[j].trimEnd().endsWith(";")) { end = j; break; }
      }
      decls.set(name, lines.slice(i, end + 1).join("\n"));
      i = end;
    }
  }
  return decls;
}

const srcBlocks = extractBlocks(SRC);
const outBlocks = extractBlocks(OUT);

let ok = 0, bad = 0;
for (const n of NAMES) {
  const s = srcBlocks.get(n);
  const o = outBlocks.get(n);
  if (s === undefined) { console.error("SRC missing:", n); bad++; continue; }
  if (o === undefined) { console.error("OUT missing:", n); bad++; continue; }
  if (s === o) { ok++; }
  else {
    bad++;
    console.error("DIFF:", n, "(src " + s.length + " chars vs out " + o.length + " chars)");
  }
}

console.log(`\nVerbatim-identical: ${ok}/${NAMES.length}; mismatches: ${bad}`);
process.exit(bad === 0 ? 0 : 1);
