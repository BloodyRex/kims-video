// extract_intel.cjs — 从 workers-1.4.js 机械切片提取 intel 相关代码（逐字节，零改写）
// 用法: node extract_intel.cjs
// 产物: workers/intel.js
const fs = require("fs");

const SRC = "workers-1.4.js";
const OUT = "workers/intel.js";

// ── 需要提取的函数（按原文顺序）──────────────────────────────────────
const FUNCS = [
  "searchTMDB",
  "fetchEnglishPoster",
  "withCache",
  "fetchTMDBDetails",
  "fetchTMDBByType",
  "intelMapGenres",
  "intelToday",
  "intelDaysAgo",
  "intelDaysUntil",
  "intelRatingOk",
  "intelCredibleRating",
  "intelParseJSON",
  "deepMerge",
  "structClone",
  "getIntelConfig",
  "intelComputeScore",
  "intelNormalizeMovie",
  "intelFetchTMDB",
  "intelFetchPages",
  "intelFetchUpcomingMovies",
  "intelFetchReleasedMovies",
  "classifyRegion",
  "intelSelectDiverse",
  "intelSelectScored",
  "intelFetchMusicBrainz",
  "mapLimit",
  "handleIntelOverview",
  "handleIntelMovies",
  "intelFetchTVEpisodeDates",
  "intelPickCnReleaseDate",
  "intelFetchZhDetails",
  "intelFetchTVMazeWeb",
  "intelTVMazeToCandidate",
  "intelTVMazeToOutput",
  "intelTVMazeEnrich",
  "intelEnrichTVMazeBatch",
  "handleIntelTV",
  "handleIntelWeekly",
  "handleIntelComing",
  "handleIntelDebug",
  "handleIntelHiddenGems",
  "curateFromIntelligence",
  "handleIntelHiddenGemsLegacy",
];

// ── 需要提取的顶层常量（按原文顺序）──────────────────────────────────
const CONSTS = [
  "INTEL_GENRE_IDS",
  "SCORE_OPTS",
  "DEFAULT_INTEL_CFG",
  "INTEL_CFG_CACHE_KEY",
  "MAP_LIMIT_DEFAULT",
  "TVMAZE_LANG_MAP",
];

const src = fs.readFileSync(SRC, "utf8");
const lines = src.split("\n");

// ── 扫描顶层声明（列 0 起始），按花括号配对确定结束行 ─────────────────
// 返回 Map: name -> { start, end }  （start/end 为 0-based 行号，闭区间）
const decls = new Map();

function scanBlock(fromIdx) {
  // 从 fromIdx 行开始扫描花括号深度，直到深度归 0 的那一行
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
    decls.set(name, { start: i, end });
    i = end;
    continue;
  }
  const cm = line.match(/^const\s+(\w+)\s*=/);
  if (cm) {
    const name = cm[1];
    // 常量可能单行也可能多行（以 ; 结束，花括号深度归 0）
    let depth = 0;
    let end = i;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }
      if (depth <= 0 && lines[j].trimEnd().endsWith(";")) {
        end = j;
        break;
      }
    }
    decls.set(name, { start: i, end });
    i = end;
  }
}

// ── 校验白名单是否全部命中 ────────────────────────────────────────────
const missing = [...FUNCS, ...CONSTS].filter((n) => !decls.has(n));
if (missing.length) {
  console.error("MISSING declarations:", missing.join(", "));
  process.exit(1);
}

// ── 合并 span，按起始行排序，生成要复制的行号集合 ─────────────────────
const spans = [];
for (const name of [...FUNCS, ...CONSTS]) {
  const d = decls.get(name);
  spans.push([d.start, d.end]);
}
spans.sort((a, b) => a[0] - b[0]);

// 去重合并（保持原文顺序）
const merged = [];
for (const [s, e] of spans) {
  if (merged.length && s <= merged[merged.length - 1][1] + 1) {
    merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
  } else {
    merged.push([s, e]);
  }
}

// ── 逐字节提取（含行内原始内容，零改写）───────────────────────────────
const blocks = merged.map(([s, e]) => lines.slice(s, e + 1).join("\n"));

