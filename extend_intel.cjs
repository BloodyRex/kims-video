// extend_intel.cjs — 扩展 intel.js：吸收通用 AI 代理 + ai-config + translate-overview + music/v2
// 用法: node extend_intel.cjs
// 从 workers-1.4.js 逐字节提取新函数/常量 + 路由，插入现有 workers/intel.js
const fs = require("fs");

const SRC = "workers-1.4.js";
const DST = "workers/intel.js";

// ── 新增函数（按名，机械提取）────────────────────────────────────────
const FUNCS = [
  "searchTMDBList",
  "fetchTMDBEnrichment",
  "translateText",
  "intelGenreZH",
  "intelEnrichAlbums",
  "handleIntelMusicV2",
];
const CONSTS = [
  "GENRE_ZH",
  "INTEL_TAG_CATEGORY",
];

const src = fs.readFileSync(SRC, "utf8");
const srcLines = src.split("\n");

function scanBlock(lines, fromIdx) {
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
for (let i = 0; i < srcLines.length; i++) {
  const fm = srcLines[i].match(/^(?:async\s+)?function\s+(\w+)/);
  if (fm) {
    const name = fm[1];
    const end = scanBlock(srcLines, i);
    decls.set(name, { start: i, end });
    i = end;
    continue;
  }
  const cm = srcLines[i].match(/^const\s+(\w+)\s*=/);
  if (cm) {
    const name = cm[1];
    let depth = 0, end = i;
    for (let j = i; j < srcLines.length; j++) {
      for (const ch of srcLines[j]) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }
      if (depth <= 0 && srcLines[j].replace(/\r$/, "").replace(/\/\/.*$/, "").trimEnd().endsWith(";")) { end = j; break; }
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
const newBlocks = merged.map(([s, e]) => srcLines.slice(s, e + 1).join("\n")).join("\n\n");

// ── 按行提取路由（0-based，已验证）──────────────────────────────────
const translateRoute = srcLines.slice(4170, 4186).join("\n");   // 4171-4186
const bodyParse = srcLines.slice(4268, 4270).join("\n");        // 4269-4270
const aiProxy = srcLines.slice(4274, 4300).join("\n");          // 4275-4300

// 手写短路由（无密钥）
const aiConfigRoute = '      // Public: AI-search recommendation ratio subset (no auth — only the ai.* knobs)\n      if (path === "/intelligence/ai-config") { const cfg = await getIntelConfig(env); return Response.json({ ai: cfg.ai }, { headers: corsHeaders }); }';
const musicV2Route = '      // Intelligence Music V2 (Pipeline-fed: POST candidates, returns AI-curated picks)\n      if (url.pathname === "/intelligence/music/v2") {\n        return handleIntelMusicV2(request, env);\n      }';

let intel = fs.readFileSync(DST, "utf8");

function mustReplaceOnce(content, oldStr, newStr, label) {
  const count = content.split(oldStr).length - 1;
  if (count !== 1) { console.error(`锚点不唯一 [${label}]: 命中 ${count} 次`); process.exit(1); }
  return content.replace(oldStr, newStr);
}

// a) 新函数/常量插到 export default 之前
intel = mustReplaceOnce(intel, "export default {", newBlocks + "\n\nexport default {", "blocks-before-export");

// b) ai-config 插到 GET health check 之前
intel = mustReplaceOnce(
  intel,
  '      // Fallback: health check\n      return Response.json({ status: "ok", worker: "intel" }, { headers: corsHeaders });',
  aiConfigRoute + '\n\n      // Fallback: health check\n      return Response.json({ status: "ok", worker: "intel" }, { headers: corsHeaders });',
  "ai-config-route"
);

// c) translate-overview + music/v2 + body parse + AI proxy 插到 hidden-gems 之后
const hiddenGemsBlock = '      // Hidden gems v2 (Pipeline-fed: POST today\'s movies/tv intelligence)\n      if (url.pathname === "/intelligence/hidden-gems") {\n        try { return Response.json(await handleIntelHiddenGems(request, env), { headers: corsHeaders }); }\n        catch (e) { return Response.json({ error: `hidden-gems: ${e.message}` }, { status: 500, headers: corsHeaders }); }\n      }';
const newPostBlock = hiddenGemsBlock + '\n\n' + translateRoute + '\n\n' + musicV2Route + '\n\n' + bodyParse + '\n\n' + aiProxy;
intel = mustReplaceOnce(intel, hiddenGemsBlock, newPostBlock, "hidden-gems-anchor");

fs.writeFileSync(DST, intel, "utf8");

console.log("扩展 intel.js：");
console.log("  - 新增函数/常量:", FUNCS.length + CONSTS.length, "个");
console.log("  - 新增路由: ai-config, translate-overview, music/v2, 通用 AI 代理");
console.log("Output:", DST, "(" + Buffer.byteLength(intel, "utf8") + " bytes)");
