// ═══════════════════════════════════════════════════════════════════
// Kim's Video — Discover Worker (mechanically sliced from workers-1.4.js)
// Routes: /discover/*, /wall/collect, /wall/recs, /migrate/*, scheduled(purge)
// 逐字节切片，逻辑零改动。KV key 前缀保持原文 result: / wallRec:。
// ═══════════════════════════════════════════════════════════════════

async function fetchEnglishPoster(tmdbId, type, token) { const d = await withCache(`${tmdbId}-${type}-poster`, async () => { const r = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/images?include_image_language=en,null`, { headers: { Authorization: `Bearer ${token}` } }); return r.ok ? r.json() : null; }); if (!d) return null; const p = d?.posters || []; const ep = p.find(x => x.iso_639_1 === "en") || p[0]; return ep ? `https://image.tmdb.org/t/p/w342${ep.file_path}` : null; }

async function withCache(key, fetcher, ttl = 86400) { const c = caches.default; const r = new Request(`https://tmdb-cache/${key}`); const h = await c.match(r); if (h) { console.log("[CACHE HIT]", key); return h.json(); } console.log("[CACHE MISS]", key); const d = await fetcher(); // Empty arrays are NOT valid results (2026-08-24): a subrequest-budget blowup
  // mid-handler once cached on_the_air=[] for a full TTL, and the pipeline's
  // US-edge colo kept serving that poisoned entry → 热播中 went blank site-wide
  // while the Asia colo (manually warmed) looked fine. Treat [] as failure so
  // the next caller re-fetches instead of inheriting the empty answer.
  if (!d || (Array.isArray(d) && d.length === 0)) return null; const resp = new Response(JSON.stringify(d), { headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${ttl}` } }); c.put(r, resp.clone()); return d; }

async function fetchTMDBDetails(tmdbId, token, language, opts = {}) {
  language = language || "zh-CN";
  const movieOnly = !!opts.movieOnly; // wall collection: movies only — TV must NOT enter the wall
  let d = await fetchTMDBByType(tmdbId, "movie", token, language);
  if (d) return d;
  if (movieOnly) return null; // movie lookup failed → it's a TV show (or invalid); never fall through to tv
  d = await fetchTMDBByType(tmdbId, "tv", token, language);
  return d || {};
}

async function fetchTMDBByType(tmdbId, type, token, language) { language = language || "zh-CN"; try { const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }; const det = await withCache(`${tmdbId}-${type}-${language}-details`, async () => { const r = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?language=${language}`, { headers: h }); return r.ok ? r.json() : null; }); if (!det) return null; const cr = await withCache(`${tmdbId}-${type}-${language}-credits`, async () => { const r = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/credits?language=${language}`, { headers: h }); return r.ok ? r.json() : { crew: [] }; }) || { crew: [] }; const director = cr.crew?.find(c => c.job === "Director")?.name || ""; const yr = det.release_date ? det.release_date.slice(0,4) : det.first_air_date ? det.first_air_date.slice(0,4) : ""; const tLabel = type === "movie" ? (language.startsWith("zh") ? "电影" : "Movie") : (language.startsWith("zh") ? "剧集" : "TV Series"); const cast = cr.cast?.slice(0,5).map(c => c.name) || []; let poster = det.poster_path ? `https://image.tmdb.org/t/p/w342${det.poster_path}` : null; if (poster) { const ep = await fetchEnglishPoster(tmdbId, type, token); if (ep) poster = ep; } return { director, year: yr, originalTitle: det.original_title || det.original_name || "", type: tLabel, title: det.title || det.name || "", imdb_id: det.imdb_id || "", poster, overview: det.overview || "", genres: (det.genres || []).map(g => g.name), vote_average: det.vote_average || null, runtime: det.runtime || null, cast, release_date: det.release_date || det.first_air_date || "" }; } catch (e) { return null; } }

function genId() { return crypto.randomUUID(); } function nowISO() { return new Date().toISOString(); }

async function handleDiscoverList(env, url) { const genre = url.searchParams.get("genre") || ""; const sort = url.searchParams.get("sort") || "newest"; const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50); if (!env.DISCOVER_KV) return { results: [], hasMore: false }; const opts = { limit: limit + 1 }; const { keys, cursor: nc, list_complete } = await env.DISCOVER_KV.list({ prefix: "result:", ...opts }); const raws = await Promise.all(keys.map(k => env.DISCOVER_KV.get(k.name, "json").catch(() => null))); const results = raws.filter(raw => raw && (!genre || raw.genre === genre)); results.sort(sort === "popular" ? (a,b) => (b.likes||0) - (a.likes||0) : (a,b) => b.createdAt.localeCompare(a.createdAt)); return { results: results.slice(0, limit), hasMore: results.length > limit, cursor: list_complete ? null : nc }; }

async function handleDiscoverCreate(env, body) { const { sourceMovies, recommendations, genre, contributorName } = body; if (!sourceMovies?.length || !recommendations?.length || !genre) return { error: "Missing fields" }; if (!Array.isArray(sourceMovies) || sourceMovies.length > 2) return { error: "sourceMovies: 1-2" }; if (!Array.isArray(recommendations) || recommendations.length > 5) return { error: "recommendations: max 5" }; if (!env.DISCOVER_KV) return { error: "KV not configured" }; const id = genId(); const doc = { id, createdAt: nowISO(), contributorName: (contributorName || "").trim().slice(0, 30) || "匿名用户", sourceMovies: sourceMovies.map(m => ({ title: m.title || "", titleEn: m.titleEn || "", year: m.year || "", tmdbId: m.tmdbId || null })), recommendations: recommendations.map(r => ({ tmdbId: r.tmdbId || null, title: r.title || "", titleEn: r.titleEn || "", year: r.year || "", director: r.director || "", type: r.type || "", reason: r.reason || "", matchedTags: r.matchedTags || [] })), genre, thumbnail: body.thumbnail || "", likes: 0 }; await env.DISCOVER_KV.put(`result:${id}`, JSON.stringify(doc)); return doc; }

async function collectWallRecs(env, items) {
  if (!env?.DISCOVER_KV || !Array.isArray(items) || !items.length) return { added: 0, skipped: 0 };
  const today = intelToday();
  let added = 0, skipped = 0;
  for (const it of items) {
    if (!it || it.tmdbId == null) { skipped++; continue; }
    const id = String(it.tmdbId);
    const key = `wallRec:${id}`;
    if (await env.DISCOVER_KV.get(key).catch(() => null)) { skipped++; continue; }
    try {
      // Wall is MOVIES ONLY — a TV-only tmdbId must not enter the wall.
      const det = await fetchTMDBDetails(parseInt(id), env.TMDB_API_READ_ACCESS_TOKEN, "zh-CN", { movieOnly: true });
      if (!det?.title) { skipped++; continue; }
      const entry = {
        tmdbId: parseInt(id),
        mediaType: "movie", // wall rule: cards must be films, TV goes to a future 剧集墙
        title: det.title || it.title || "",
        titleEn: det.originalTitle || it.title || "",
        year: det.year || String(it.year || ""),
        releaseDate: det.release_date || "",
        poster: det.poster || "",
        rating: det.vote_average ?? 0,
        genre: Array.isArray(det.genres) ? det.genres : [],
        source: "rec",
        firstSeen: today,
      };
      await env.DISCOVER_KV.put(key, JSON.stringify(entry));
      added++;
    } catch { skipped++; }
  }
  return { added, skipped };
}

async function handleDiscoverLike(env, id) { if (!env.DISCOVER_KV) return { error: "KV not configured" }; const raw = await env.DISCOVER_KV.get(`result:${id}`, "json"); if (!raw) return { error: "not_found" }; raw.likes = (raw.likes || 0) + 1; await env.DISCOVER_KV.put(`result:${id}`, JSON.stringify(raw)); return { id, likes: raw.likes }; }

async function handleDiscoverUpload(env, body) { const { id, image } = body; if (!id || !image) return { error: "Missing id or image" }; if (!env.DISCOVER_R2) return { error: "R2 not configured" }; const base64 = image.replace(/^data:image\/\w+;base64,/, ""); const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)); const key = `thumbnails/${id}.png`; await env.DISCOVER_R2.put(key, bytes, { httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=86400" } }); const thumbnailUrl = `https://api.bloodyrex.xyz/discover/thumbnail/${id}`; const raw = await env.DISCOVER_KV.get(`result:${id}`, "json"); if (raw) { raw.thumbnail = thumbnailUrl; await env.DISCOVER_KV.put(`result:${id}`, JSON.stringify(raw)); } return { url: thumbnailUrl }; }

function intelToday() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }); }

const MAP_LIMIT_DEFAULT = 10;
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit || 1, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(runners);
  return out;
}

const MIGRATE_PREFIX = "migrate/";
const MIGRATE_TTL_SECONDS = 86400; // 24h
const MIGRATE_MAX_BLOB_BYTES = 1500000; // ~1.5 MB encoded cap

const MIGRATE_TOKEN_RE = /^(?:mig_[A-Za-z0-9_-]{16,80}|[A-Z0-9]{10})$/i;

function migrateRandomToken() {
  const b = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(b, (c) => c.toString(16).padStart(2, "0").toUpperCase()).join("");
}

function migrateValidateBlob(code) {
  if (typeof code !== "string" || !code.length) return { ok: false, error: "empty" };
  if (code.length > MIGRATE_MAX_BLOB_BYTES) return { ok: false, error: "too_large" };
  const isGzip = code.startsWith("KV1G:");
  const isPlain = code.startsWith("KV1:");
  if (!isGzip && !isPlain) return { ok: false, error: "bad_prefix" };
  const body = code.slice(isGzip ? 5 : 4);
  let bin;
  try { bin = atob(body); } catch { return { ok: false, error: "bad_base64" }; }
  if (isGzip) {
    if (bin.length === 0) return { ok: false, error: "empty_payload" };
    return { ok: true, format: "kims-video-personal", version: 1, compressed: true };
  }
  const json = new TextDecoder("utf-8").decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  let parsed;
  try { parsed = JSON.parse(json); } catch { return { ok: false, error: "bad_json" }; }
  if (!parsed || parsed.format !== "kims-video-personal") return { ok: false, error: "bad_format" };
  if (!Number.isFinite(parsed.version)) return { ok: false, error: "bad_version" };
  return { ok: true, format: parsed.format, version: parsed.version, compressed: false };
}

async function migratePurgeExpired(env) {
  if (!env.DISCOVER_R2) return { purged: 0 };
  const now = Date.now();
  let purged = 0;
  let cursor;
  do {
    const page = await env.DISCOVER_R2.list({ prefix: MIGRATE_PREFIX, limit: 1000, cursor });
    for (const o of page.objects || []) {
      const exp = Number(o.customMetadata && o.customMetadata.exp) || 0;
      if (exp && now > exp) {
        try { await env.DISCOVER_R2.delete(o.key); purged++; } catch (e) {}
      }
    }
    cursor = page.cursor;
    if (!page.truncated && !cursor) break;
  } while (cursor);
  return { purged };
}

// ═══════════════════════════════════════════════════════════════════
// Router
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

    // ── GET routes ──
    if (method === "GET") {
      // Thumbnail serve
      const tm = path.match(/^\/discover\/thumbnail\/(.+)$/);
      if (tm && env.DISCOVER_R2) { try { const obj = await env.DISCOVER_R2.get(`thumbnails/${tm[1]}.png`); if (!obj) return new Response("Not found", { status: 404, headers: corsHeaders }); const h = new Headers(); obj.writeHttpMetadata(h); h.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]); h.set("Cache-Control", "public, max-age=86400"); return new Response(obj.body, { headers: h }); } catch (e) { return new Response("Error", { status: 500, headers: corsHeaders }); } }

            if (path === "/wall/recs") {
              if (!env.DISCOVER_KV) return Response.json({ items: [], nextCursor: null, count: 0, failed: 0 }, { headers: corsHeaders });
              const limRaw = parseInt(url.searchParams.get("limit") || "800", 10);
              const limit = Math.min(Math.max(Number.isFinite(limRaw) ? limRaw : 800, 1), 900);
              const cursor = url.searchParams.get("cursor") || undefined;
              const page = await env.DISCOVER_KV.list({ prefix: "wallRec:", limit, cursor });
              const items = [];
              let failed = 0;
              // 2026-10-02: bounded concurrency. 900 keys read one round-trip at a
              // time took 106s and looked like a hang; the request COUNT is
              // unchanged (1 list + ≤900 gets, still under the 1000 cap) — only the
              // queueing goes away. Per-key failures are still counted.
              const vals = await mapLimit(page.keys, MAP_LIMIT_DEFAULT, async (k) => {
                try { return await env.DISCOVER_KV.get(k.name, "json"); } catch { failed++; return null; }
              });
              for (const v of vals) if (v?.tmdbId) items.push(v);
              return Response.json({ items, nextCursor: page.cursor || null, listComplete: !page.cursor, count: items.length, failed }, { headers: corsHeaders });
            }

      // Discover list
      if (path === "/discover/results") { try { return Response.json(await handleDiscoverList(env, url), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message, results: [] }, { headers: corsHeaders }); } }

      // No-account personal-data migration: redeem a one-time token minted by POST /migrate/create
      if (method === "GET" && path.startsWith("/migrate/")) {
        const raw = path.slice("/migrate/".length);
        let token; try { token = decodeURIComponent(raw); } catch { token = raw; }
        if (!MIGRATE_TOKEN_RE.test(token)) {
          return Response.json({ ok: false, error: "invalid_token" }, { status: 400, headers: corsHeaders });
        }
        if (!env.DISCOVER_R2) {
          return Response.json({ ok: false, error: "r2_not_configured" }, { status: 503, headers: corsHeaders });
        }
        const key = MIGRATE_PREFIX + token;
        const obj = await env.DISCOVER_R2.get(key);
        if (!obj) {
          // never minted, already redeemed, or already purged — indistinguishable on purpose
          return Response.json({ ok: false, error: "not_found_or_consumed" }, { status: 404, headers: corsHeaders });
        }
        const exp = Number(obj.customMetadata && obj.customMetadata.exp) || 0;
        const now = Date.now();
        if (exp && now > exp) {
          try { await env.DISCOVER_R2.delete(key); } catch (e) {}
          return Response.json({ ok: false, error: "expired" }, { status: 410, headers: corsHeaders });
        }
        // 单次兑换说明（并发兑换权衡，用户已接受）：
        // - R2 get→delete 不是原子操作；KV claim lock 仅在 DISCOVER_KV 绑定时存在，
        //   且为短时尽力硬化（expirationTtl 300s），不能构成严格互斥。
        // - 并发情况下，两个兑换请求都可能在 delete 前都读到相同 blob，即双读都成功；
        //   本实现**不保证严格一次性（exactly-once）消费**，不得描述为具备原子消费能力。
        // - 兑换端数据由客户端 import 端完成幂等 merge，双读不会导致数据丢失（重复合并）。
        // - 迁移码不作为长期凭证；过期由 R2 自定义元数据 exp 与 KV lock TTL 清理。
        let consumed = false;
        if (env.DISCOVER_KV) {
          try {
            const lock = "miglock:" + token;
            const taken = await env.DISCOVER_KV.get(lock);
            if (taken) consumed = true;
            else ctx.waitUntil(env.DISCOVER_KV.put(lock, String(now), { expirationTtl: 300 }).catch(() => {}));
          } catch (e) {}
        }
        let blob;
        try {
          const buf = await obj.arrayBuffer();
          blob = new TextDecoder("utf-8").decode(buf);
        } catch (e) {
          return Response.json({ ok: false, error: "read_failed" }, { status: 500, headers: corsHeaders });
        }
        try { await env.DISCOVER_R2.delete(key); } catch (e) {}
        if (consumed) {
          return Response.json({ ok: false, error: "already_consumed" }, { status: 410, headers: corsHeaders });
        }
        return Response.json({ ok: true, code: blob, oneTime: true }, { status: 200, headers: corsHeaders });
      }

      // Fallback: health check
      return Response.json({ status: "ok", worker: "discover" }, { headers: corsHeaders });
    }

    // ── POST routes ──
    if (method === "POST") {
      // No-account personal-data migration: mint a one-time token for a client blob.
      // Body: { code: "<KV1:... | KV1G:...>" } — the exact string createMigrationCode produced.
      // The blob is relayed to R2, never logged, and is deleted when the token is redeemed.
      if (path === "/migrate/create") {
        if (!env.DISCOVER_R2) {
          return Response.json({ ok: false, error: "r2_not_configured" }, { status: 503, headers: corsHeaders });
        }
        let body;
        try { body = await request.json(); } catch (e) { return Response.json({ ok: false, error: "invalid_json" }, { status: 400, headers: corsHeaders }); }
        const code = (body && typeof body.code === "string") ? body.code.trim() : "";
        const v = migrateValidateBlob(code);
        if (!v.ok) {
          const status = v.error === "too_large" ? 413 : 400;
          return Response.json({ ok: false, error: v.error }, { status, headers: corsHeaders });
        }
        const token = migrateRandomToken();
        const createdMs = Date.now();
        const expiresMs = createdMs + MIGRATE_TTL_SECONDS * 1000;
        try {
          await env.DISCOVER_R2.put(MIGRATE_PREFIX + token, code, {
            httpMetadata: { contentType: "text/plain;charset=utf-8" },
            customMetadata: { exp: String(expiresMs), created: String(createdMs) },
          });
        } catch (e) {
          // surface a storage failure without echoing the blob or a stack trace
          console.log("migrate:create store failed:", e && e.message);
          return Response.json({ ok: false, error: "store_failed" }, { status: 502, headers: corsHeaders });
        }
        return Response.json({
          ok: true, code: token, expiresAt: expiresMs,
          ttlSeconds: MIGRATE_TTL_SECONDS, oneTime: true,
          compressed: v.compressed, version: v.version,
        }, { status: 200, headers: corsHeaders });
      }

      // Discover upload
      const um = path.match(/^\/discover\/results\/(.+)\/upload$/);
      if (um) { try { const ub = await request.json(); return Response.json(await handleDiscoverUpload(env, { id: um[1], image: ub.image }), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }

      // Discover like
      const lm = path.match(/^\/discover\/results\/(.+)\/like$/);
      if (lm) { try { return Response.json(await handleDiscoverLike(env, lm[1]), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }

      // Wall collect: user-recommendation films reported from ResultsPage (fire-and-forget, zero LLM tokens)
      if (path === "/wall/collect") {
        let cb; try { cb = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); }
        const items = Array.isArray(cb.items) ? cb.items.filter((it) => it && it.tmdbId != null).slice(0, 60) : [];
        if (!items.length || !env.DISCOVER_KV) return Response.json({ ok: true, added: 0, skipped: 0 }, { headers: corsHeaders });
        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        const rlKey = `wallrl:${ip}`;
        const rl = parseInt(await env.DISCOVER_KV.get(rlKey).catch(() => null) || "0");
        if (rl >= 120) return Response.json({ ok: false, error: "rate limited" }, { status: 429, headers: corsHeaders });
        await env.DISCOVER_KV.put(rlKey, String(rl + items.length), { expirationTtl: 600 });
        const { added, skipped } = await collectWallRecs(env, items);
        return Response.json({ ok: true, added, skipped }, { headers: corsHeaders });
      }

      let body;
      try { body = await request.json(); } catch (e) { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); }

      // Discover create
      if (path === "/discover/results") { try { const doc = await handleDiscoverCreate(env, body); if (doc?.id) { const wallItems = [...doc.sourceMovies, ...doc.recommendations].filter(m => m.tmdbId).map(m => ({ tmdbId: m.tmdbId, title: m.title, year: m.year })); ctx.waitUntil(collectWallRecs(env, wallItems)); } return Response.json(doc, { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }
    }

    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  },

  // ── Nightly: purge expired personal-data migration blobs from R2 ──
  async scheduled(event, env, ctx) {
    try {
      const purged = await migratePurgeExpired(env);
      console.log("scheduled migrate-purge:", JSON.stringify(purged));
    } catch (e) {
      console.log("scheduled migrate-purge failed:", e && e.message);
    }
  },
};

