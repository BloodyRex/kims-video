// verify_extend.cjs — 独立复核：扩展后 intel.js 的新增函数/常量/路由与原文件逐字节一致
const fs = require("fs");

const SRC = "workers-1.4.js";
const DST = "workers/intel.js";

const NAMES = [
  "searchTMDBList", "fetchTMDBEnrichment", "translateText", "intelGenreZH",
  "intelEnrichAlbums", "handleIntelMusicV2", "GENRE_ZH", "INTEL_TAG_CATEGORY",
];

function extractNamed(file) {
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
    const fm = lines[i].match(/^(?:async\s+)?function\s+(\w+)/);
    if (fm) {
      const name = fm[1];
      const end = scanBlock(i);
      decls.set(name, lines.slice(i, end + 1).join("\n"));
      i = end;
      continue;
    }
    const cm = lines[i].match(/^const\s+(\w+)\s*=/);
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
      decls.set(name, lines.slice(i, end + 1).join("\n"));
      i = end;
    }
  }
  return decls;
}

const srcNamed = extractNamed(SRC);
const dstNamed = extractNamed(DST);
let ok = 0, bad = 0;
for (const n of NAMES) {
  const s = srcNamed.get(n), o = dstNamed.get(n);
  if (s === undefined) { console.error("SRC missing:", n); bad++; continue; }
  if (o === undefined) { console.error("DST missing:", n); bad++; continue; }
  if (s === o) ok++;
  else { bad++; console.error("DIFF:", n, "(src " + s.length + " vs dst " + o.length + ")"); }
}
console.log(`新增函数/常量逐字节一致: ${ok}/${NAMES.length}; 差异: ${bad}`);

// 路由逐字节
const srcLines = fs.readFileSync(SRC, "utf8").split("\n");
const dstRaw = fs.readFileSync(DST, "utf8");
const translateOk = dstRaw.includes(srcLines.slice(4170, 4186).join("\n"));
const aiProxyOk = dstRaw.includes(srcLines.slice(4274, 4300).join("\n"));
const bodyParseOk = dstRaw.includes(srcLines.slice(4268, 4270).join("\n"));
console.log(`translate-overview 路由: ${translateOk ? "一致 ✓" : "不一致 ✗"}`);
console.log(`AI 代理路由: ${aiProxyOk ? "一致 ✓" : "不一致 ✗"}`);
console.log(`body 解析: ${bodyParseOk ? "一致 ✓" : "不一致 ✗"}`);

// 敏感串完整（DeepSeek Bearer）
const bearer = (dstRaw.match(/Bearer/g) || []).length;
console.log(`Bearer 串: ${bearer} 处（translateText + AI代理 + intelEnrichAlbums + handleIntelMusicV2 等）`);

// ai-config + music/v2 路由存在
console.log(`ai-config 路由: ${dstRaw.includes('path === "/intelligence/ai-config"') ? "存在 ✓" : "缺失 ✗"}`);
console.log(`music/v2 路由: ${dstRaw.includes('url.pathname === "/intelligence/music/v2"') ? "存在 ✓" : "缺失 ✗"}`);

process.exit(bad === 0 && translateOk && aiProxyOk ? 0 : 1);
