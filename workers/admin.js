// ═══════════════════════════════════════════════════════════════════
// Kim's Video — Admin Worker (mechanically sliced from workers-1.4.js)
// Routes: /admin/login | /admin/results | /admin/config | /admin/set-authorization
// 逐字节切片，逻辑零改动。
// ═══════════════════════════════════════════════════════════════════

function createAdminToken(password) { return btoa(password + ":" + (Date.now() + 7200000)); }
function verifyAdminToken(token, password) { try { const d = atob(token); const s = d.lastIndexOf(":"); if (s < 0) return false; return d.slice(0,s) === password && Date.now() < parseInt(d.slice(s+1)); } catch { return false; } }

async function handleAdminResults(env) { if (!env.DISCOVER_KV) return { results: [] }; const { keys } = await env.DISCOVER_KV.list({ prefix: "result:", limit: 100 }); const results = []; for (const k of keys) { try { const raw = await env.DISCOVER_KV.get(k.name, "json"); if (raw) results.push(raw); } catch {} } results.sort((a,b) => b.createdAt.localeCompare(a.createdAt)); return { results }; }
async function handleAdminDelete(env, id) { if (!env.DISCOVER_KV) return { error: "KV not configured" }; await env.DISCOVER_KV.delete(`result:${id}`); return { deleted: id }; }
async function handleAdminPatch(env, id, body) { if (!env.DISCOVER_KV) return { error: "KV not configured" }; const raw = await env.DISCOVER_KV.get(`result:${id}`, "json"); if (!raw) return { error: "not_found" }; if (body.genre) raw.genre = body.genre; await env.DISCOVER_KV.put(`result:${id}`, JSON.stringify(raw)); return raw; }

