// extract_discover.cjs — 重新机械切片 discover.js（修 KV 前缀 bug + 去 shared 依赖，B1）
// 用法: node extract_discover.cjs
// 从 workers-1.4.js 逐字节提取；覆盖 /discover/*、/wall/*、/migrate/* + scheduled
const fs = require("fs");

const SRC = "workers-1.4.js";
const OUT = "workers/discover.js";

// 命名函数（genId 行同时含 nowISO，两者都在同一行被捕获）
const FUNCS = [
  "fetchEnglishPoster",
  "withCache",
  "fetchTMDBDetails",
  "fetchTMDBByType",
  "genId",
  "handleDiscoverList",
  "handleDiscoverCreate",
  "collectWallRecs",
  "handleDiscoverLike",
  "handleDiscoverUpload",
  "intelToday",
  "mapLimit",
  "migrateRandomToken",
  "migrateValidateBlob",
  "migratePurgeExpired",
];

const CONSTS = [
  "MAP_LIMIT_DEFAULT",
  "MIGRATE_PREFIX",
  "MIGRATE_TTL_SECONDS",
  "MIGRATE_MAX_BLOB_BYTES",
  "MIGRATE_TOKEN_RE",
];

const src = fs.readFileSync(SRC, "utf8");
const lines = src.split("\n");

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

function findLine(needle, from = 0) {
  for (let i = from; i < lines.length; i++) {
    if (lines[i].includes(needle)) return i;
  }
  return -1;
}

const decls = new Map();
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
    let depth = 0, end = i;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }
      if (depth <= 0 && lines[j].replace(/\r$/, "").replace(/\/\/.*$/, "").trimEnd().endsWith(";")) { end = j; break; }
    }
    decls.set(name, { start: i, end });
    i = end;
  }
}

const missing = [...FUNCS, ...CONSTS].filter((n) => !decls.has(n));
if (missing.length) { console.error("MISSING:", missing.join(", ")); process.exit(1); }

const spans = [...FUNCS, ...CONSTS].map((n) => {
  const d = decls.get(n);
  return [d.start, d.end];
}).sort((a, b) => a[0] - b[0]);

const merged = [];
for (const [s, e] of spans) {
  if (merged.length && s <= merged[merged.length - 1][1] + 1) {
    merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
  } else merged.push([s, e]);
}
const blocks = merged.map(([s, e]) => lines.slice(s, e + 1).join("\n"));

// ── 机械提取路由块 ──
function extractRoute(marker, prevCommentLines = 0) {
  const idx = findLine(marker);
  if (idx < 0) { console.error("route not found:", marker); process.exit(1); }
  const end = scanBlock(idx);
  return lines.slice(idx - prevCommentLines, end + 1).join("\n");
}

const wallRecsRoute = extractRoute('path === "/wall/recs"');
const migrateGetRoute = extractRoute('method === "GET" && path.startsWith("/migrate/")', 1);
const migratePostRoute = extractRoute('path === "/migrate/create"', 3);
const wallCollectRoute = extractRoute('path === "/wall/collect"', 1);

const header = `// ═══════════════════════════════════════════════════════════════════
// Kim's Video — Discover Worker (mechanically sliced from workers-1.4.js)
// Routes: /discover/*, /wall/collect, /wall/recs, /migrate/*, scheduled(purge)
// 逐字节切片，逻辑零改动。KV key 前缀保持原文 result: / wallRec:。
// ═══════════════════════════════════════════════════════════════════
`;

// 路由骨架：短路由手写（原文逐字），机械提取块以变量插入
const router = `

// ═══════════════════════════════════════════════════════════════════
// Router
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
      // Thumbnail serve
      const tm = path.match(/^\\/discover\\/thumbnail\\/(.+)$/);
      if (tm && env.DISCOVER_R2) { try { const obj = await env.DISCOVER_R2.get(\`thumbnails/\${tm[1]}.png\`); if (!obj) return new Response("Not found", { status: 404, headers: corsHeaders }); const h = new Headers(); obj.writeHttpMetadata(h); h.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]); h.set("Cache-Control", "public, max-age=86400"); return new Response(obj.body, { headers: h }); } catch (e) { return new Response("Error", { status: 500, headers: corsHeaders }); } }

${wallRecsRoute}

      // Discover list
      if (path === "/discover/results") { try { return Response.json(await handleDiscoverList(env, url), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message, results: [] }, { headers: corsHeaders }); } }

${migrateGetRoute}

      // Fallback: health check
      return Response.json({ status: "ok", worker: "discover" }, { headers: corsHeaders });
    }

    // ── POST routes ──
    if (method === "POST") {
${migratePostRoute}

      // Discover upload
      const um = path.match(/^\\/discover\\/results\\/(.+)\\/upload$/);
      if (um) { try { const ub = await request.json(); return Response.json(await handleDiscoverUpload(env, { id: um[1], image: ub.image }), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }

      // Discover like
      const lm = path.match(/^\\/discover\\/results\\/(.+)\\/like$/);
      if (lm) { try { return Response.json(await handleDiscoverLike(env, lm[1]), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }

${wallCollectRoute}

      let body;
      try { body = await request.json(); } catch (e) { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); }

      // Discover create
      if (path === "/discover/results") { try { const doc = await handleDiscoverCreate(env, body); if (doc?.id) { const wallItems = [...doc.sourceMovies, ...doc.recommendations].filter(m => m.tmdbId).map(m => ({ tmdbId: m.tmdbId, title: m.title, year: m.year })); ctx.waitUntil(collectWallRecs(env, wallItems)); } return Response.json(doc, { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }
    }

    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  },

  // ── Nightly: purge expired personal-data migration blobs from R2 ──
  async scheduled(event, env, ctx) {
    try {
      const purged = await migratePurgeExpired(env);
      console.log("scheduled migrate-purge:", JSON.stringify(purged));
    } catch (e) {
      console.log("scheduled migrate-purge failed:", e && e.message);
    }
  },
};
`;

const output = header + "\n" + blocks.join("\n\n") + router + "\n";
fs.writeFileSync(OUT, output, "utf8");

console.log("Re-sliced discover.js:");
console.log("  - 命名函数/常量:", FUNCS.length + CONSTS.length, "个");
console.log("  - 机械路由块: wall/recs, migrate GET, migrate POST, wall/collect");
console.log("Output:", OUT, "(" + Buffer.byteLength(output, "utf8") + " bytes)");
