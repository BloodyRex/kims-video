// verify_admin.cjs — 独立复核：admin.js 命名函数/常量 + 路由块与原文件逐字节一致
const fs = require("fs");

const SRC = "workers-1.4.js";
const OUT = "workers/admin.js";

const NAMES = [
  "createAdminToken", "verifyAdminToken", "handleAdminResults", "handleAdminDelete",
  "handleAdminPatch", "deepMerge", "structClone", "getIntelConfig", "setIntelConfig",
  "DEFAULT_INTEL_CFG", "INTEL_CFG_CACHE_KEY",
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
        if (depth <= 0 && lines[j].trimEnd().endsWith(";")) { end = j; break; }
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
  else { bad++; console.error("DIFF:", n); }
}
console.log(`命名函数/常量逐字节一致: ${ok}/${NAMES.length}; 差异: ${bad}`);

// admin 路由块（4305-4339）逐字节
const srcLines = fs.readFileSync(SRC, "utf8").split("\n");
const outRaw = fs.readFileSync(OUT, "utf8");
const routesBlock = srcLines.slice(4304, 4339).join("\n");
const routesOk = outRaw.includes(routesBlock);
console.log(`admin 路由块(4305-4339) 逐字节一致: ${routesOk ? "YES" : "NO"}`);

// GitHub Bearer 串完整
console.log(`GitHub Bearer 串完整: ${outRaw.includes("Bearer ${token}") ? "YES" : "NO"}`);

process.exit(bad === 0 && routesOk ? 0 : 1);