const DEFAULT_INTEL_CFG = {
  movie: {
    sources: {                                   // import sources: 打勾是否收录 + 抓取页数
      nowPlayingUS:  { enabled: true, pages: 2 },// 美国在映:每页20部,取最近2页
      nowPlayingCN:  { enabled: true, pages: 2 },// 中国内地院线(牛来等国内上映但未进美区的片)
      recently90d:   { enabled: true, pages: 3 },// 过去90天discover(补非美小片)
      upcoming90d:   { enabled: true, pages: 1 },// 未来90天discover(即将上映池)
    },
    gateNow: {                                   // 正在热映"质量复合门槛"(gateNowPlaying)
      wRating: 0.7, wPop: 0.3, floor: 6.0,       // score=wRating×分 + wPop×pop10 ≥ floor
      popScale: 10, popCap10: 10,                // pop10=min(popCap10, pop/popScale)
      cnFloorPopularity: 8, cnFloorRating: 2,    // 国产片放宽: 仅需热度≥8且分≥2
    },
    reserve: { zh: 0, ja: 0, ko: 0 },            // 地区保底名额: 全部关闭(2026-08-28 Rex决策)
    weekBack: 10,                                // "本周"窗口: 近N天起的上映(CN日二次分桶)
    score:     { w_pop: 0.25, w_date: 0.55, w_qual: 0.20, hlFuture: 14, hlPast: 7 },
  },
  tv: {
    sources: {                                   // all sources: 数据勾选 + 抓取规模
      onTheAir:           { enabled: true, pages: 2 },// 排播中剧(未来7天有新集) TMDB
      discoverUpcoming:   { enabled: true, pages: 1 },// TMDB discover 未来90天首播
      tvmazePremiere:     { enabled: true, offsets: [0, 1, 2, 3] },// TVMAZE 未来0-3天首播
      tvmazeUpcoming:     { enabled: true, offsets: [7, 14] },     // TVMAZE 未来+7/+14天首播
      trendingWeek:       { enabled: true, pages: 3 },// 本周最热(TMDB) 60部 —— 补"整季放出"剧
    },
    yearCutoff: 2010,                            // 超长连载剧首播年份>=此值(数值比较)
    popFloor: 30,                                // ongoing 热播剧最低popularity
    reserve: { cn: 0, hmt: 0, jp: 0, kr: 0 },    // 地区保底: 全部关闭(2026-08-28 Rex决策)
    ongoingTier1: 10,                            // 近30天活跃剧抢先名额
        ongoingTier2: 5,                             // 其余剧补充名额
        ongoingDetailCap: 8,                         // 热播剧 episode detail 回填上限(防50子请求超限)
    detailBudget: 12,                            // premieres+ongoing 共享的 episode-detail 总预算(防50子请求超限)
    upcomingScore: { wDate: 0.5, wPop: 0.3, wZh: 0.1, wRating: 0.1 }, // 即将播出评分权重(日期/热度/中文/评分) 四者和=1; wPop 2026-09-04 加(池内min-max软信号),修 dateScore 全打平
    score:     { w_pop: 0.25, w_date: 0.45, w_qual: 0.30, hlFuture: 14, hlPast: 7 },
  },
  ai: {                                          // AI 搜索推荐"恰好5部"的分类配比
    recRatio: { total: 5, popular: 2, hidden: 2, controversial: 1 }, // 前N热门/中N冷门/末N争议
    fillPopularDesc: "高评分、高知名度的大众热门影片",
    fillHiddenDesc: "高品质冷门/小众/独立影片",
    fillControversialDesc: "评价存在争议、口碑两极分化的影片",
  },
  // ── 评分可信度 (2026-09-03 Rex 决策，IMDb 贝叶斯加权) ──
  // 主方案：把"评分人数"纳入评分本身——票数越少的分越不可信，被拉向中性基准 C。
  //   R加权 = (v/(v+m))×R + (m/(v+m))×C   (R=TMDB评分, v=vote_count, m=minVotes, C=meanRating)
  // 已上映/已开播的普通来源用加权分；upcoming/premiere/TVMAZE 天然无票，不适用，跳过。
  // 可选硬下限 minVoteCountHard 默认关：开启后对普通来源 .filter(v>=minVotes)，
  // 但默认用贝叶斯加权自然压尾更稳妥，不误伤上映首周新片。
  credibility: {
    minVotes: 20,            // m：最小票数阈值（普通来源；CN池用 cnMinVotes）
    meanRating: 6.0,         // C：中性基准分，票数→0 时 R加权→C
    cnMinVotes: 20,          // 国产/华语池阈值。实测(2026-09-03)国产池中位数95反而高于非CN(24)，
                             // 故默认与全局一致、不额外放宽；留作可调应对未来数据分布变化
    minVoteCountHard: false, // 可选硬下限，默认关（贝叶斯加权已足够，硬砍易误伤新片）
  },
};

function deepMerge(base, over) {
  if (over == null || typeof over !== "object" || Array.isArray(over)) return over === undefined ? base : over;
  if (typeof base !== "object" || base === null || Array.isArray(base)) return over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = deepMerge(base[k], over[k]);
  return out;
}
function structClone(obj) { return typeof structuredClone === "function" ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)); }

const INTEL_CFG_CACHE_KEY = "intelcfg:v1";

async function getIntelConfig(env) {
  const mergedWith = async (saved) => deepMerge(structClone(DEFAULT_INTEL_CFG), saved || {});
  try {
    const c = caches.default;
    const req = new Request(`https://intelcfg/${INTEL_CFG_CACHE_KEY}`);
    const hit = await c.match(req);
    if (hit) { try { return await mergedWith(await hit.json()); } catch (e) {} }
  } catch (e) {}
  let saved = null;
  if (env?.DISCOVER_KV) { try { saved = await env.DISCOVER_KV.get("intel:cfg", "json"); } catch (e) {} }
  const merged = await mergedWith(saved);
  try {
    const resp = new Response(JSON.stringify(merged), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } });
    caches.default.put(new Request(`https://intelcfg/${INTEL_CFG_CACHE_KEY}`), resp.clone());
  } catch (e) {}
  return merged;
}
async function setIntelConfig(env, body) {
  if (!env?.DISCOVER_KV) return { error: "KV not configured" };
  const merged = deepMerge(structClone(DEFAULT_INTEL_CFG), body && typeof body === "object" ? body : {});
  await env.DISCOVER_KV.put("intel:cfg", JSON.stringify(merged));
  try { await caches.default.delete(new Request(`https://intelcfg/${INTEL_CFG_CACHE_KEY}`)); } catch (e) {}
  return merged;
}

