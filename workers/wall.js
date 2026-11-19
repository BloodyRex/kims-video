// ═══════════════════════════════════════════════════════════════════
// Kim's Video — Wallpaper Worker (mechanically sliced from workers-1.4.js)
// Routes: /api/wall/config | /api/wall/gen
// 逐字节切片，逻辑零改动。仅 import 路径因文件移入 workers/ 调整为 ../config、../scripts。
// ═══════════════════════════════════════════════════════════════════

import WALL_THEMES from "../config/wallpaper-themes.json" with { type: "json" };
import WALL_SIZES from "../config/wallpaper-sizes.json" with { type: "json" };
// 壁纸生图辅助（纯函数：档位校验 / 交付决策 / 套装结构）。不含网络调用与密钥。
import {
  WALL_SEEDREAM_SPEC, WALL_PREVIEW_SIZES, WALL_FREE_DAILY_LIMIT,
  validateWallPixelRange, findTheme, pickSizeEntry, buildWallGenBody,
  isPaidEntitled, decideWallDelivery, wallDailyKey, normalizeBundle,
} from "../scripts/wall-worker-helpers.mjs";

export default {
  async fetch(request, env, ctx) {
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
      // Wallpaper config (read-only, GET) — 主题/尺寸唯一数据源 config/*.json 的运行时视图
      if (path === "/api/wall/config") {
        const themes = (WALL_THEMES.themes || []).map((t) => ({
          id: t.id, name: t.name, tagline: t.tagline, mood: t.mood,
          palette: t.palette, sample_prompt: t.sample_prompt, enabled: t.enabled !== false,
        }));
        return Response.json({
          version: WALL_THEMES.version, themes, sizes: WALL_SIZES.sizes,
          constraints: WALL_SIZES.provider_constraints, copyright_policy: WALL_THEMES.copyright_policy,
        }, { headers: corsHeaders });
      }
      return Response.json({ status: "ok", worker: "wall" }, { headers: corsHeaders });
    }

    // ── POST routes ──
    if (method === "POST") {
      // ── Wallpaper generation (阶段 1：校验齐备，ARK_API_KEY 未配置时明确返回 501) ──
      // 免费层只返回预览图；原图必须凭付费授权（entitlement.paid）才会下发。
      if (path === "/api/wall/gen") {
        let body = {};
        try { body = await request.json(); } catch { body = {}; }
        const themeId = String(body.theme_id || "");
        const device = body.device === "mobile" ? "mobile" : "desktop";
        const theme = findTheme(WALL_THEMES, themeId);
        if (!theme) {
          return Response.json({ ok: false, error: "unknown_or_disabled_theme" }, { status: 400, headers: corsHeaders });
        }
        // 套装结构预留：允许 items:[...]，当前只校验形状，不改变行为
        if (body.items != null) {
          const bundle = normalizeBundle(body.items);
          if (!bundle.ok) {
            return Response.json({ ok: false, error: "bad_bundle", detail: bundle.reason }, { status: 400, headers: corsHeaders });
          }
        }
        const decision = decideWallDelivery({
          entitlement: body.entitlement || null, device, theme, sizesJson: WALL_SIZES,
          requestedTier: body.tier || "pro",
        });
        if (!decision.ok) {
          return Response.json({ ok: false, error: "size_not_supported", detail: decision.reason }, { status: 400, headers: corsHeaders });
        }
        if (!env.ARK_API_KEY) {
          return Response.json({
            ok: false, error: "seedream_not_configured",
            detail: "ARK_API_KEY 未配置（wrangler secret put ARK_API_KEY）；未发起任何外部请求。",
            planned: { model: decision.tierName, size: `${decision.width}x${decision.height}`, mode: decision.mode, watermark: decision.watermark },
          }, { status: 501, headers: corsHeaders });
        }
        return Response.json({
          ok: false, error: "seedream_call_not_implemented_yet",
          detail: "阶段 1 仅完成参数校验与规格确认；真实调用待 API Key 与计费确认后接入。",
          plan: { model: decision.tierName, size: `${decision.width}x${decision.height}`, mode: decision.mode, watermark: decision.watermark, endpoint: WALL_SEEDREAM_SPEC.endpoint },
        }, { status: 501, headers: corsHeaders });
      }
    }

    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }
};
