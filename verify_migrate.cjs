// verify_migrate.cjs — 独立复核：discover.js 中的迁移代码与原文件逐字节一致
const fs = require("fs");

const SRC = "workers-1.4.js";
const DST = "workers/discover.js";

const src = fs.readFileSync(SRC, "utf8");
const dst = fs.readFileSync(DST, "utf8");
const srcLines = src.split("\n");

function braceMatch(lines, fromIdx) {
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

// 1) 迁移辅助区（3842 → 「// ── Main ──」之前）
const mainIdx = srcLines.findIndex((l) => l.includes("// ── Main ──"));
const headerIdx = srcLines.findIndex((l) => l.includes("No-account personal-data migration (one-time relay)"));
const helpersSrc = srcLines.slice(headerIdx, mainIdx).join("\n").replace(/\n+$/, "");

// 2) GET 路由
const getIfIdx = srcLines.findIndex((l) => l.includes('method === "GET" && path.startsWith("/migrate/")'));
const getEnd = braceMatch(srcLines, getIfIdx);
const getSrc = srcLines.slice(getIfIdx - 1, getEnd + 1).join("\n");

// 3) POST 路由
const postIfIdx = srcLines.findIndex((l) => l.includes('path === "/migrate/create"'));
const postEnd = braceMatch(srcLines, postIfIdx);
const postSrc = srcLines.slice(postIfIdx - 3, postEnd + 1).join("\n");

const results = [
  ["迁移辅助区", helpersSrc],
  ["GET /migrate/:token 路由", getSrc],
  ["POST /migrate/create 路由", postSrc],
];

let ok = 0, bad = 0;
for (const [label, expected] of results) {
  const found = dst.includes(expected);
  console.log(`${label}: ${found ? "逐字节一致 ✓" : "不一致 ✗"}`);
  found ? ok++ : bad++;
}

// 4) scheduled 处理器存在且调用 migratePurgeExpired
const schedOk = dst.includes("async scheduled(event, env, ctx)") && dst.includes("await migratePurgeExpired(env)");
console.log(`scheduled 处理器调用 migratePurgeExpired: ${schedOk ? "✓" : "✗"}`);
if (schedOk) ok++; else bad++;

// 5) 无敏感串丢失（discover 原本就有的 Bearer 仍在）
const bearerCount = (dst.match(/Bearer/g) || []).length;
console.log(`Bearer 出现次数（应≥2，discover 原有 TMDB 2处）: ${bearerCount}`);
if (bearerCount >= 2) ok++; else bad++;

console.log(`\n复核通过: ${ok}; 失败: ${bad}`);
process.exit(bad === 0 ? 0 : 1);
