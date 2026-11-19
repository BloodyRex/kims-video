// verify_discover.cjs — 独立复核：重切片 discover.js 与原文件逐字节一致 + 前缀修复 + 无 shared 依赖
const fs = require("fs");

const SRC = "workers-1.4.js";
const OUT = "workers/discover.js";

const NAMES = [
  "fetchEnglishPoster", "withCache", "fetchTMDBDetails", "fetchTMDBByType",
  "genId", "handleDiscoverList", "handleDiscoverCreate", "collectWallRecs",
  "handleDiscoverLike", "handleDiscoverUpload", "intelToday", "mapLimit",
  "migrateRandomToken", "migrateValidateBlob", "migratePurgeExpired",
  "MAP_LIMIT_DEFAULT", "MIGRATE_PREFIX", "MIGRATE_TTL_SECONDS",
  "MIGRATE_MAX_BLOB_BYTES", "MIGRATE_TOKEN_RE",
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
const outNamed = extractNamed(OUT);
let ok = 0, bad = 0;
for (const n of NAMES) {
  const s = srcNamed.get(n), o = outNamed.get(n);
  if (s === undefined) { console.error("SRC missing:", n); bad++; continue; }
  if (o === undefined) { console.error("OUT missing:", n); bad++; continue; }
  if (s === o) ok++;
  else { bad++; console.error("DIFF:", n, "(src " + s.length + " vs out " + o.length + ")"); }
}
console.log(`命名函数/常量逐字节一致: ${ok}/${NAMES.length}; 差异: ${bad}`);

// 路由块逐字节
const srcLines = fs.readFileSync(SRC, "utf8").split("\n");
const outRaw = fs.readFileSync(OUT, "utf8");
function braceMatch(fromIdx) {
  let depth = 0;
  for (let j = fromIdx; j < srcLines.length; j++) {
    for (const ch of srcLines[j]) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    if (depth <= 0 && j >= fromIdx) return j;
  }
  return srcLines.length - 1;
}
function routeOk(marker, prev) {
  const idx = srcLines.findIndex((l) => l.includes(marker));
  const end = braceMatch(idx);
  return outRaw.includes(srcLines.slice(idx - prev, end + 1).join("\n"));
}
console.log(`wall/recs 路由: ${routeOk('path === "/wall/recs"', 0) ? "一致 ✓" : "不一致 ✗"}`);
console.log(`migrate GET 路由: ${routeOk('method === "GET" && path.startsWith("/migrate/")', 1) ? "一致 ✓" : "不一致 ✗"}`);
console.log(`migrate POST 路由: ${routeOk('path === "/migrate/create"', 3) ? "一致 ✓" : "不一致 ✗"}`);
console.log(`wall/collect 路由: ${routeOk('path === "/wall/collect"', 1) ? "一致 ✓" : "不一致 ✗"}`);

// 前缀修复 + 去 shared + Bearer 完整
const buggy = (outRaw.match(/discover:result:/g) || []).length;
const correct = (outRaw.match(/prefix: "result:"/g) || []).length;
const shared = (outRaw.match(/src\/shared/g) || []).length;
const bearer = (outRaw.match(/Bearer/g) || []).length;
console.log(`\n前缀修复: discover:result: 出现 ${buggy} 次（应0），prefix:"result:" ${correct} 次（应1）`);
console.log(`shared 依赖: ${shared} 处（应0）`);
console.log(`Bearer 串: ${bearer} 处（应2，TMDB 详情+英文海报）`);

process.exit(bad === 0 && buggy === 0 && correct === 1 && shared === 0 ? 0 : 1);
