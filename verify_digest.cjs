// verify_digest.cjs — 独立复核：digest.js 每个提取块与原文件逐字节一致 + 敏感串完整
const fs = require("fs");

const SRC = "workers-1.4.js";
const OUT = "workers/digest.js";

const FUNCS = [
  "withCache", "intelToday", "intelDaysAgo", "intelParseJSON", "intelFetchTMDB",
  "handleIntelDigest", "handleUnsubscribe", "handleSubscribe", "fetchDigestData",
  "buildWeeklyWorkIndex", "weeklyLockedWorks", "weekStartOf", "renderDigestHtml",
  "digestShownKeys", "pickTodayStar", "buildDigestHTML", "handleSendDigest",
  "withTimeout", "sendDigestToAll",
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
    }
  }
  return decls;
}

// 1) 命名函数逐字节比对
const srcNamed = extractNamed(SRC);
const outNamed = extractNamed(OUT);
let ok = 0, bad = 0;
for (const n of FUNCS) {
  const s = srcNamed.get(n), o = outNamed.get(n);
  if (s === undefined) { console.error("SRC missing:", n); bad++; continue; }
  if (o === undefined) { console.error("OUT missing:", n); bad++; continue; }
  if (s === o) ok++;
  else { bad++; console.error("DIFF:", n, "(src " + s.length + " vs out " + o.length + ")"); }
}
console.log(`命名函数逐字节一致: ${ok}/${FUNCS.length}; 差异: ${bad}`);

// 2) send-test 内联块逐字节比对
const srcLines = fs.readFileSync(SRC, "utf8").split("\n");
const outLines = fs.readFileSync(OUT, "utf8").split("\n");
function findSendTest(lines) {
  let s = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('path === "/intelligence/send-test"')) { s = i; break; }
  }
  let depth = 0, e = s;
  for (let j = s; j < lines.length; j++) {
    for (const ch of lines[j]) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    if (depth <= 0 && j >= s) { e = j; break; }
  }
  return lines.slice(s, e + 1).join("\n");
}
const srcSt = findSendTest(srcLines);
const outSt = findSendTest(outLines);
const stMatch = srcSt === outSt;
console.log(`send-test 块逐字节一致: ${stMatch ? "YES" : "NO"}` + (stMatch ? "" : ` (src ${srcSt.length} vs out ${outSt.length})`));

// 3) 敏感串完整性（确认未被 read_file 脱敏影响，因本脚本直读磁盘）
const outRaw = fs.readFileSync(OUT, "utf8");
const checks = [
  ["RESEND_API_KEY 串", 'Bearer ${env.RESEND_API_KEY}'],
  ["DIGEST_SECRET 串", 'Bearer ${env.DIGEST_SECRET}'],
  ["TMDB token 串", 'Bearer ${token}'],
];
for (const [label, needle] of checks) {
  console.log(`${label}: ${outRaw.includes(needle) ? "完整" : "缺失/被脱敏"}`);
}

process.exit(bad === 0 && stMatch ? 0 : 1);