// ═══════════════════════════════════════════════════════════════════
// Router（仅 admin 端点）
// ═══════════════════════════════════════════════════════════════════
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
    const auth = request.headers.get("Authorization");
    const token = auth ? auth.replace("Bearer ", "") : "";

    // ── Admin auth check helper ──
    const requireAdmin = () => { if (!token || !verifyAdminToken(token, env.ADMIN_PASSWORD)) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders }); return null; };

    // ── GET routes ──
    if (method === "GET") {
      if (path === "/admin/results") { const err = requireAdmin(); if (err) return err; try { return Response.json(await handleAdminResults(env), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }
      if (path === "/admin/config") { const err = requireAdmin(); if (err) return err; try { return Response.json(await getIntelConfig(env), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }
      return Response.json({ status: "ok", worker: "admin" }, { headers: corsHeaders });
    }

    // ── POST routes ──
    if (method === "POST") {
      if (path === "/admin/login") { let b; try { b = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); } if (!env.ADMIN_PASSWORD) return Response.json({ error: "Admin not configured" }, { headers: corsHeaders }); if (b.password !== env.ADMIN_PASSWORD) return Response.json({ error: "Invalid password" }, { headers: corsHeaders }); return Response.json({ token: createAdminToken(env.ADMIN_PASSWORD) }, { headers: corsHeaders }); }
    }

    // ── PATCH / DELETE routes（原文件 4305-4339 逐字节） ──
        // PATCH /admin/config — update intelligence parameters (partial JSON merge)
        if (path === "/admin/config" && method === "PATCH") {
          const er = requireAdmin(); if (er) return er;
          let b; try { b = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); }
          try { return Response.json(await setIntelConfig(env, b), { headers: corsHeaders }); }
          catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); }
        }

        // POST /admin/set-authorization — trigger GitHub Actions workflow_dispatch
        if (path === "/admin/set-authorization" && method === "POST") {
          const er = requireAdmin(); if (er) return er;
          let b; try { b = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); }
          const { edition_id, authorization } = b;
          if (!edition_id || !authorization) return Response.json({ error: "edition_id and authorization required" }, { status: 400, headers: corsHeaders });
          if (!["granted","testing","pending"].includes(authorization)) return Response.json({ error: "invalid authorization value" }, { status: 400, headers: corsHeaders });
          const token = env.GITHUB_TOKEN;
          if (!token) return Response.json({ error: "GITHUB_TOKEN not configured" }, { status: 500, headers: corsHeaders });
          const repo = env.GITHUB_REPO || "BloodyRex/kims-video";
          const [owner, name] = repo.split("/");
          try {
            const resp = await fetch(`https://api.github.com/repos/${owner}/${name}/actions/workflows/set-authorization.yml/dispatches`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
              body: JSON.stringify({ ref: "main", inputs: { edition_id, authorization } }),
            });
            if (!resp.ok) return Response.json({ error: `GitHub API ${resp.status}: ${await resp.text()}` }, { status: 502, headers: corsHeaders });
            return Response.json({ ok: true, edition_id, authorization, workflow: "set-authorization" }, { headers: corsHeaders });
          } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); }
        }

        const adm = path.match(/^\/admin\/results\/(.+)$/);
        if (adm) {
      if (method === "DELETE") { const er = requireAdmin(); if (er) return er; try { return Response.json(await handleAdminDelete(env, adm[1]), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }
      if (method === "PATCH") { const er = requireAdmin(); if (er) return er; let b; try { b = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); } try { return Response.json(await handleAdminPatch(env, adm[1], b), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }
    }

    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }
};

