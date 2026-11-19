// extract_digest.cjs — 从 workers-1.4.js 机械切片提取 digest/邮件相关代码（逐字节，零改写）
// 用法: node extract_digest.cjs
// 产物: workers/digest.js
// 注意: 直接 fs 读磁盘原始字节（read_file 工具会把 Bearer ${...} 脱敏，此脚本不受影响）
const fs = require("fs");

const SRC = "workers-1.4.js";
const OUT = "workers/digest.js";

// ── 需要提取的命名函数（按原文顺序）──────────────────────────────────
const FUNCS = [
  "withCache",
  "intelToday",
  "intelDaysAgo",
  "intelParseJSON",
  "intelFetchTMDB",
  "handleIntelDigest",
  "handleUnsubscribe",
  "handleSubscribe",
  "fetchDigestData",
  "buildWeeklyWorkIndex",
  "weeklyLockedWorks",
  "weekStartOf",
  "renderDigestHtml",
  "digestShownKeys",
  "pickTodayStar",
  "buildDigestHTML",
  "handleSendDigest",
  "withTimeout",
  "sendDigestToAll",
];

const src = fs.readFileSync(SRC, "utf8");
const lines = src.split("\n");

// ── 扫描顶层声明（列 0 起始），按花括号配对确定结束行 ─────────────────
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
    decls.set(name, { start: i, end });
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
    decls.set(name, { start: i, end });
    i = end;
  }
}

// ── 校验白名单是否全部命中 ────────────────────────────────────────────
const missing = FUNCS.filter((n) => !decls.has(n));
if (missing.length) {
  console.error("MISSING declarations:", missing.join(", "));
  process.exit(1);
}

// ── 提取 send-test 内联路由块（按标记定位 + 花括号配对）────────────────
let sendTestStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('path === "/intelligence/send-test"')) {
    sendTestStart = i;
    break;
  }
}
if (sendTestStart < 0) {
  console.error("send-test route NOT FOUND");
  process.exit(1);
}
const sendTestEnd = scanBlock(sendTestStart);
const sendTestBlock = lines.slice(sendTestStart, sendTestEnd + 1).join("\n");

// ── 合并命名函数 span，按起始行排序 ────────────────────────────────────
const spans = FUNCS.map((n) => {
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

// ── 逐字节提取 ─────────────────────────────────────────────────────────
const blocks = merged.map(([s, e]) => lines.slice(s, e + 1).join("\n"));

const header = `// ═══════════════════════════════════════════════════════════════════
// Kim's Video — Digest Worker (mechanically sliced from workers-1.4.js)
// Routes: /intelligence/digest | subscribe | send-digest | send-test | unsubscribe
// 逐字节切片，逻辑零改动。迁移功能(/migrate/*)未分配阶段，未纳入。
// ═══════════════════════════════════════════════════════════════════
`;

// 路由骨架（send-test 内联块以变量插入，避免转义丢失 Bearer 串）
const router = `

// ═══════════════════════════════════════════════════════════════════
// Router（仅保留 digest 邮件端点 + cron）
// ═══════════════════════════════════════════════════════════════════
export default {
  async fetch(request, env, ctx) {
    // KV warm-up: ensure consistent reads after cold start / deploy
    ctx.waitUntil(env.SUBSCRIBE_KV?.get("__warmup").catch(() => {}));
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
      // Daily digest AI summary
      if (path === "/intelligence/digest") {
        try {
          return Response.json(await handleIntelDigest(env), { headers: corsHeaders });
        } catch (e) {
          return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
        }
      }
      // Unsubscribe page
      if (path === "/intelligence/unsubscribe") {
        return handleUnsubscribe(request, env);
      }
      // Fallback: health check
      return Response.json({ status: "ok", worker: "digest" }, { headers: corsHeaders });
    }

    // ── POST routes ──
    if (method === "POST") {
      // Subscribe
      if (path === "/intelligence/subscribe") {
        return handleSubscribe(request, env);
      }

      // Send digest (internal, authenticated)
      if (path === "/intelligence/send-digest") {
        return handleSendDigest(request, env);
      }

${sendTestBlock}

      // Unsubscribe (POST)
      if (path === "/intelligence/unsubscribe") {
        return handleUnsubscribe(request, env);
      }
    }

    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  },

  // ── Backup digest sender cron (06:35 Beijing; GH Actions 06:28 is primary) ──
  // Idempotent via KV "digestStatus:YYYY-MM-DD" guard — skips if today already sent.
  // NOTE: migratePurgeExpired 属于迁移功能（/migrate/*，未分配阶段），此处已移除。
  async scheduled(event, env, ctx) {
    const result = await sendDigestToAll(env);
    console.log("scheduled digest:", JSON.stringify(result));
  },
};
`;

const output = header + "\n" + blocks.join("\n\n") + router + "\n";
fs.writeFileSync(OUT, output, "utf8");

console.log("Extracted:", FUNCS.length, "functions + 1 inline route block");
console.log("send-test block: lines", sendTestStart + 1, "-", sendTestEnd + 1);
console.log("Output:", OUT, "(" + Buffer.byteLength(output, "utf8") + " bytes)");
