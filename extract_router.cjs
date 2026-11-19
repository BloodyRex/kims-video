// extract_router.cjs — 生成 workers/router.js（路由层：poster-proxy 内置 + Service Bindings 分发 5 worker）
// 用法: node extract_router.cjs
// poster-proxy 从 workers-1.4.js 逐字节提取；分发逻辑为新增代码
const fs = require("fs");

const SRC = "workers-1.4.js";
const OUT = "workers/router.js";

const srcLines = fs.readFileSync(SRC, "utf8").split("\n");

// 提取 poster-proxy 路由（1-based 3938 → 0-based 3937）
const posterProxyLine = srcLines.findIndex((l) => l.includes('path === "/poster-proxy"'));
if (posterProxyLine < 0) { console.error("poster-proxy not found"); process.exit(1); }
const posterProxy = srcLines[posterProxyLine].trim();

const header = `// ═══════════════════════════════════════════════════════════════════
// Kim's Video — Router Worker（路由层）
// 内置 poster-proxy；按路径经 Service Bindings 分发到 5 个子 worker。
// 依赖 wrangler.toml 的 [[services]] 绑定：DISCOVER_WORKER / INTEL_WORKER /
// DIGEST_WORKER / ADMIN_WORKER / WALL_WORKER（Phase 4 接线时配置）。
// ═══════════════════════════════════════════════════════════════════
`;

const router = `
// ═══════════════════════════════════════════════════════════════════
// Dispatch
// ═══════════════════════════════════════════════════════════════════
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ── poster-proxy（内置，逐字节来自 workers-1.4.js 3938 行）──
    ${posterProxy}

    // ── discover-worker: /discover/*, /wall/*, /migrate/* ──
    if (path.startsWith("/discover/") || path.startsWith("/wall/") || path.startsWith("/migrate/")) {
      return env.DISCOVER_WORKER.fetch(request);
    }

    // ── admin-worker: /admin/* ──
    if (path.startsWith("/admin/")) {
      return env.ADMIN_WORKER.fetch(request);
    }

    // ── wall-worker: /api/wall/* ──
    if (path.startsWith("/api/wall/")) {
      return env.WALL_WORKER.fetch(request);
    }

    // ── /intelligence/* 拆分：digest 邮件端点 → digest，其余 → intel ──
    if (path.startsWith("/intelligence/")) {
      const digestPaths = [
        "/intelligence/digest",
        "/intelligence/subscribe",
        "/intelligence/send-digest",
        "/intelligence/send-test",
        "/intelligence/unsubscribe",
      ];
      if (digestPaths.includes(path)) {
        return env.DIGEST_WORKER.fetch(request);
      }
      return env.INTEL_WORKER.fetch(request);
    }

    // ── 通用 AI 代理 catch-all（前端 POST 到根路径 / 的 AI 搜索/推荐）→ intel ──
    if (method === "POST") {
      return env.INTEL_WORKER.fetch(request);
    }

    // ── 兜底：健康检查 ──
    return new Response(JSON.stringify({ status: "ok", worker: "router" }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  },
};
`;

const output = header + "\n" + router + "\n";
fs.writeFileSync(OUT, output, "utf8");

console.log("Generated:", OUT);
console.log("  - poster-proxy 逐字节来自原文件", posterProxyLine + 1, "行");
console.log("  - 分发: discover/admin/wall/intel/digest + AI catch-all");
console.log("  - 大小:", Buffer.byteLength(output, "utf8"), "bytes");
