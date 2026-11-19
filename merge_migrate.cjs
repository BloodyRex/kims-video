// merge_migrate.cjs — 把 /migrate/* 迁移功能机械并入 workers/discover.js
// 用法: node merge_migrate.cjs
// 从 workers-1.4.js 逐字节提取迁移代码，插入 discover.js 对应锚点
const fs = require("fs");

const SRC = "workers-1.4.js";
const DST = "workers/discover.js";

const srcLines = fs.readFileSync(SRC, "utf8").split("\n");

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

function findLine(lines, needle) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle)) return i;
  }
  return -1;
}

// 1) 迁移辅助区：3842-3908（含注释 + 4 常量 + 3 函数），即「// ── Main ──」之前
const mainIdx = findLine(srcLines, "// ── Main ──");
const migrateHeaderIdx = findLine(srcLines, "No-account personal-data migration (one-time relay)");
const migrateHelpers = srcLines.slice(migrateHeaderIdx, mainIdx).join("\n").replace(/\n+$/, "");

// 2) GET /migrate/:token 路由（含前置注释 4033）
const getIfIdx = findLine(srcLines, 'method === "GET" && path.startsWith("/migrate/")');
const getCommentIdx = getIfIdx - 1; // 前置注释行
const getRouteEnd = braceMatch(srcLines, getIfIdx);
const getRoute = srcLines.slice(getCommentIdx, getRouteEnd + 1).join("\n");

// 3) POST /migrate/create 路由（含前置注释 4091-4093）
const postIfIdx = findLine(srcLines, 'path === "/migrate/create"');
const postCommentIdx = postIfIdx - 3; // 三行前置注释
const postRouteEnd = braceMatch(srcLines, postIfIdx);
const postRoute = srcLines.slice(postCommentIdx, postRouteEnd + 1).join("\n");

// 4) scheduled 处理器（仅迁移清理部分，原 scheduled 里的 digest 部分归 digest-worker）
const scheduledHandler = `  },

  // ── Nightly: purge expired personal-data migration blobs from R2 ──
  // Isolated so a purge failure can never affect the discover endpoints.
  async scheduled(event, env, ctx) {
    try {
      const purged = await migratePurgeExpired(env);
      console.log("scheduled migrate-purge:", JSON.stringify(purged));
    } catch (e) {
      console.log("scheduled migrate-purge failed:", e && e.message);
    }
  },
};`;

let disc = fs.readFileSync(DST, "utf8");

// 锚点插入（均需唯一命中）
function mustReplaceOnce(content, oldStr, newStr, label) {
  const count = content.split(oldStr).length - 1;
  if (count !== 1) {
    console.error(`锚点不唯一 [${label}]: 命中 ${count} 次`);
    process.exit(1);
  }
  return content.replace(oldStr, newStr);
}

// a) 迁移辅助区插到 Main Worker Export 之前
disc = mustReplaceOnce(
  disc,
  "// ── Main Worker Export ──",
  migrateHelpers + "\n\n// ── Main Worker Export ──",
  "helpers-before-export"
);

// b) GET 路由插到 Health check 之前
disc = mustReplaceOnce(
  disc,
  "      // Health check",
  getRoute + "\n\n      // Health check",
  "get-route-before-health"
);

// c) POST 路由插到 POST 块开头（if (method === "POST") { 之后）
disc = mustReplaceOnce(
  disc,
  "    if (method === \"POST\") {\n      let body;",
  "    if (method === \"POST\") {\n" + postRoute + "\n\n      let body;",
  "post-route-after-post-open"
);

// d) scheduled 处理器替换 export default 尾部
disc = mustReplaceOnce(
  disc,
  '    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });\n  }\n};',
  '    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });\n' + scheduledHandler,
  "scheduled-tail"
);

fs.writeFileSync(DST, disc, "utf8");

console.log("已并入 discover.js：");
console.log("  - 迁移辅助区:", migrateHeaderIdx + 1, "-", mainIdx, "行 (" + migrateHelpers.split("\n").length + " 行)");
console.log("  - GET 路由:", getCommentIdx + 1, "-", getRouteEnd + 1);
console.log("  - POST 路由:", postCommentIdx + 1, "-", postRouteEnd + 1);
console.log("  - scheduled 处理器: 已添加");
console.log("输出:", DST, "(" + Buffer.byteLength(disc, "utf8") + " bytes)");
