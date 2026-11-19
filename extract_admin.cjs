// extract_admin.cjs — 从 workers-1.4.js 机械切片提取 /admin/* 代码 → workers/admin.js
// 用法: node extract_admin.cjs
// 命名函数/常量按名提取；PATCH/DELETE 路由块按行区间逐字节提取
const fs = require("fs");

const SRC = "workers-1.4.js";
const OUT = "workers/admin.js";

const FUNCS = [
  "createAdminToken",
  "verifyAdminToken",
  "handleAdminResults",
  "handleAdminDelete",
  "handleAdminPatch",
  "deepMerge",
  "structClone",
  "getIntelConfig",
  "setIntelConfig",
];

const CONSTS = [
  "DEFAULT_INTEL_CFG",
  "INTEL_CFG_CACHE_KEY",
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
      if (depth <= 0 && lines[j].trimEnd().endsWith(";")) { end = j; break; }
    }
    decls.set(name, { start: i, end });
    i = end;
  }
}

const missing = [...FUNCS, ...CONSTS].filter((n) => !decls.has(n));
if (missing.length) {
  console.error("MISSING:", missing.join(", "));
  process.exit(1);
}

const spans = [...FUNCS, ...CONSTS].map((n) => {
  const d = decls.get(n);
  return [d.start, d.end];
}).sort((a, b) => a[0] - b[0]);

const merged = [];
for (const [s, e] of spans) {
  if (merged.length && s <= merged[merged.length - 1][1] + 1) {
    merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
  } else {
    merged.push([s, e]);
  }
}
const blocks = merged.map(([s, e]) => lines.slice(s, e + 1).join("\n"));

// PATCH/DELETE 路由块：4305-4339 行（0-based 4304-4338），逐字节提取
const adminRoutesBlock = lines.slice(4304, 4339).join("\n");

const header = `// ═══════════════════════════════════════════════════════════════════
// Kim's Video — Admin Worker (mechanically sliced from workers-1.4.js)
// Routes: /admin/login | /admin/results | /admin/config | /admin/set-authorization
// 逐字节切片，逻辑零改动。
// ═══════════════════════════════════════════════════════════════════
`;

// 手写路由骨架（单行 GET/POST 路由 + 提取的 PATCH/DELETE 块）
const router = `

// ═══════════════════════════════════════════════════════════════════
// Router（仅 admin 端点）
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
    const auth = request.headers.get("Authorization");
    const token = auth ? auth.replace("Bearer ", "") : "";

    // ── Admin auth check helper ──
    const requireAdmin = () => { if (!token || !verifyAdminToken(token, env.ADMIN_PASSWORD)) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders }); return null; };

    // ── GET routes ──
    if (method === "GET") {
      if (path === "/admin/results") { const err = requireAdmin(); if (err) return err; try { return Response.json(await handleAdminResults(env), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }
      if (path === "/admin/config") { const err = requireAdmin(); if (err) return err; try { return Response.json(await getIntelConfig(env), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }
      return Response.json({ status: "ok", worker: "admin" }, { headers: corsHeaders });
    }

    // ── POST routes ──
    if (method === "POST") {
      if (path === "/admin/login") { let b; try { b = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); } if (!env.ADMIN_PASSWORD) return Response.json({ error: "Admin not configured" }, { headers: corsHeaders }); if (b.password !== env.ADMIN_PASSWORD) return Response.json({ error: "Invalid password" }, { headers: corsHeaders }); return Response.json({ token: createAdminToken(env.ADMIN_PASSWORD) }, { headers: corsHeaders }); }
    }

    // ── PATCH / DELETE routes（原文件 4305-4339 逐字节） ──
${adminRoutesBlock}

    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }
};
`;

const output = header + "\n" + blocks.join("\n\n") + router + "\n";
fs.writeFileSync(OUT, output, "utf8");

console.log("Extracted:", FUNCS.length, "functions +", CONSTS.length, "consts + admin routes block(4305-4339)");
console.log("Output:", OUT, "(" + Buffer.byteLength(output, "utf8") + " bytes)");