const header = `// ═══════════════════════════════════════════════════════════════════
// Kim's Video — Intelligence Worker (mechanically sliced from workers-1.4.js)
// Routes: /intelligence/overview | movies | tv | coming | weekly
//         /intelligence/hidden-gems | debug | trailer
// 逐字节切片，逻辑零改动。digest / 音乐管线留给后续 Phase。
// ═══════════════════════════════════════════════════════════════════
`;

const router = `

// ═══════════════════════════════════════════════════════════════════
// Router（仅保留 intel GET 端点 + trailer + hidden-gems POST）
// ═══════════════════════════════════════════════════════════════════
export default {
  async fetch(request, env, ctx) {
    const ALLOWED_ORIGINS = ["https://bloodyrex.xyz", "https://www.bloodyrex.xyz", "https://bloodyrex.github.io", "https://api.bloodyrex.xyz", "http://localhost:4173", "http://localhost:5173", "http://localhost:5174", "http://localhost:7850", "http://127.0.0.1:7850"];
    const origin = request.headers.get("Origin");
    const corsHeaders = { "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0], "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS", "Access-Control-Max-Age": "86400" };
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response(JSON.stringify({ error: "Forbidden Origin" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ── GET routes ──
    if (method === "GET") {
      // ── Intelligence API ──
      const intelMatch = path.match(/^\\/intelligence\\/(overview|movies|tv|coming|weekly|hidden-gems|debug)$/);
      if (intelMatch) {
        const intelHandlers = {
          overview: handleIntelOverview, movies: handleIntelMovies, tv: handleIntelTV,
          coming: handleIntelComing,
          weekly: handleIntelWeekly, "hidden-gems": handleIntelHiddenGems,
          debug: handleIntelDebug,
        };
        try {
          const intelData = intelMatch[1] === "hidden-gems"
            ? await handleIntelHiddenGems(request, env)
            : await intelHandlers[intelMatch[1]](env);
          return Response.json(intelData, { headers: corsHeaders });
        } catch (e) {
          return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
        }
      }
      // Trailer lookup
      if (path === "/intelligence/trailer") {
        const tmdbId = url.searchParams.get("tmdbId");
        const mtype = url.searchParams.get("type") || "movie";
        if (!tmdbId) return Response.json({ error: "Missing tmdbId" }, { status: 400, headers: corsHeaders });
        try {
          const tk = env.TMDB_API_READ_ACCESS_TOKEN;
          const vurl = \`https://api.themoviedb.org/3/\${mtype}/\${tmdbId}/videos?language=en-US\`;
          const vr = await fetch(vurl, { headers: { Authorization: "Bearer " + tk, "Content-Type": "application/json" } });
          if (!vr.ok) return Response.json({ key: null }, { headers: corsHeaders });
          const vd = await vr.json();
          const videos = vd?.results || [];
          const trailer = videos.find(v => v.site === "YouTube" && v.type === "Trailer") || videos.find(v => v.site === "YouTube");
          return Response.json({ key: trailer?.key || null }, { headers: corsHeaders });
        } catch (e) {
          return Response.json({ key: null }, { headers: corsHeaders });
        }
      }
      // Fallback: health check
      return Response.json({ status: "ok", worker: "intel" }, { headers: corsHeaders });
    }

    // ── POST routes ──
    if (method === "POST") {
      // Hidden gems v2 (Pipeline-fed: POST today's movies/tv intelligence)
      if (url.pathname === "/intelligence/hidden-gems") {
        try { return Response.json(await handleIntelHiddenGems(request, env), { headers: corsHeaders }); }
        catch (e) { return Response.json({ error: \`hidden-gems: \${e.message}\` }, { status: 500, headers: corsHeaders }); }
      }
    }

    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }
};
`;

const output = header + "\n" + blocks.join("\n\n") + router + "\n";
fs.writeFileSync(OUT, output, "utf8");

console.log("Extracted:", FUNCS.length + CONSTS.length, "declarations into", merged.length, "block(s)");
console.log("Output:", OUT, "(" + Buffer.byteLength(output, "utf8") + " bytes)");
