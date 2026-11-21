// ═══════════════════════════════════════════════════════════════════
// Kim's Video — Router Worker（路由层）
// 内置 poster-proxy；按路径经 Service Bindings 分发到 5 个子 worker。
// 依赖 wrangler.toml 的 [[services]] 绑定：DISCOVER_WORKER / INTEL_WORKER /
// DIGEST_WORKER / ADMIN_WORKER / WALL_WORKER（Phase 4 接线时配置）。
// ═══════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════
// Dispatch
// ═══════════════════════════════════════════════════════════════════
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ── CORS preflight（浏览器跨域 OPTIONS）──
    // 前端 POST 带 Content-Type: application/json 会触发预检；子 worker
    // 各自处理 OPTIONS，但路由层必须先放行，否则预检在 catch-all 被吞。
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // ── poster-proxy（内置，逐字节来自 workers-1.4.js 3938 行）──
    if (path === "/poster-proxy") { const iu = url.searchParams.get("url"); if (!iu) return new Response("Missing url", { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }); if (!iu.startsWith("https://image.tmdb.org/") && !iu.startsWith("https://coverartarchive.org/")) return new Response("Forbidden", { status: 403, headers: { "Access-Control-Allow-Origin": "*" } }); try { const cacheKey = new Request(`https://poster-cache/${encodeURIComponent(iu)}`); const cached = await caches.default.match(cacheKey); if (cached) return cached; const ir = await fetch(iu); const nh = new Headers(ir.headers); nh.set("Access-Control-Allow-Origin", "*"); nh.set("Cache-Control", "public, max-age=86400"); const resp = new Response(ir.body, { status: ir.status, headers: nh }); if (ir.ok) caches.default.put(cacheKey, resp.clone()); return resp; } catch (e) { return new Response("Proxy error", { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }); } }

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

