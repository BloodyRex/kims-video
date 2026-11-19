// ═══════════════════════════════════════════════════════════════════
// Kim's Video — Digest Worker (mechanically sliced from workers-1.4.js)
// Routes: /intelligence/digest | subscribe | send-digest | send-test | unsubscribe
// 逐字节切片，逻辑零改动。迁移功能(/migrate/*)未分配阶段，未纳入。
// ═══════════════════════════════════════════════════════════════════

async function withCache(key, fetcher, ttl = 86400) { const c = caches.default; const r = new Request(`https://tmdb-cache/${key}`); const h = await c.match(r); if (h) { console.log("[CACHE HIT]", key); return h.json(); } console.log("[CACHE MISS]", key); const d = await fetcher(); // Empty arrays are NOT valid results (2026-08-24): a subrequest-budget blowup
  // mid-handler once cached on_the_air=[] for a full TTL, and the pipeline's
  // US-edge colo kept serving that poisoned entry → 热播中 went blank site-wide
  // while the Asia colo (manually warmed) looked fine. Treat [] as failure so
  // the next caller re-fetches instead of inheriting the empty answer.
  if (!d || (Array.isArray(d) && d.length === 0)) return null; const resp = new Response(JSON.stringify(d), { headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${ttl}` } }); c.put(r, resp.clone()); return d; }

function intelToday() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }); }
function intelDaysAgo(n) { return new Date(Date.now() - n * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }); }

function intelParseJSON(raw) { return JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim()); }

async function intelFetchTMDB(token, path, params, lang, opts = {}) {
  params = params || {};
  lang = lang || "zh-CN";
  // opts.en=false → skip the parallel en-US fetch (saves 1 subrequest/page).
  // handleIntelTV list scraping uses this to free budget for episode-detail
  // backfill (S/E), which was hitting Cloudflare's 50-subrequest ceiling.
  // en metadata (_titleEn/_overviewEn) is a nice-to-have for the EN UI; the
  // list cards fall back to original_name/overview, which is acceptable.
  const wantEn = opts.en !== false;
  const buildUrl = (language) => {
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    url.searchParams.set("language", language);
    return url;
  };
  const zhUrl = buildUrl(lang);
  const cacheKey = "intel2-" + btoa(zhUrl.toString()).replace(/[=+/]/g, "");
  const data = await withCache(cacheKey, async () => {
    if (!wantEn) {
      const zhRes = await fetch(zhUrl, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      if (!zhRes.ok) throw new Error(`TMDB ${path}: ${zhRes.status}`);
      return (await zhRes.json()).results || [];
    }
    const [zhRes, enRes] = await Promise.all([
      fetch(zhUrl, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }),
      fetch(buildUrl("en-US"), { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }),
    ]);
    if (!zhRes.ok) throw new Error(`TMDB ${path}: ${zhRes.status}`);
    const zhData = await zhRes.json();
    const zhResults = zhData.results || [];
    if (enRes.ok) {
      const enData = await enRes.json();
      const enMap = new Map((enData.results || []).map(r => [r.id, r]));
      return zhResults.map(item => {
        const en = enMap.get(item.id);
        if (en) {
          item._overviewEn = en.overview || "";
          item._titleEn = en.title || en.name || "";
        }
        return item;
      });
    }
    return zhResults;
  }, 3600);
  return data;
}

async function handleIntelDigest(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = intelToday();
  const weekAgo = intelDaysAgo(7);

  if (!env.DEEPSEEK_API_KEY) {
    return { date: today, headline: "", summary: "", topTrends: [], industryHighlights: [] };
  }

  let dayTrending = [];
  const synthTrends = () => dayTrending.slice(0, 5).map((m, i) => ({
    rank: i + 1,
    title: m.title || m.name || "",
    titleEn: m.titleEn || m.title || m.name || "",
    category: m.media_type === "tv" ? "tv" : "movie",
  }));

  try {
    const [nowPlaying, upcoming, _dayTrending, weekTrending] = await Promise.all([
      intelFetchTMDB(token, "/movie/now_playing", { region: "US" }),
      intelFetchTMDB(token, "/movie/upcoming"),
      intelFetchTMDB(token, "/trending/all/day"),
      intelFetchTMDB(token, "/trending/all/week"),
    ]);
    dayTrending = _dayTrending || [];
    const todayMovies = nowPlaying.filter(m => m.release_date === today).length;
    const weekMovies = nowPlaying.filter(m => m.release_date >= weekAgo).length;
    const weekUpcoming = upcoming.filter(m => m.release_date && m.release_date >= today).slice(0, 5).map(m => m.title || m.name);
    // Rex 2026-08-24: the digest must cover BOTH movies and TV — trending/all
    // payloads already carry tv entries (media_type), surface them explicitly.
    const dayTrendingTv = dayTrending.filter(m => m.media_type === "tv").slice(0, 5);
    const weekTrendingTv = weekTrending.filter(m => m.media_type === "tv").slice(0, 5);

    // 2026-11-07: 排片要跟邮件里的排片日历同源。以前 Upcoming 只来自 TMDB
    // /movie/upcoming（影评站的条状数据），coming.json 的档期完全不在 AI 的输入里，
    // 于是它敢在 7 条档期上方写「近期暂无重点待映项目」。这里补一次 coming.json 读取。
    let comingNext = [];
    try {
      const cResp = await fetch("https://bloodyrex.xyz/api/coming.json", { signal: AbortSignal.timeout(8000) });
      const cJson = await cResp.json();
      comingNext = (cJson?.next30Days || []).slice(0, 6).map(x => `${x.title || x.name}（${(x.releaseDate || "").slice(5)}）`);
    } catch { /* 排片日历不可用时退回 TMDB 单一来源 */ }
    const upcomingTitles = [...comingNext, ...weekUpcoming].slice(0, 6);

    const prompt = `Today is ${today}. Summarize today's entertainment news in a digest covering BOTH movies and TV series.

Stats: ${todayMovies} movies released today, ${weekMovies} new movies this week.
Top trending movies today: ${dayTrending.slice(0, 5).map(m => m.title || m.name).join(", ")}.
Top trending TV today: ${dayTrendingTv.map(m => m.title || m.name).join(", ") || "none"}.
Top trending movies this week: ${weekTrending.slice(0, 8).map(m => m.title || m.name).join(", ")}.
Top trending TV this week: ${weekTrendingTv.map(m => m.title || m.name).join(", ") || "none"}.
Upcoming releases already in our calendar (title（MM-DD）): ${upcomingTitles.join(", ") || "none"}.

Rules — these are hard constraints, violations get rejected:
1. The summary must be ONE paragraph and must stand alone.
2. Each highlight must add information the summary does NOT already state. Never repeat, restate, or paraphrase a summary sentence as a highlight.
3. Do NOT claim there is nothing upcoming/待映 when the Upcoming list above is non-empty. If it is non-empty, either ignore upcoming or name the closest date.
4. Only use titles and dates given above — never invent releases, dates, or numbers.
5. 3-4 highlights, each ≤ 30 Chinese characters.

Return JSON only:
{
  "headline": "One punchy headline in Chinese (max 30 chars)",
  "headlineEn": "Same headline in English",
  "summary": "One paragraph summary in Chinese (max 150 chars), must mention both a movie and a TV highlight",
  "summaryEn": "Same summary in English",
  "topTrends": [{ "rank": 1, "title": "...(in Chinese)", "titleEn": "...(same in English)", "category": "movie" }],
  "industryHighlights": [{ "text": "short highlight in Chinese", "en": "same in English" }]
}

Top 3-5 trends (mix movies and TV by heat).`;

    // Retry up to 4 attempts (DeepSeek occasionally returns empty/5xx — live
        // 2026-08-27: ~50% first-attempt success; 4 tries → ~94%). Music endpoint
        // uses more attempts for the same reason.
        // Hard timeout (40s) per attempt so a hung DeepSeek call can't drag the
        // digest past Cloudflare's execution limit and ship empty headline/summary
        // (was blank 2026-08-28 → 09-02).
        let raw = "", dResp = null;
        for (let ai = 0; ai < 4; ai++) {
          if (ai > 0) await new Promise(r => setTimeout(r, 1200));
          const ac = new AbortController();
          const tt = setTimeout(() => ac.abort(), 40000);
          try {
            dResp = await fetch("https://api.deepseek.com/chat/completions", {
              method: "POST",
              signal: ac.signal,
              headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model: "deepseek-v4-flash", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 3000 }),
            });
          } finally {
            clearTimeout(tt);
          }
          if (dResp.ok) {
            const dr = await dResp.json();
            raw = dr?.choices?.[0]?.message?.content || "";
            if (raw) break;
          }
        }
    if (!raw) throw new Error(`Empty content from DeepSeek`);
    const parsed = intelParseJSON(raw);
    // Backend fallback: if the AI omitted topTrends, synthesize programmatically
    // from today's trending (zero extra LLM cost) so the digest never ships empty tags
    if (!Array.isArray(parsed.topTrends) || parsed.topTrends.length === 0) {
      parsed.topTrends = synthTrends();
    }
    return { date: today, ...parsed };
  } catch (e) {
    console.warn("Digest failed:", e.message);
    // Even on AI failure, ship programmatic topTrends so the digest never goes fully empty
    return { date: today, headline: "", summary: "", topTrends: synthTrends(), industryHighlights: [] };
  }
}

async function handleUnsubscribe(request, env) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email") || "";
  // Rex 2026-08-25: page language follows the subscriber record when readable
  let unsubLocale = "zh";
  try {
    if (email && env.SUBSCRIBE_KV) {
      const raw = await env.SUBSCRIBE_KV.get(`sub:${email}`);
      if (raw && JSON.parse(raw)?.locale === "en") unsubLocale = "en";
    }
  } catch {}

  // POST: process unsubscribe
  if (request.method === "POST") {
    let postEmail = email;
    try {
      const form = await request.formData();
      postEmail = form.get("email") || postEmail;
    } catch {}
    if (postEmail && env.SUBSCRIBE_KV) {
      await env.SUBSCRIBE_KV.delete(`sub:${postEmail}`);
    }
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${unsubLocale === "en" ? "Unsubscribed — Kim's Video" : "已取消订阅 — Kim's Video"}</title></head>
<body style="margin:0;padding:0;background:#111;color:#eee;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
<div style="text-align:center;max-width:400px;padding:30px">
  <div style="background:#ff00ff;padding:12px;text-align:center;border:4px solid #000;margin-bottom:20px">
    <h1 style="margin:0;font-size:16px;color:#000;text-transform:uppercase">KIM'S VIDEO</h1>
  </div>
  ${unsubLocale === "en" ? `
  <h2 style="color:#00ff00;font-size:18px">✅ Unsubscribed</h2>
  <p style="color:#ccc;font-size:13px;line-height:1.5">You've been removed from the Kim's Video Daily Digest. You can resubscribe anytime at the website.</p>
  <div style="text-align:center;margin-top:20px">
    <a href="https://bloodyrex.xyz/intelligence" style="display:inline-block;background:#ffff00;color:#000;padding:10px 20px;font-weight:bold;font-size:13px;border:4px solid #000;text-decoration:none;text-transform:uppercase">Back to Kim's Video</a>
  </div>` : `
  <h2 style="color:#00ff00;font-size:18px">✅ 已取消订阅</h2>
  <p style="color:#ccc;font-size:13px;line-height:1.5">您已成功取消 Kim's Video 每日影音情报摘要的订阅。如需再次订阅，可随时访问网站。</p>
  <div style="text-align:center;margin-top:20px">
    <a href="https://bloodyrex.xyz/intelligence" style="display:inline-block;background:#ffff00;color:#000;padding:10px 20px;font-weight:bold;font-size:13px;border:4px solid #000;text-decoration:none;text-transform:uppercase">返回 Kim's Video</a>
  </div>`}
  <p style="font-size:10px;color:#666;margin-top:20px">Sent by Kim's Video · bloodyrex.xyz</p>
</div></body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html;charset=utf-8" } });
  }

  // GET: show confirmation form
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invalid Link — Kim's Video</title></head>
<body style="margin:0;padding:0;background:#111;color:#eee;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
<div style="text-align:center;max-width:400px;padding:30px">
  <h2 style="color:#ff00ff">无效链接</h2>
  <p style="color:#ccc">此取消订阅链接无效，请检查邮件中的链接是否正确。</p>
  <a href="https://bloodyrex.xyz" style="color:#ffff00">返回首页</a>
</div></body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html;charset=utf-8" } });
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe — Kim's Video</title></head>
<body style="margin:0;padding:0;background:#111;color:#eee;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
<div style="text-align:center;max-width:420px;padding:30px">
  <div style="background:#ff00ff;padding:12px;text-align:center;border:4px solid #000;margin-bottom:20px">
    <h1 style="margin:0;font-size:16px;color:#000;text-transform:uppercase">KIM'S VIDEO</h1>
  </div>
  <h2 style="color:#ffff00;font-size:16px">取消订阅</h2>
  <p style="color:#ccc;font-size:13px">确认取消 Kim's Video 每日影音情报摘要？</p>
  <p style="color:#999;font-size:12px">邮箱：${email}</p>
  <form method="POST" action="/intelligence/unsubscribe?email=${encodeURIComponent(email)}" style="margin-top:16px">
    <input type="hidden" name="email" value="${email}">
    <button type="submit" style="background:#ff00ff;color:#fff;border:4px solid #000;padding:10px 24px;font-size:13px;font-weight:bold;cursor:pointer;text-transform:uppercase">确认取消订阅</button>
  </form>
  <p style="margin-top:16px"><a href="https://bloodyrex.xyz/intelligence" style="color:#666;font-size:12px">不取消，返回 Kim's Video</a></p>
  <p style="font-size:10px;color:#666;margin-top:20px">Sent by Kim's Video · bloodyrex.xyz</p>
</div></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html;charset=utf-8" } });
}

async function handleSubscribe(request, env) {
  const ALLOWED_ORIGINS = ["https://bloodyrex.xyz", "https://www.bloodyrex.xyz", "https://bloodyrex.github.io", "http://localhost:4173", "http://localhost:5173", "http://localhost:5174", "http://localhost:7850", "http://127.0.0.1:7850"];
  const origin = request.headers.get("Origin");
  const corsHeaders = { "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0], "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Max-Age": "86400" };

  if (!env.SUBSCRIBE_KV) return Response.json({ error: "Subscribe not configured" }, { status: 503, headers: corsHeaders });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); }

  const email = (body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Invalid email" }, { status: 400, headers: corsHeaders });

  // Check already subscribed
  const existing = await env.SUBSCRIBE_KV.get(`sub:${email}`);
  if (existing) return Response.json({ ok: true, message: "Already subscribed" }, { headers: corsHeaders });

  // Store
  const subscriber = JSON.stringify({ email, locale: body.locale || "zh", subscribedAt: new Date().toISOString() });
  await env.SUBSCRIBE_KV.put(`sub:${email}`, subscriber);

  // Send confirmation via Resend
  if (env.RESEND_API_KEY) {
    const unsubUrl = `https://api.bloodyrex.xyz/intelligence/unsubscribe?email=${encodeURIComponent(email)}`;
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Kim's Video <digest@bloodyrex.xyz>",
          to: email,
          subject: body.locale === "en" ? "Subscription confirmed — Kim's Video Daily Digest" : "✅ 订阅确认 — Kim's Video 每日影音情报摘要",
          html: body.locale === "en"
            ? `<!DOCTYPE html>
<html><body style="margin:0;padding:20px;background:#111;color:#eee;font-family:sans-serif">
<div style="max-width:480px;margin:0 auto">
  <div style="background:#ff00ff;padding:12px;text-align:center;border:4px solid #000;margin-bottom:16px">
    <h1 style="margin:0;font-size:16px;color:#000;text-transform:uppercase">KIM'S VIDEO · DIGEST</h1>
  </div>
  <div style="background:#000;border:4px solid #ffff00;padding:16px;margin-bottom:16px">
    <p style="font-size:14px;color:#00ff00;font-weight:bold;margin:0 0 8px">✅ Subscription confirmed!</p>
    <p style="font-size:13px;color:#ccc;line-height:1.5;margin:0">You'll receive the Kim's Video Daily Intelligence Digest every morning (Beijing time 8:00), including:</p>
    <ul style="font-size:12px;color:#999;line-height:1.8;padding-left:16px;margin:8px 0 0">
      <li>📰 AI-curated daily headlines</li>
      <li>🔥 Weekly hot lists (movies & TV top 10)</li>
      <li>▶ Coming soon preview</li>
      <li>🎬 New movie releases</li>
      <li>📺 TV premieres & ongoing</li>
      <li>💿 Editor's album picks</li>
    </ul>
  </div>
  <div style="text-align:center;margin:16px 0">
    <a href="https://bloodyrex.xyz/intelligence" style="display:inline-block;background:#ffff00;color:#000;padding:10px 20px;font-weight:bold;font-size:13px;border:4px solid #000;text-decoration:none;text-transform:uppercase">Explore Intelligence</a>
  </div>
  <p style="font-size:10px;color:#666;text-align:center;margin-top:20px">
    <a href="${unsubUrl}" style="color:#666">Unsubscribe</a> · <a href="https://bloodyrex.xyz" style="color:#666">bloodyrex.xyz</a>
  </p>
</div></body></html>`
            : `<!DOCTYPE html>
<html><body style="margin:0;padding:20px;background:#111;color:#eee;font-family:sans-serif">
<div style="max-width:480px;margin:0 auto">
  <div style="background:#ff00ff;padding:12px;text-align:center;border:4px solid #000;margin-bottom:16px">
    <h1 style="margin:0;font-size:16px;color:#000;text-transform:uppercase">KIM'S VIDEO · 每日影音情报</h1>
  </div>
  <div style="background:#000;border:4px solid #ffff00;padding:16px;margin-bottom:16px">
    <p style="font-size:14px;color:#00ff00;font-weight:bold;margin:0 0 8px">✅ 订阅成功！</p>
    <p style="font-size:13px;color:#ccc;line-height:1.5;margin:0">每天上午 8:00（北京时间）您将收到以下内容：</p>
    <ul style="font-size:12px;color:#999;line-height:1.8;padding-left:16px;margin:8px 0 0">
      <li>📰 AI 精选每日摘要</li>
      <li>🔥 本周热榜（电影 & 剧集 Top 10）</li>
      <li>▶ 即将上映预告</li>
      <li>🎬 本周新片速递</li>
      <li>📺 剧集首播与热播追踪</li>
      <li>💿 编辑精选专辑推荐</li>
    </ul>
  </div>
  <div style="text-align:center;margin:16px 0">
    <a href="https://bloodyrex.xyz/intelligence" style="display:inline-block;background:#ffff00;color:#000;padding:10px 20px;font-weight:bold;font-size:13px;border:4px solid #000;text-decoration:none;text-transform:uppercase">前往情报中心</a>
  </div>
  <p style="font-size:10px;color:#666;text-align:center;margin-top:20px">
    <a href="${unsubUrl}" style="color:#666">取消订阅</a> · <a href="https://bloodyrex.xyz" style="color:#666">bloodyrex.xyz</a>
  </p>
</div></body></html>`,
        }),
      });
    } catch (e) { console.warn("Resend confirmation failed:", e.message); }
  }

  // Send today's daily digest to new subscriber
  if (env.RESEND_API_KEY && env.SUBSCRIBE_KV) {
    try {
      const today = intelToday();
      let digestHtml, whHeadline = "";
      const cachedDigest = await env.SUBSCRIBE_KV.get(`digest:${today}`);
      if (cachedDigest) {
        const parsed = JSON.parse(cachedDigest);
        digestHtml = parsed.html;
        whHeadline = parsed.headline || "";
      } else {
        const result = await buildDigestHTML(env, today);
        digestHtml = result.html;
        whHeadline = result.headline || "";
        await env.SUBSCRIBE_KV.put(`digest:${today}`, JSON.stringify({ html: result.html, htmlEn: result.htmlEn || "", date: result.date, headline: result.headline || "", headlineEn: result.headlineEn || "" }), { expirationTtl: 86400 });
      }
      const personalHtml = digestHtml.replace(
        /https:\/\/api\.bloodyrex\.xyz\/intelligence\/unsubscribe\?email=[^"'<>\s]*/g,
        `https://api.bloodyrex.xyz/intelligence/unsubscribe?email=${encodeURIComponent(email)}`
      );
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Kim's Video <digest@bloodyrex.xyz>",
          to: email,
          subject: whHeadline ? `🎬 ${whHeadline} · Kim's Video ${today}` : `Kim's Video 每日影音情报 · ${today}`,
          html: personalHtml,
        }),
      });
    } catch (e) { console.warn("Welcome digest failed:", e.message); }
  }

  return Response.json({ ok: true, message: "Subscribed" }, { headers: corsHeaders });
}

async function fetchDigestData() {
  const BASE = "https://bloodyrex.xyz/api";
  const safeJson = async (result) => {
    if (result.status !== "fulfilled") return null;
    try { return await result.value.json(); } catch { return null; }
  };

  // coming.json / weekly-lock.json added 2026-11-06:
  //   · coming.json 是排片日历的单一真源（pipeline 本地合并 movies+tv，周内只增不减）；
  //     邮件以前只读 tvData.upcoming，一次抓空就整块空白。
  //   · weekly-lock.json 提供本周累计（只读，不参与任何计算）。
  const [digestR, overviewR, tvR, musicR, moviesR, gemsR, wallDeltaR, tvWallDeltaR, comingR, weeklyLockR, festivalsR] = await Promise.allSettled([
    fetch(`${BASE}/digest.json`), fetch(`${BASE}/overview.json`),
    fetch(`${BASE}/tv.json`), fetch(`${BASE}/music.json`),
    fetch(`${BASE}/movies.json`), fetch(`${BASE}/hidden-gems.json`),
    fetch(`${BASE}/wall-delta.json`), fetch(`${BASE}/tvwall-delta.json`),
    fetch(`${BASE}/coming.json`), fetch(`${BASE}/weekly-lock.json`),
    // festivals.json (2026-11-07): 新增「电影节动态」小板块的唯一真源。
    // 它本来就是排片日历那块页面的公开聚合，一个静态 JSON，零额外计算。
    fetch(`${BASE}/festivals.json`),
  ]);

  return {
    dig: (await safeJson(digestR)) || {},
    overview: (await safeJson(overviewR)) || {},
    tvData: (await safeJson(tvR)) || {},
    musicData: (await safeJson(musicR)) || {},
    moviesData: (await safeJson(moviesR)) || {},
    gemsData: (await safeJson(gemsR)) || {},
    wallDelta: (await safeJson(wallDeltaR)) || {},
    tvWallDelta: (await safeJson(tvWallDeltaR)) || {},
    comingData: (await safeJson(comingR)) || {},
    weeklyLock: (await safeJson(weeklyLockR)) || {},
    festivalsData: (await safeJson(festivalsR)) || {},
  };
}

function buildWeeklyWorkIndex(data) {
  const d = data || {};
  const idx = new Map();
  const add = (arr, sectionKey, forcedType) => (arr || []).forEach(x => {
    if (!x) return;
    const id = x.tmdbId ?? x.id;
    if (id == null) return;
    const key = `${sectionKey}:${id}`;
    if (idx.has(key)) return;
    const mediaType = forcedType || (x.mediaType === "tv" ? "tv" : x.mediaType === "movie" ? "movie" : null);
    if (!mediaType) return; // music/unknown: not a film or show
    idx.set(key, {
      tmdbId: id,
      mediaType,
      title: x.title || x.name || "",
      titleEn: x.titleEn || x.title || x.name || "",
      poster: x.poster || "",
      rating: x.rating || 0,
      year: x.year || String(x.releaseDate || x.release_date || x.first_air_date || "").slice(0, 4),
      genre: x.genre || [],
      summary: x.summary || "",
      summaryEn: x.summaryEn || x.summary || "",
      releaseDate: x.releaseDate || x.release_date || x.first_air_date || "",
    });
  });
  add(d.moviesData?.releasedThisWeek, "movies.json.releasedThisWeek", "movie");
  add(d.moviesData?.nowPlaying, "movies.json.nowPlaying", "movie");
  add(d.tvData?.premieresThisWeek, "tv.json.premieresThisWeek", "tv");
  add(d.tvData?.ongoing, "tv.json.ongoing", "tv");
  add(d.comingData?.next30Days, "coming.json.next30Days"); // carries its own mediaType
  // Fallbacks (same lock section keys → still resolvable when the item rolled out)
  add(d.moviesData?.upcoming, "movies.json.releasedThisWeek", "movie");
  add(d.moviesData?.upcoming, "movies.json.nowPlaying", "movie");
  add(d.tvData?.upcoming, "tv.json.premieresThisWeek", "tv");
  add(d.tvData?.upcoming, "tv.json.ongoing", "tv");
  add(d.overview?.comingSoon, "coming.json.next30Days", "movie");
  add(d.overview?.comingSoonTv, "coming.json.next30Days", "tv");
  return idx;
}

function weeklyLockedWorks(lock, idx) {
  const out = [];
  const seen = new Set();
  const sections = lock?.sections && typeof lock.sections === "object" ? lock.sections : null;
  if (!sections) return out;
  for (const [sectionKey, ids] of Object.entries(sections)) {
    if (sectionKey === "music.json.picks" || !Array.isArray(ids)) continue;
    for (const id of ids) {
      const item = idx.get(`${sectionKey}:${id}`);
      if (!item) continue;
      const k = `${item.mediaType}:${item.tmdbId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

function weekStartOf(dateStr) {
  const base = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(base)) return "";
  const dow = base.getUTCDay(); // 0 = Sunday
  const back = dow === 0 ? 6 : dow - 1;
  base.setUTCDate(base.getUTCDate() - back);
  return base.toISOString().slice(0, 10);
}

function renderDigestHtml(d, now, locale) {
  const en = locale === "en";
  const L = (zhStr, enStr) => (en ? enStr : zhStr);
  const pickTitle = (item) => (en ? (item.titleEn || item.title) : item.title);
  const { dig, overview, tvData, musicData, moviesData, gemsData, wallDelta, tvWallDelta, todayStar, festivalsData } = d;

  const stats = overview.stats || {};
  const date = d.dig.date || d.overview.updated || now;

  // ── Helpers ──
  const genreStr = (g) => Array.isArray(g) ? g.slice(0, 2).join(" / ") : (g || "");
  const thumb = (url) => {
    if (!url) return "";
    // Route through poster-proxy: TMDB image host is unreachable from CN networks.
    // w185 balances email size vs visual impact (46px→92px cards in 560px layout).
    const small = url.replace("/w500/", "/w185/");
    return `https://api.bloodyrex.xyz/poster-proxy?url=${encodeURIComponent(small)}`;
  };
  const title = (text) => `<div style="display:flex;align-items:center;gap:6px;margin:12px 0 8px"><span style="font-size:16px;font-weight:bold;color:#ffff00;text-transform:uppercase">${text}</span></div>`;
  const divider = `<div style="border-top:2px dashed #333;margin:16px 0"></div>`;
  const card = (inner, borderColor) => `<div style="background:#000;border:2px solid ${borderColor};padding:10px;margin:6px 0">${inner}</div>`;

  // ── Weekly feature announcement (shown in digest emails dated 2026-11-07--2026-11-14 = 7 scheduled sends) ──
  // This presentation is intentionally placed above the daily abstract/weekly cumulative block.
  // It spans exactly seven scheduled daily sends (daily cron 22:35 UTC): 11-08..11-14 Beijing. The first
  // scheduled send after this patch (11-07 22:35 UTC = 11-08 06:35 Beijing) is send #1; the block disappears
  // on 11-15 Beijing with no follow-up code change.
  const weeklyAnnouncement = ["2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"].includes(now);
  const weeklyAnnouncementHtml = weeklyAnnouncement
    ? `<div style="background:#000;border:4px solid #ffff00;padding:14px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:6px"><span style="font-size:15px">★</span><span style="font-size:11px;font-weight:bold;color:#ffff00;letter-spacing:2px;text-transform:uppercase">${L("本周上线 · 7 天专题", "New this week · 7-day feature")}</span></div>
      </div>
      <div style="font-size:20px;font-weight:bold;color:#fff;line-height:1.25;margin-bottom:4px">${L("网站本周三大上线", "Three new site features")}</div>
      <div style="font-size:12px;color:#aaa;margin-bottom:3px">${L("一分钟先看完，其余内容照常送达。", "A one-minute look; today's content follows below.")}</div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="width:38px;vertical-align:middle;padding:9px 8px 9px 0;border-top:1px dashed #444"><span style="display:inline-block;width:38px;height:38px;line-height:34px;text-align:center;background:#ff00ff;border:2px solid #000;font-size:20px">🎬</span></td>
          <td style="vertical-align:middle;padding:9px 6px;border-top:1px dashed #444">
            <div style="font-size:13px;font-weight:bold;color:#fff;line-height:1.35">${L("全球电影节排片日历", "Global Festival Calendar")}</div>
            <div style="font-size:11px;color:#aaa;line-height:1.45;margin-top:3px">${L("可按今日、本周或月历查看已收录电影节的影片、场次与活动。", "Browse listed festival films, sessions, and events by day, week, or month.")}</div>
          </td>
          <td style="vertical-align:middle;text-align:right;padding:9px 0;border-top:1px dashed #444;white-space:nowrap"><a href="https://bloodyrex.xyz/festivals?utm_source=digest&amp;utm_medium=email&amp;utm_campaign=weekly-feature" style="display:inline-block;background:#ff00ff;color:#000;padding:7px 10px;font-size:11px;font-weight:bold;border:3px solid #000;text-decoration:none">${L("查看 →", "View →")}</a></td>
        </tr>
        <tr>
          <td style="width:38px;vertical-align:middle;padding:9px 8px 9px 0;border-top:1px dashed #444"><span style="display:inline-block;width:38px;height:38px;line-height:34px;text-align:center;background:#00ffff;border:2px solid #000;font-size:20px">💾</span></td>
          <td style="vertical-align:middle;padding:9px 6px;border-top:1px dashed #444">
            <div style="font-size:13px;font-weight:bold;color:#fff;line-height:1.35">${L("本地数据迁移", "Move Your Data")}</div>
            <div style="font-size:11px;color:#aaa;line-height:1.45;margin-top:3px">${L("用一次性短码把收藏及搜索记录带到新电脑或浏览器，并自动合并。", "Use a one-time code to bring favorites and search history to a new computer or browser, with records merged safely.")}</div>
          </td>
          <td style="vertical-align:middle;text-align:right;padding:9px 0;border-top:1px dashed #444;white-space:nowrap"><a href="https://bloodyrex.xyz/?utm_source=digest&amp;utm_medium=email&amp;utm_campaign=weekly-feature" style="display:inline-block;background:#00ffff;color:#000;padding:7px 10px;font-size:11px;font-weight:bold;border:3px solid #000;text-decoration:none">${L("打开 →", "Open →")}</a></td>
        </tr>
        <tr>
          <td style="width:38px;vertical-align:middle;padding:9px 8px 9px 0;border-top:1px dashed #444"><span style="display:inline-block;width:38px;height:38px;line-height:34px;text-align:center;background:#00ff00;border:2px solid #000;font-size:20px">👾</span></td>
          <td style="vertical-align:middle;padding:9px 6px;border-top:1px dashed #444">
            <div style="font-size:13px;font-weight:bold;color:#fff;line-height:1.35">${L("像素游戏《生命进化史》", "Life Evolution")}</div>
            <div style="font-size:11px;color:#aaa;line-height:1.45;margin-top:3px">${L("吃食物、避开强敌并逐级进化，从海洋一路生存到陆地。", "Eat, dodge stronger creatures, and evolve from the ocean to land.")}</div>
          </td>
          <td style="vertical-align:middle;text-align:right;padding:9px 0;border-top:1px dashed #444;white-space:nowrap"><a href="https://bloodyrex.xyz/pixel-avatar-v16.html?utm_source=digest&amp;utm_medium=email&amp;utm_campaign=weekly-feature" style="display:inline-block;background:#00ff00;color:#000;padding:7px 10px;font-size:11px;font-weight:bold;border:3px solid #000;text-decoration:none">${L("开玩 →", "Play →")}</a></td>
        </tr>
      </table>
    </div>`
    : "";

  // ── Daily Digest section ──
  const headline = en ? (dig.headlineEn || dig.headline || "") : (dig.headline || "");
  const summaryZh = en ? (dig.summaryEn || dig.summary || "") : (dig.summary || "");
  const trends = (dig.topTrends || []).slice(0, 5);
  const trendsHtml = trends.length
    ? `<div style="margin:8px 0">${trends.map(t => `<span style="display:inline-block;background:#ff00ff;color:#000;padding:2px 7px;font-size:10px;font-weight:bold;margin:2px;text-transform:uppercase">${pickTitle(t)}</span>`).join("")}</div>`
    : "";
  // Industry highlights (from digest.json) — bullet list under the summary.
  // Contradiction/dedupe filtering needs the calendar row counts, so the raw list
  // is collected here and filtered after the calendar is built (below).
  const highlightsSource = (dig.industryHighlights || []);

  // ── Release Calendar — 单一真源 coming.json（2026-11-06 治本） ──
  // 以前电影读 movies.json.upcoming、剧集读 tv.json.upcoming，两边各自日更：
  // tv.json.upcoming 一次抓空（供给四因：discover 无热度下限 / daysUntil<=3 被
  // imminent 抽进首播 / 日期口径不齐 / 无兜底）整块就变「暂无」。
  // 现在：coming.json 是唯一真源（pipeline 本地合并 movies+tv，且已纳入每周累计，
  // 周内只增不减）；两极兜底保证它今天没发布也不会空白。
  const { comingData, weeklyLock } = d;
  const todayBj = new Date(intelToday() + "T00:00:00+08:00");
  const calcDays = (item) => {
    const raw = item.releaseDate || item.release_date || item.first_air_date || "";
    if (!raw) return item.daysUntil !== undefined ? item.daysUntil : 999;
    const d = raw.slice(0, 10);
    // 用北京日零点做差：服务器 UTC 的 new Date() 在 08:00 前会把"今天"算成明天。
    return Math.round((new Date(`${d}T00:00:00+08:00`) - todayBj) / 86400000);
  };
  const dedupeById = (arr) => {
    const seen = new Set();
    return arr.filter(x => {
      const k = `${x.mediaType || ""}:${x.tmdbId ?? x.id ?? x.title ?? ""}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  };
  const toCalList = (arr, mediaType, strict = false) => dedupeById(
    (arr || [])
      // Tier1 (coming.json) is STRICT: a mixed movie+TV list, so an entry without
      // mediaType must not appear in both tables. Tier2/3 lists are homogeneous
      // (movies.json.upcoming = films, tv.json.upcoming = shows) → permissive.
      .filter(x => (strict ? x.mediaType === mediaType : (x.mediaType ? x.mediaType === mediaType : true)))
      .map(x => ({ ...x, mediaType, _days: calcDays(x) }))
      .filter(x => x._days >= 0 && x._days <= 30)
      .sort((a, b) => a._days - b._days)
  );

  // 2026-11-06：排片块改为「周累计集」展示。coming.json.next30Days 本身已是周锁合并后
  // 的累计集（WEEKLY_SCOPE 生效，周内只增不减），但每表 limit 6 会把累计集截掉一半 ——
  // 真实回放（9-21 起 6 个完整周）周并集峰值：**电影 12 部 / 剧集 10 部**。limit 6 下
  // 「累计」在邮件里不可见，等于没做。上限放到 12（容纳实测峰值，不设无界值）。
  const CAL_LIMIT = 12;
  // Tier 1: coming.json（单一真源 + 周累计）
  let movieAll = toCalList(comingData?.next30Days, "movie", true);
  let tvAll = toCalList(comingData?.next30Days, "tv", true);
  const movieFromLock = movieAll.length > 0;
  const tvFromLock = tvAll.length > 0;
  // Tier 2: per-file upcoming (the old sources — still useful when coming.json is stale)
  if (!movieAll.length) movieAll = toCalList(moviesData.upcoming, "movie");
  if (!tvAll.length) tvAll = toCalList(tvData.upcoming, "tv");
  // Tier 3: overview 的「即将上映」卡片池 —— 最后一次兜底，绝不再渲染「暂无」
  if (!movieAll.length) movieAll = toCalList(overview.comingSoon, "movie");
  if (!tvAll.length) tvAll = toCalList(overview.comingSoonTv, "tv");
  const movieCalendar = movieAll.slice(0, CAL_LIMIT);
  const tvCalendar = tvAll.slice(0, CAL_LIMIT);
  // 「本周累计」标注只在 Tier1 出现：Tier2/3 是当日快照，不是累计集，标了就是撒谎。
  const calHead = (emoji, label, total, isCumulative) => `<p style="font-size:11px;color:${emoji === "🎬" ? "#ff00ff" : "#00ffff"};font-weight:bold;text-transform:uppercase;margin:0 0 4px">${emoji} ${label}`
    + (total ? ` <span style="color:#666;font-weight:normal;text-transform:none">· ${isCumulative ? L(`本周累计 ${total} 部`, `${total} THIS WEEK`) : `${total}`}</span>` : "")
    + `</p>`;
  const calendarRow = (item) => {
    const d = item._days;
    const label = d === 0 ? L("今日", "TODAY") : d <= 3 ? (en ? `${d}D` : `${d}天后`) : (en ? `${d}D` : `${d}天`);
    const g = genreStr(item.genre);
    return `<tr><td style="padding:2px 6px;font-size:10px;color:#ff00ff;white-space:nowrap;width:36px;background:#111">${label}</td><td style="padding:2px 6px;font-size:12px;color:#fff;background:#111">${pickTitle(item) || ""}</td><td style="padding:2px 6px;font-size:10px;color:#999;text-align:right;background:#111">${g}</td></tr>`;
  };
  const calendarHtml = (movieCalendar.length || tvCalendar.length)
    ? `<div style="background:#000;border:2px dashed #444;padding:8px;margin:6px 0">
  ${calHead("🎬", L("电影排片", "MOVIE CALENDAR"), movieAll.length, movieFromLock)}
  <table style="width:100%;border-collapse:collapse">${movieCalendar.length ? movieCalendar.map(calendarRow).join("") : `<tr><td style="padding:6px;font-size:11px;color:#666;background:#111">${L("暂无", "None")}</td></tr>`}</table>
  <div style="border-top:1px dashed #333;margin:8px 0"></div>
  ${calHead("📺", L("剧集排片", "TV CALENDAR"), tvAll.length, tvFromLock)}
  <table style="width:100%;border-collapse:collapse">${tvCalendar.length ? tvCalendar.map(calendarRow).join("") : `<tr><td style="padding:6px;font-size:11px;color:#666;background:#111">${L("暂无", "None")}</td></tr>`}</table>
</div>
<div style="text-align:right;margin:4px 0">
  <a href="https://bloodyrex.xyz/intelligence?utm_source=digest&utm_medium=email&utm_campaign=daily" style="font-size:11px;color:#ff00ff">${L("查看全部排片 →", "Full calendar →")}</a>
</div>`
    : "";

  // ── 电影节动态（Rex 2026-11-07）：有正在举办的就列出来（给起止日期）；一场都没有
  // 时只报最近的一站（给开幕日期）。数据源是 festivals.json —— 它本来就是 /festivals
  // 页面的公开聚合，邮件只是镜像，不新增任何抓取，也不扩大已公开的字段范围。
  // lifecycle 是权威状态（LIVE / UPCOMING / ENDED），日期只做交叉校验：publish 偶尔
  // 落后一天，靠日期兜住「已结束却仍显示进行中」这条错话。
  const festAll = Array.isArray(festivalsData?.festivals) ? festivalsData.festivals : [];
  const dOnly = (s) => String(s || "").slice(0, 10);
  const dGap = (a, b) => {
    const t1 = new Date(`${a}T00:00:00Z`), t2 = new Date(`${b}T00:00:00Z`);
    if (isNaN(t1) || isNaN(t2)) return NaN;
    return Math.round((t2 - t1) / 86400000);
  };
  const festName = (f) => (en ? (f.name?.en || f.name?.zh) : (f.name?.zh || f.name?.en)) || "";
  const festLive = festAll
    .filter(f => {
      const s = dOnly(f.startDate), e = dOnly(f.endDate);
      if (!s || !e || f.lifecycle === "ENDED") return false;
      return s <= now && now <= e;
    })
    .sort((a, b) => a.endDate.localeCompare(b.endDate)); // 在办的按「快闭幕」优先，最急的排前面
  const festNext = festLive.length ? [] : festAll
    .filter(f => f.lifecycle !== "ENDED" && dOnly(f.startDate) && dOnly(f.startDate) > now)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 1);
  const festRows = (festLive.length ? festLive.slice(0, 3) : festNext).map(f => {
    const s = dOnly(f.startDate), e = dOnly(f.endDate);
    let meta;
    if (festLive.length) {
      const dayNo = dGap(s, now) + 1, dayTotal = dGap(s, e) + 1;
      // 场次只报「今天确实有」，绝不报 0：抓取若漏了一轮，0 会被读成「今天休展」。
      const todayN = (f.today?.date === now) ? (f.today.screenings || 0) : 0;
      const nextS = dOnly(f.nextScreeningDate);
      const hint = todayN > 0
        ? L(` · 今日 ${todayN} 场`, ` · ${todayN} screenings today`)
        : (nextS && nextS > now) ? L(` · 下一场 ${nextS.slice(5)}`, ` · next ${nextS.slice(5)}`) : "";
      meta = L(
        `${s} ~ ${e} · 第 ${dayNo}/${dayTotal} 天${hint}`,
        `${s} ~ ${e} · day ${dayNo} of ${dayTotal}${hint}`
      );
    } else {
      const dd = dGap(now, s);
      meta = L(
        dd === 1 ? `${s} 开幕 · 明天` : `${s} 开幕 · 还有 ${dd} 天`,
        dd === 1 ? `opens ${s} · tomorrow` : `opens ${s} · in ${dd} days`
      );
    }
    return `<div style="padding:8px 0;border-top:1px dashed #444">
      <div style="font-size:13px;color:#fff;font-weight:bold;line-height:1.4">${festName(f)}</div>
      <div style="font-size:11px;color:#aaa;line-height:1.5;margin-top:5px">${meta}</div>
    </div>`;
  }).join("");
  const festOverflow = festLive.length > 3
    ? `<div style="font-size:11px;color:#888;padding-top:5px;border-top:1px dashed #444">${L(`另有 ${festLive.length - 3} 个在展`, `${festLive.length - 3} more running`)}</div>`
    : "";
  const festivalHtml = festRows
    ? `<div style="background:#000;border:2px solid #ff00ff;padding:10px;margin:6px 0">
    <div style="font-size:12px;color:#ff00ff;font-weight:bold;margin-bottom:6px">${festLive.length
      ? L(`🟢 正在举办${festLive.length > 1 ? ` · ${festLive.length} 个` : ""}`, `🟢 ON NOW${festLive.length > 1 ? ` · ${festLive.length} running` : ""}`)
      : L("🔜 下一站", "🔜 NEXT UP")}</div>
    ${festRows}
    ${festOverflow}
  </div>
  <div style="text-align:right;margin:4px 0">
    <a href="https://bloodyrex.xyz/festivals?utm_source=digest&utm_medium=email&utm_campaign=daily" style="font-size:11px;color:#ff00ff">${L("查看电影节日历 →", "Festival calendar →")}</a>
  </div>`
    : "";

  // ── 本周累计（2026-11-06）：只读 weekly-lock.json，不参与任何计算 ──
  // 这是「周一到周日只增不减」的可见证据：数字来自 pipeline 当次写盘的 sections 长度，
  // 今日新增来自同一个文件里记录的 delta（pipeline 侧算好，Worker 零子请求）。
  const weeklySections = weeklyLock?.sections && typeof weeklyLock.sections === "object" ? weeklyLock.sections : null;
  const weeklyStart = weeklyLock?.weekStart || "";
  const wCount = (key) => (Array.isArray(weeklySections?.[key]) ? weeklySections[key].length : 0);
  const wDelta = (key) => {
    const v = weeklyLock?.delta?.bySection?.[key];
    return typeof v === "number" ? v : 0;
  };
  const weeklyRows = weeklySections ? [
    { key: "movies.json.releasedThisWeek", zh: "电影·本周上映", en: "MOVIES · NEW THIS WEEK", color: "#ff00ff" },
    { key: "movies.json.nowPlaying", zh: "电影·热映中", en: "MOVIES · IN THEATERS", color: "#ff00ff" },
    { key: "tv.json.premieresThisWeek", zh: "剧集·本周首播", en: "TV · PREMIERES", color: "#00ffff" },
    { key: "tv.json.ongoing", zh: "剧集·热播中", en: "TV · ON AIR", color: "#00ffff" },
    { key: "coming.json.next30Days", zh: "排片·30天内", en: "CALENDAR · 30 DAYS", color: "#ffff00" },
    { key: "music.json.picks", zh: "音乐·本周精选", en: "MUSIC · WEEKLY PICKS", color: "#00ff00" },
  ].map(r => ({ ...r, n: wCount(r.key), d: wDelta(r.key) })).filter(r => r.n > 0) : [];
  // Week range shown in the board header. The lock's own weekStart defines WHICH
  // works are being ranked, so it is the truthful label even if the pipeline lagged
  // a day; we only synthesize the computed Monday when the lock has no weekStart.
  const boardWeekStart = weeklyStart || weekStartOf(now) || "";
  const boardWeekEnd = (() => {
    if (!boardWeekStart) return "";
    const t = new Date(`${boardWeekStart}T12:00:00Z`);
    t.setUTCDate(t.getUTCDate() + 6);
    return t.toISOString().slice(0, 10);
  })();
  const weeklyTotal = weeklyRows.reduce((a, r) => a + r.n, 0);
  const weeklyDeltaTotal = weeklyRows.reduce((a, r) => a + r.d, 0);
  // ── Placement rule (Rex 2026-11-07): the cumulative block only earns the top of
  // the email twice a week. Friday = the first real board of the week, Sunday =
  // the final one. Mon–Thu and Saturday collapse it to one footer line with no
  // link — on those days the numbers have barely moved, and it was pushing the
  // first piece of actual content down to ~29% of the message.
  const dowNum = (() => {
    const t = new Date(`${now}T00:00:00Z`);
    if (isNaN(t)) return 1;
    const v = t.getUTCDay(); // 0 = Sunday
    return v === 0 ? 7 : v; // 1..7, Monday = 1
  })();
  const isBoardDay = dowNum === 5 || dowNum === 7; // Friday, Sunday
  const boardIsFinal = dowNum === 7;
  // Board = the week's locked works ranked by score, resolved from files the digest
  // already fetched (no extra subrequests, no link supplementation).
  const weeklyWorkIdx = buildWeeklyWorkIndex(d);
  const boardItems = isBoardDay
    ? weeklyLockedWorks(weeklyLock, weeklyWorkIdx)
      .filter(w => w.rating > 0 && w.title)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 10)
    : [];
  const isNewThisWeek = (w) => weekStartOf(now) && w.releaseDate && w.releaseDate.slice(0, 10) >= weekStartOf(now) && w.releaseDate.slice(0, 10) <= now;
  const weeklyCumulativeHtml = (isBoardDay && boardItems.length)
    ? `<div style="background:#000;border:4px solid #00ff00;padding:12px;margin-bottom:16px">
    ${title(`📈 ${boardIsFinal ? L("本周最终榜", "WEEKLY BOARD · FINAL") : L("本周 Top 10", "WEEKLY TOP 10")}${boardWeekStart ? ` · ${boardWeekStart.slice(5)} ~ ${boardWeekEnd.slice(5)}` : ""}`)}
    <p style="font-size:11px;color:#aaa;margin:0 0 6px">${boardIsFinal
      ? L("本周锁定作品按评分排序，周日定榜，下周一重新开榜。", "The week's locked works by score — final board, reopens Monday.")
      : L("周四前锁定的作品按评分排序，周日还会更新一次。", "Locked works ranked by score; the board updates once more on Sunday.")}</p>
    <table style="width:100%;border-collapse:collapse">
      ${boardItems.map((w, i) => `<tr><td style="padding:3px 4px;font-size:10px;color:#00ff00;background:#111;width:18px">${i + 1}</td><td style="padding:3px 4px;font-size:12px;color:#fff;background:#111">${w.mediaType === "tv" ? "📺 " : "🎬 "}${pickTitle(w)}${isNewThisWeek(w) ? `<span style="color:#00ff00;font-size:9px;font-weight:bold;margin-left:4px">${L("新", "NEW")}</span>` : ""}</td><td style="padding:3px 4px;font-size:11px;color:#ffff00;background:#111;text-align:right;white-space:nowrap;width:34px">${w.rating.toFixed(1)}</td></tr>`).join("")}
    </table>
    <p style="font-size:11px;color:#aaa;margin:8px 0 0">${L(
      `本周已累计 ${weeklyTotal} 条${weeklyDeltaTotal > 0 ? ` · 今日 +${weeklyDeltaTotal}` : ""}（周一选定即保留，周内只增不减）`,
      `${weeklyTotal} items this week${weeklyDeltaTotal > 0 ? ` · +${weeklyDeltaTotal} today` : ""} (locked Monday, only grows)`
    )}</p>
  </div>`
    : "";
  // Collapsed variant for Mon–Thu + Sat (and any board day where the board rendered
  // nothing): one footer line, no link. The nudge names the NEXT board, so Saturday
  // does not advertise a Friday that already happened.
  const boardNudge = dowNum >= 1 && dowNum <= 4 ? L("周五出榜", "board Friday")
    : dowNum === 6 ? L("周日定榜", "final Sunday")
    : "";
  const weeklyFooterLine = (weeklyRows.length && !weeklyCumulativeHtml)
    ? `<p style="font-size:10px;color:#666;margin:10px 0 0;line-height:1.6">📈 ${L(
      `本周已收 ${weeklyTotal} 条${weeklyDeltaTotal > 0 ? ` · 今日 +${weeklyDeltaTotal}` : ""}${boardNudge ? ` · ${boardNudge}` : ""}`,
      `${weeklyTotal} collected this week${weeklyDeltaTotal > 0 ? ` · +${weeklyDeltaTotal} today` : ""}${boardNudge ? ` · ${boardNudge}` : ""}`
    )}</p>`
    : "";

  // ── Industry highlights: dedupe against the summary + contradiction guard ──
  // (2026-11-07, Rex-approved.) Two concrete defects shipped in real sends:
  //   ① bullet #1 restated the summary verbatim ("今日无新片上映，本周仅两部新片入市。")
  //   ② bullet #4 claimed "近期暂无重点待映项目" while the calendar below it listed
  //      7 dated releases. ② is unfixable at the data layer from here (the AI writes
  //      from TMDB /movie/upcoming, which never sees coming.json), so filter it out
  //      whenever the calendar actually has rows.
  const normText = (s) => String(s || "").replace(/[\s，。；、,.;:：!?！？—…“”"'‘’()（）·﹒]/g, "").toLowerCase();
  const citedTitles = (s) => (String(s || "").match(/《([^》]{1,40})》/g) || []).map(x => normText(x.slice(1, -1)));
  // Character-bigram Dice — cheap and language-agnostic, so a Chinese paraphrase
  // ("电影热度由《X》与《Y》领跑" vs summary "电影端《X》与《Y》领跑") is caught by
  // overlap instead of by an LLM call. Thresholds tuned on real 2026-11-07 copy:
  // verbatim restatement = 0.406 (also caught by the substring rule), paraphrase
  // of the same titles = 0.468, unrelated bullet = 0.171 / 0.000.
  const bigrams = (s) => { const b = new Set(); for (let i = 0; i < s.length - 1; i++) b.add(s.slice(i, i + 2)); return b; };
  const dice = (a, b) => {
    if (!a || !b) return 0;
    const A = bigrams(a), B = bigrams(b);
    let n = 0;
    for (const x of A) if (B.has(x)) n++;
    return (2 * n) / (A.size + B.size);
  };
  const NEG_ASSERTION = /暂无|尚无|没有(待映|待播|上映|新片|新剧|重点)|无(待映|待播|上映|新片|新剧)|nothing\s+(new|upcoming)|none\s+(notable|upcoming)|no\s+(upcoming|new)\s+(releases?|titles?)/i;
  const calendarHasRows = (movieCalendar.length > 0 || tvCalendar.length > 0);
  const summaryNorm = normText(summaryZh);
  const summaryCited = citedTitles(summaryZh);
  const highlightsRaw = highlightsSource.filter(h => {
    const txt = ((en ? (h.en || h.text) : h.text) || "");
    const nt = normText(txt);
    if (!nt) return false;
    if (NEG_ASSERTION.test(txt) && calendarHasRows) return false;
    if (summaryNorm && summaryNorm.includes(nt)) return false;
    if (dice(nt, summaryNorm) >= 0.35) return false;
    const cited = citedTitles(txt);
    if (cited.length && cited.every(t => summaryCited.some(s => s.includes(t) || t.includes(s)))) return false;
    return true;
  }).slice(0, 4);
  const highlights = highlightsRaw.map(h => (en ? (h.en || h.text) : h.text));
  const highlightsHtml = highlights.length
    ? `<ul style="margin:8px 0 0;padding-left:16px">${highlights.map(h => `<li style="font-size:11px;color:#aaa;line-height:1.6">${h}</li>`).join("")}</ul>`
    : "";

  // ── Wall additions — today's new movies/TV on the wall (delta files; section
  // renders only when there IS an increment, so quiet days add zero length) ──
  const wallNewMovies = (wallDelta.movies || []).slice(0, 4);
  const wallNewShows = (tvWallDelta.shows || []).slice(0, 4);
  const hasWallNews = wallNewMovies.length > 0 || wallNewShows.length > 0;

  // ── Movie picks — AI-curated from today's movie intelligence (gems, mediaType != tv) ──
  const gemsAll = gemsData.gems || [];
  const moviePicks = gemsAll.filter(g => g.mediaType !== "tv").slice(0, 5);
  const moviePicksHtml = moviePicks.length
    ? moviePicks.map(g => {
      const gtags = ((en ? (g.tagsEn || g.tags) : g.tags) || []).slice(0, 3).map(t => `<span style="display:inline-block;background:#ff00ff;color:#000;padding:1px 5px;font-size:9px;font-weight:bold;margin:2px 2px 0 0">${t}</span>`).join("");
      const poster = thumb(g.poster);
      return `<div style="background:#000;border:2px solid #ff00ff;padding:8px;margin:6px 0">
  <table style="width:100%"><tr>
    ${poster ? `<td style="width:92px;vertical-align:top;padding-right:8px"><img src="${poster}" alt="" style="width:92px;height:138px;border:1px solid #333;display:block"></td>` : ""}
    <td style="vertical-align:top">
      <div style="font-size:14px;color:#ff00ff;font-weight:bold"><a href="https://bloodyrex.xyz/?from=digest&r=${g.tmdbId}" style="color:#ff00ff;text-decoration:none">${pickTitle(g) || ""}</a></div>
      <div style="font-size:11px;color:#999;margin-top:2px">${L("评分", "Rated")} ${g.rating || 0}/10${g.year ? ` · ${g.year}` : ""}</div>
      ${g.whyWatch ? `<div style="font-size:12px;color:#ccc;margin-top:4px;line-height:1.4">${en ? (g.whyWatchEn || g.whyWatch) : g.whyWatch}</div>` : (g.summary ? `<div style="font-size:12px;color:#ccc;margin-top:4px;line-height:1.4">${(en ? (g.summaryEn || g.summary) : g.summary).slice(0, 80)}</div>` : "")}
      ${gtags ? `<div style="margin-top:4px">${gtags}</div>` : ""}
    </td>
  </tr></table>
</div>`;
    }).join("")
    : "";

  // ── TV picks — AI-curated from today's TV intelligence (gems, mediaType = tv) ──
  const tvPicks = gemsAll.filter(g => g.mediaType === "tv").slice(0, 5);
  const tvPicksHtml = tvPicks.length
    ? tvPicks.map(s => {
      const g = genreStr(s.genre);
      const se = s.season ? `S${s.season}${s.episode ? `E${s.episode}` : ""}` : "";
      const tag = se ? `${se} · ` : "";
      const gtags = ((en ? (s.tagsEn || s.tags) : s.tags) || []).slice(0, 3).map(t => `<span style="display:inline-block;background:#00ffff;color:#000;padding:1px 5px;font-size:9px;font-weight:bold;margin:2px 2px 0 0">${t}</span>`).join("");
      const poster = thumb(s.poster);
      return `<div style="background:#000;border:2px solid #00ffff;padding:8px;margin:6px 0">
  <table style="width:100%"><tr>
    ${poster ? `<td style="width:92px;vertical-align:top;padding-right:8px"><img src="${poster}" alt="" style="width:92px;height:138px;border:1px solid #333;display:block"></td>` : ""}
    <td style="vertical-align:top">
      <div style="font-size:14px;color:#00ffff;font-weight:bold"><a href="https://bloodyrex.xyz/?from=digest&r=${s.tmdbId}&type=tv" style="color:#00ffff;text-decoration:none">${pickTitle(s) || ""}</a></div>
      <div style="font-size:11px;color:#999;margin-top:2px">${tag}${g} · ${L("评分", "Rated")} ${s.rating || 0}/10</div>
      ${s.whyWatch ? `<div style="font-size:12px;color:#ccc;margin-top:4px;line-height:1.4">${en ? (s.whyWatchEn || s.whyWatch) : s.whyWatch}</div>` : (s.summary ? `<div style="font-size:12px;color:#ccc;margin-top:4px;line-height:1.4">${(en ? (s.summaryEn || s.summary) : s.summary).slice(0, 80)}</div>` : "")}
      ${gtags ? `<div style="margin-top:4px">${gtags}</div>` : ""}
    </td>
  </tr></table>
</div>`;
    }).join("")
    : "";

  // ── Music Section (enhanced: multi-category with highlights) ──
  const musicPicks = musicData.picks || [];
  const musicCategories = [
    { id: "trending", label: L("🔥 热门趋势", "🔥 Trending"), color: "#ff00ff" },
    { id: "editor", label: L("⭐ 编辑推荐", "⭐ Editor's Pick"), color: "#ffff00" },
    { id: "hidden", label: L("💎 隐藏宝石", "💎 Hidden Gem"), color: "#00ffff" },
    { id: "world", label: L("🌍 环球音乐", "🌍 World Music"), color: "#00ff00" },
  ];
  const musicHtml = musicPicks.length
    ? musicCategories.map(cat => {
      // 2 → 3 per category (Rex 2026-11-07): with 22 locked picks and only 8 slots,
      // eleven albums never appeared once. 12 slots covers half the pool for +~700
      // bytes; it dilutes (not eliminates) the frozen-top-3 effect, which is an
      // upstream `music-pipeline` ordering issue, tracked separately.
      const items = musicPicks.filter(p => p.recommendationTagId === cat.id).slice(0, 3);
      if (!items.length) return "";
      return `<div style="margin:6px 0">
  <p style="font-size:11px;color:${cat.color};font-weight:bold;margin:0 0 4px;text-transform:uppercase">${cat.label}</p>
  ${items.map(a => {
    // Rex 2026-08-25 v2: EN must not leak zh — use highlightEn (minus its
    // "from {artist}" tail, which duplicates the artist already shown);
    // zh keeps its highlight with the embedded "· Nk 听众" stripped
    // (listeners are rebuilt per-locale below).
    let hl = "";
    if (en) {
      const src = a.highlightEn || a.summaryEn || "";
      let s = src;
      if (s && a.artist) {
        const esc = String(a.artist).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        s = s.replace(new RegExp(`\\s+from\\s+${esc}\\s*$`, "i"), "");
      }
      hl = s ? ` — ${s}` : "";
    } else {
      hl = a.highlight ? ` — ${a.highlight}` : "";
      hl = hl.replace(/\s*·\s*[\d.,]+k\s*听众/g, "");
    }
    // Rex 2026-11-07: listener counts removed — the number says nothing about
    // whether the album is worth hearing, and it read as filler next to the AI
    // highlight. Highlight text also stops mentioning it (zh regex above).
    return `<div style="font-size:12px;color:#ccc;line-height:1.5;padding:2px 0"><strong style="color:#fff">${a.title || ""}</strong>${a.artist ? ` <span style="color:#999">${a.artist}</span>` : ""}${hl}</div>`;
  }).join("")}
</div>`;
    }).join("")
    : "";

  // ── Wall additions section (movies + TV, only when there's an increment) ──
  const wallNewsHtml = !hasWallNews ? "" : `
  ${title(L("🧱 影视墙今日新增", "🧱 NEW ON THE WALL"))}
  <div style="background:#000;border:2px solid #00ff00;padding:10px;margin:6px 0">
    ${wallNewMovies.length ? `<p style="font-size:11px;color:#00ff00;font-weight:bold;text-transform:uppercase;margin:0 0 4px">🎬 ${L("电影", "MOVIES")}</p>
    <table style="width:100%;border-collapse:collapse">${wallNewMovies.map(m => `<tr><td style="padding:2px 4px;font-size:12px;color:#fff;background:#111">${pickTitle(m)}</td><td style="padding:2px 6px;font-size:10px;color:#999;text-align:right;background:#111;white-space:nowrap">${m.releaseDate || m.year || ""}</td></tr>`).join("")}</table>` : ""}
    ${wallNewShows.length ? `${wallNewMovies.length ? '<div style="border-top:1px dashed #333;margin:8px 0"></div>' : ""}
    <p style="font-size:11px;color:#00ffff;font-weight:bold;text-transform:uppercase;margin:0 0 4px">📺 ${L("剧集", "TV")}</p>
    <table style="width:100%;border-collapse:collapse">${wallNewShows.map(s => {
      const se = s.season ? ` S${s.season}` : "";
      return `<tr><td style="padding:2px 4px;font-size:12px;color:#fff;background:#111">${pickTitle(s)}${se}</td><td style="padding:2px 6px;font-size:10px;color:#999;text-align:right;background:#111;white-space:nowrap">${s.latestAirDate || s.year || ""}</td></tr>`;
    }).join("")}</table>` : ""}
  </div>
  <div style="text-align:right;margin:4px 0">
    <a href="https://bloodyrex.xyz/wall?utm_source=digest&utm_medium=email&utm_campaign=daily" style="font-size:11px;color:#00ff00">${L("浏览完整影视墙 →", "Browse the full wall →")}</a>
  </div>`;

  // ── Assemble full HTML ──
  const unsubUrl = `https://api.bloodyrex.xyz/intelligence/unsubscribe?email=`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>a{color:#999;text-decoration:none}@media only screen and (max-width:480px){.body{padding:10px!important}}</style>
</head>
<body style="margin:0;padding:0;color:#eee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:560px;margin:0 auto;padding:20px;background:#111">

  <!-- Header -->
  <div style="background:#ff00ff;padding:14px;text-align:center;border:4px solid #000;margin-bottom:16px">
    <h1 style="margin:0;font-size:18px;color:#000;text-transform:uppercase;letter-spacing:2px">KIM'S VIDEO · ${now}</h1>
    <p style="margin:4px 0 0;font-size:10px;color:#000;text-transform:uppercase;letter-spacing:1px">${L("每日影音情报摘要", "Daily Entertainment Digest")}${date && date !== now ? ` · ${L("数据截至", "data as of")} ${date}` : ""}</p>
  </div>

  <!-- Weekly feature announcement -->
  ${weeklyAnnouncementHtml}

  <!-- 本周累计：周五/周日为榜单（置顶），其余日子折叠为页脚一行 -->
  ${weeklyCumulativeHtml}

  <!-- Daily Digest -->
  ${headline || summaryZh ? `
  <div style="background:#000;border:4px solid #ffff00;padding:14px;margin-bottom:16px">
    ${title(L("📰 每日摘要", "📰 DAILY DIGEST"))}
    ${headline ? `<h2 style="margin:0;font-size:15px;color:#ffff00;line-height:1.4">${headline}</h2>` : ""}
    ${summaryZh ? `<p style="font-size:12px;color:#ccc;line-height:1.6;margin:6px 0 0">${summaryZh}</p>` : ""}
    ${highlightsHtml}
    ${trendsHtml}
  </div>` : ""}

  <!-- Today's Star (one standout pick — movie or TV — daily, never repeated across days) -->
  ${todayStar ? `
  <div style="background:#000;border:4px solid #ffff00;padding:12px;margin-bottom:16px">
    ${title(L("⭐ 今日之星", "⭐ TODAY'S STAR"))}
    <table style="width:100%"><tr>
      ${todayStar.poster ? `<td style="width:92px;vertical-align:top;padding-right:8px"><img src="${thumb(todayStar.poster)}" alt="" style="width:92px;height:138px;border:1px solid #333;display:block"></td>` : ""}
      <td style="vertical-align:top">
        <div style="font-size:16px;color:#ffff00;font-weight:bold"><a href="https://bloodyrex.xyz/?from=digest&r=${todayStar.tmdbId}${todayStar.mediaType === "tv" ? "&type=tv" : ""}" style="color:#ffff00;text-decoration:none">${pickTitle(todayStar) || ""}</a></div>
        <div style="font-size:11px;color:#999;margin-top:2px">${L(todayStar.mediaType === "tv" ? "📺 剧集" : "🎬 电影", todayStar.mediaType === "tv" ? "📺 TV" : "🎬 MOVIE")}${todayStar.rating ? ` · ${L("评分", "Rated")} ${todayStar.rating}/10` : ""}${todayStar.year ? ` · ${todayStar.year}` : ""}</div>
        ${(en ? todayStar.reasonEn : todayStar.reason) ? `<div style="font-size:12px;color:#ccc;margin-top:4px;line-height:1.5">${en ? todayStar.reasonEn : todayStar.reason}</div>` : ""}
      </td>
    </tr></table>
  </div>` : ""}

  <!-- Release Calendar (Movies + TV) -->
  ${calendarHtml ? `
  ${title(L("📅 排片日历", "📅 RELEASE CALENDAR"))}
  ${calendarHtml}` : ""}

  ${calendarHtml ? divider : ""}

  <!-- Festival calendar status (running now, or the next station) -->
  ${festivalHtml ? `
  ${title(L("🎪 电影节动态", "🎪 FESTIVAL WATCH"))}
  ${festivalHtml}` : ""}

  ${festivalHtml ? divider : ""}

  <!-- Movie Picks (daily AI-curated) -->
  ${moviePicksHtml ? `
  ${title(L("🎬 今日电影推荐", "🎬 TODAY'S MOVIE PICKS"))}
  ${moviePicksHtml}
  <div style="text-align:right;margin:4px 0">
    <a href="https://bloodyrex.xyz/intelligence/movies?utm_source=digest&utm_medium=email&utm_campaign=daily" style="font-size:11px;color:#ff00ff">${L("查看全部电影 →", "All movies →")}</a>
  </div>` : ""}

  ${moviePicksHtml ? divider : ""}

  <!-- TV Picks (premieres this week) -->
  ${tvPicksHtml ? `
  ${title(L("📺 今日剧集推荐", "📺 TODAY'S TV PICKS"))}
  ${tvPicksHtml}
  <div style="text-align:right;margin:4px 0">
    <a href="https://bloodyrex.xyz/intelligence/tv?utm_source=digest&utm_medium=email&utm_campaign=daily" style="font-size:11px;color:#00ffff">${L("查看全部剧集 →", "All TV →")}</a>
  </div>` : ""}

  ${tvPicksHtml ? divider : ""}

  <!-- Music Section (enhanced: multi-category with highlights) -->
  ${musicHtml ? `
  ${title(L("💿 本周音乐精选", "💿 THIS WEEK'S MUSIC"))}
  <div style="background:#000;border:2px solid #ffff00;padding:10px;margin:6px 0">
    ${musicHtml}
  </div>
  <div style="text-align:right;margin:4px 0">
    <a href="https://bloodyrex.xyz/intelligence/music?utm_source=digest&utm_medium=email&utm_campaign=daily" style="font-size:11px;color:#ffff00">${L("查看全部专辑 →", "All albums →")}</a>
  </div>` : ""}

  ${musicHtml ? divider : ""}

  <!-- New on the wall (only on days with additions) -->
  ${wallNewsHtml}

  ${wallNewsHtml ? divider : ""}

  <!-- CTA -->
  <div style="text-align:center;margin:16px 0">
    <a href="https://bloodyrex.xyz/intelligence?utm_source=digest&utm_medium=email&utm_campaign=daily" style="display:inline-block;background:#ffff00;color:#000;padding:12px 28px;font-weight:bold;font-size:13px;border:4px solid #000;text-decoration:none;text-transform:uppercase;letter-spacing:1px">${L("查看完整情报", "FULL INTELLIGENCE")}</a>
  </div>

  <!-- Footer -->
  ${weeklyFooterLine}
  <div style="border-top:2px dashed #333;margin:16px 0;padding-top:12px;text-align:center">
    <p style="font-size:10px;color:#666;margin:0 0 4px">
      <a href="${unsubUrl}" style="color:#666;text-decoration:underline">${L("取消订阅", "Unsubscribe")}</a>
      <span style="color:#444"> · </span>
      <a href="https://bloodyrex.xyz" style="color:#666">bloodyrex.xyz</a>
    </p>
    <p style="font-size:9px;color:#444;margin:0">Sent by Kim's Video · Rex Huang</p>
  </div>

</div></body></html>`;

  return { html, date, stats, headline: dig.headline || "", headlineEn: dig.headlineEn || dig.headline || "" };
}

function digestShownKeys(d) {
  const shown = new Set();
  const gemsAll = d?.gemsData?.gems || [];
  const addKeys = (arr) => (arr || []).forEach(x => {
    if (!x) return;
    const id = x.tmdbId ?? x.id;
    if (id == null) return;
    shown.add(`${x.mediaType === "tv" ? "tv" : "movie"}:${id}`);
  });
  addKeys(gemsAll.filter(g => g.mediaType !== "tv").slice(0, 5)); // movie picks
  addKeys(gemsAll.filter(g => g.mediaType === "tv").slice(0, 5)); // tv picks
  addKeys((d?.wallDelta?.movies || []).slice(0, 4));
  addKeys((d?.tvWallDelta?.shows || []).slice(0, 4));
  addKeys((d?.comingData?.next30Days || []).slice(0, 24)); // calendar rows
  return shown;
}

async function pickTodayStar(env, data, today) {
  if (!env?.SUBSCRIBE_KV) return null;
  const starKey = `dailyStar:${today}`;
  const existing = await env.SUBSCRIBE_KV.get(starKey).catch(() => null);
  if (existing) {
    try { return JSON.parse(existing); } catch { /* fall through to rebuild */ }
  }
  const gemsAll = data?.gemsData?.gems || [];
  if (!Array.isArray(gemsAll) || !gemsAll.length) return null;

  const weekKey = `dailyStar:history:${weekStartOf(today) || today}`;
  const histRaw = await env.SUBSCRIBE_KV.get(weekKey).catch(() => null);
  let history = [];
  try { history = (JSON.parse(histRaw) || []); } catch { history = []; }
  const usedThisWeek = new Set(history.map(h => `${h.mediaType}:${h.tmdbId}`));
  const shownToday = digestShownKeys(data);

  const idx = buildWeeklyWorkIndex(data);
  const lockedWorks = weeklyLockedWorks(data?.weeklyLock, idx)
    .filter(w => w.rating > 0 && w.title && w.poster);

  const scoreOf = (x) => (x.rating || 0) + (x.whyWatch ? 2 : x.summary ? 1 : 0) + (x.poster ? 1 : 0);
  const keyOf = (x) => `${x.mediaType === "tv" ? "tv" : "movie"}:${x.tmdbId}`;
  const pickFrom = (pool, excludeShown) => pool
    .filter(x => x && x.tmdbId && !usedThisWeek.has(keyOf(x)))
    .filter(x => (excludeShown ? !shownToday.has(keyOf(x)) : true))
    .map(x => ({ x, score: scoreOf(x) }))
    .sort((a, b) => b.score - a.score)[0]?.x || null;

  // Relaxation ladder — the section must never vanish:
  //   ① fresh work, not shown anywhere else today (the intended case)
  //   ② fresh for the week, even if it appears in the picks below
  //   ③ best of today's gems regardless of history (only if the week truly ran dry)
  const pool = [...gemsAll.filter(g => g && g.tmdbId), ...lockedWorks];
  let picked = pickFrom(pool, true) || pickFrom(pool, false) || (() => {
    const fallback = gemsAll
      .filter(g => g && g.tmdbId)
      .map(g => ({ x: g, score: scoreOf(g) }))
      .sort((a, b) => b.score - a.score)[0];
    return fallback ? fallback.x : null;
  })();
  if (!picked) return null;

  const type = picked.mediaType === "tv" ? "tv" : "movie";
  const star = {
    tmdbId: picked.tmdbId,
    mediaType: type,
    title: picked.title || "",
    titleEn: picked.titleEn || picked.title || "",
    poster: picked.poster || "",
    rating: picked.rating || 0,
    year: picked.year || "",
    reason: picked.whyWatch || picked.summary || `评分 ${picked.rating || 0}/10 的${type === "tv" ? "剧集" : "电影"}，今日值得一看`,
    reasonEn: picked.whyWatchEn || picked.summaryEn || picked.whyWatch || picked.summary || `Rated ${picked.rating || 0}/10 — worth a look today`,
  };
  // Append then persist. Concurrency here is negligible (one cron build/day); the
  // usedThisWeek Set makes a rare duplicate history row harmless.
  if (!usedThisWeek.has(`${type}:${picked.tmdbId}`)) history.push({ mediaType: type, tmdbId: picked.tmdbId });
  await env.SUBSCRIBE_KV.put(weekKey, JSON.stringify(history)).catch(() => {});
  await env.SUBSCRIBE_KV.put(starKey, JSON.stringify(star), { expirationTtl: 172800 }).catch(() => {});
  return star;
}

async function buildDigestHTML(env, now) {
  now = now || intelToday();
  const data = await withTimeout(fetchDigestData(), 45000, "fetchDigestData");
  // Today's Star: inject into render data so both zh+en share one pick (deduped once daily).
  const star = await pickTodayStar(env, data, now).catch(() => null);
  if (star) data.todayStar = star;
  const zh = renderDigestHtml(data, now, "zh");
  const enResult = renderDigestHtml(data, now, "en");
  return {
    html: zh.html,
    htmlEn: enResult.html,
    date: zh.date,
    stats: zh.stats,
    headline: zh.headline,
    headlineEn: enResult.headline,
  };
}
async function handleSendDigest(request, env) {
  const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
  const auth = request.headers.get("Authorization");
    if (!auth || auth !== `Bearer ${env.DIGEST_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    let force = false;
    try { const b = await request.json().catch(() => ({})); force = !!b.force; } catch {}
    const result = await sendDigestToAll(env, { force });
    return Response.json(result, { headers: corsHeaders });
}

async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function sendDigestToAll(env, opts = {}) {
  // opts.force = bypass today's "already sent" guard (used for manual resend/retry)
  const FORCE = !!opts.force;
  if (!env.RESEND_API_KEY) return { ok: false, error: "Resend not configured" };
  if (!env.SUBSCRIBE_KV) return { ok: false, error: "KV not configured" };

  const today = intelToday();
  const digestKey = `digestStatus:${today}`;

  // ── Attempt tracking: max 3 retries per day ──
  const raw = await env.SUBSCRIBE_KV.get(digestKey);
  const status = raw ? JSON.parse(raw) : null;

  // Backward compat: also check old lastDigestSent key
  if (status?.status === "sent" && !FORCE) {
    return { ok: true, sent: 0, skipped: "already sent today" };
  }
  const oldSent = await env.SUBSCRIBE_KV.get("lastDigestSent");
  if (oldSent === today && !status && !FORCE) {
    // Migrate old key to new format
    await env.SUBSCRIBE_KV.put(digestKey, JSON.stringify({ status: "sent", attemptCount: 1 }), { expirationTtl: 172800 });
    return { ok: true, sent: 0, skipped: "already sent today" };
  }

  const attemptCount = (status?.attemptCount || 0) + 1;
  if (attemptCount > 3 && !FORCE) {
    return { ok: false, sent: 0, error: "max retries reached", attemptCount };
  }

  // Mark this attempt
  await env.SUBSCRIBE_KV.put(digestKey, JSON.stringify({ status: "attempting", attemptCount }), { expirationTtl: 172800 });

  // ── Subscriber list: KV list() returns at most 1000 keys per call and does
  // NOT auto-page. Before 2026-10-02 this was a single bare list() — subscribers
  // past the first 1000 keys silently got no digest at all (same silent-
  // truncation class as the old /wall/recs 997-item cut). Page with the cursor,
  // capped so one invocation cannot blow the 1000-API-request budget. ──
  const SUB_LIST_MAX_PAGES = 20; // ≤20k subscribers
  const subKeys = [];
  let subCursor, subPages = 0, subComplete = false;
  do {
    const page = await env.SUBSCRIBE_KV.list({ prefix: "sub:", cursor: subCursor, limit: 1000 });
    subKeys.push(...page.keys);
    subComplete = !!page.list_complete;
    subCursor = subComplete ? null : page.cursor;
    subPages++;
  } while (subCursor && subPages < SUB_LIST_MAX_PAGES);
  if (!subComplete) {
    console.warn(`subscriber list truncated: ${subKeys.length} keys after ${subPages} pages (SUB_LIST_MAX_PAGES=${SUB_LIST_MAX_PAGES}) — some subscribers will be skipped`);
  }
  const list = { keys: subKeys };
    if (!list.keys.length) {
      // No subscribers — mark as sent so we don't retry today
      await env.SUBSCRIBE_KV.put(digestKey, JSON.stringify({ status: "sent", attemptCount }), { expirationTtl: 172800 });
      return { ok: true, sent: 0, subscriberCount: 0 };
    }

  // ── Build or retrieve cached digest (generated once per day) ──

  let html, htmlEn, date, headline = "", headlineEn = "";
  let rebuildCache = false;
  const cachedDigest = await env.SUBSCRIBE_KV.get(`digest:${today}`);
  if (cachedDigest) {
    const parsed = JSON.parse(cachedDigest);
    // Validate cached date against current digest.json — if data has been
    // updated after cache was built (e.g. pipeline re-run), rebuild fresh
    try {
      const digCheck = await fetch("https://bloodyrex.xyz/api/digest.json").then(r => r.ok ? r.json() : null);
      if (digCheck?.date && digCheck.date !== parsed.date) {
        console.log(`Cache stale: cached=${parsed.date}, current=${digCheck.date} — rebuilding`);
        rebuildCache = true;
      }
    } catch {}
    if (!rebuildCache) {
      html = parsed.html;
      htmlEn = parsed.htmlEn || parsed.html; // caches from before the bilingual build fall back to zh
      date = parsed.date;
      headline = parsed.headline || "";
      headlineEn = parsed.headlineEn || parsed.headline || "";
    }
  }
  if (!html) {
    // Build with timeout (60s — generous for cron, avoids hanging HTTP requests)
    const result = await withTimeout(
      buildDigestHTML(env, today),
      60000,
      "buildDigestHTML"
    ).catch(e => {
      console.warn("Digest build failed:", e.message);
      return null;
    });
    if (!result) {
      await env.SUBSCRIBE_KV.put(digestKey, JSON.stringify({ status: "failed", attemptCount }), { expirationTtl: 172800 });
      return { ok: false, sent: 0, error: "digest build failed", attemptCount };
    }
    html = result.html;
    htmlEn = result.htmlEn || result.html;
    date = result.date;
    headline = result.headline || "";
    headlineEn = result.headlineEn || result.headline || "";
    // Sanity check: if overview returned all-zero stats, TMDB likely failed
    // Don't cache bad data; let retry rebuild fresh
    if (!result.stats?.moviesReleased && !result.stats?.tvAiringThisWeek) {
      console.warn("Digest overview data empty, will retry on next attempt");
      await env.SUBSCRIBE_KV.delete(`digest:${today}`);
      await env.SUBSCRIBE_KV.put(digestKey, JSON.stringify({ status: "failed", attemptCount }), { expirationTtl: 172800 });
      return { ok: false, sent: 0, error: "overview data empty (TMDB likely failed)", attemptCount };
    }
    // Cache digest content for 24h so all sends on the same day use identical content
    await env.SUBSCRIBE_KV.put(`digest:${today}`, JSON.stringify({ html, htmlEn, date, headline, headlineEn }), { expirationTtl: 172800 });
  }

  // ── Send loop: batch via Resend /emails/batch (1 subrequest per 100 emails).
  // Rex 2026-08-25 bilingual: subscriber records store { locale } — group emails
  // by language and send each group its HTML. KV GET per subscriber is capped at
  // LOCALE_READ_CAP (free-plan subrequest budget is 50/invocation); past the cap
  // we stop reading and default to zh so sends never fail on scale. ──
  const LOCALE_READ_CAP = 35;
  const zhEmails = [];
  const enEmails = [];
  let localeReads = 0;
  for (const key of list.keys) {
    const email = key.name.startsWith("sub:") ? key.name.slice(4) : key.name;
    if (!email || !email.includes("@")) continue;
    let loc = "zh";
    if (localeReads < LOCALE_READ_CAP) {
      try {
        const raw = await env.SUBSCRIBE_KV.get(key.name);
        localeReads++;
        const parsedSub = raw ? JSON.parse(raw) : null;
        if (parsedSub?.locale === "en") loc = "en";
      } catch {}
    }
    (loc === "en" ? enEmails : zhEmails).push(email);
  }
  const buildEmail = (email, subjHeadline, bodyHtml) => ({
    from: "Kim's Video <digest@bloodyrex.xyz>",
    to: email,
    subject: subjHeadline ? `🎬 ${subjHeadline} · Kim's Video ${today}` : `Kim's Video 每日影音情报 · ${today}`,
    html: bodyHtml.replace(
      /https:\/\/api\.bloodyrex\.xyz\/intelligence\/unsubscribe\?email=[^"'<>\s]*/g,
      `https://api.bloodyrex.xyz/intelligence/unsubscribe?email=${encodeURIComponent(email)}`
    ),
  });
  const emails = [
    ...zhEmails.map(e => buildEmail(e, headline, html)),
    ...enEmails.map(e => buildEmail(e, headlineEn || headline, htmlEn)),
  ];
  let sent = 0;
    const BATCH_SIZE = 100;
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const chunk = emails.slice(i, i + BATCH_SIZE);
      try {
        const br = await withTimeout(
          fetch("https://api.resend.com/emails/batch", {
            method: "POST",
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify(chunk),
          }),
          30000,
          `Resend batch (${chunk.length} emails)`
        );
        const bdata = await br.json().catch(() => ({}));
        if (br.ok) {
          sent += chunk.length;
        } else {
          console.warn("Resend batch failed:", br.status, JSON.stringify(bdata).slice(0, 300));
        }
      } catch (e) { console.warn("Resend batch error:", e.message); }
    }

    // Record status
    if (sent > 0) {
    await env.SUBSCRIBE_KV.put(digestKey, JSON.stringify({ status: "sent", attemptCount }), { expirationTtl: 172800 });
    // Also write old key for backward compat during migration window
    await env.SUBSCRIBE_KV.put("lastDigestSent", today, { expirationTtl: 172800 });
  } else {
        // No emails sent — clear cached digest so next retry rebuilds fresh
        await env.SUBSCRIBE_KV.delete(`digest:${today}`);
        await env.SUBSCRIBE_KV.put(digestKey, JSON.stringify({ status: "failed", attemptCount }), { expirationTtl: 172800 });
      }

      return { ok: true, sent, subscriberCount: list.keys.length };
    }

// ═══════════════════════════════════════════════════════════════════
// Router（仅保留 digest 邮件端点 + cron）
// ═══════════════════════════════════════════════════════════════════
export default {
  async fetch(request, env, ctx) {
    // KV warm-up: ensure consistent reads after cold start / deploy
    ctx.waitUntil(env.SUBSCRIBE_KV?.get("__warmup").catch(() => {}));
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
      // Daily digest AI summary
      if (path === "/intelligence/digest") {
        try {
          return Response.json(await handleIntelDigest(env), { headers: corsHeaders });
        } catch (e) {
          return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
        }
      }
      // Unsubscribe page
      if (path === "/intelligence/unsubscribe") {
        return handleUnsubscribe(request, env);
      }
      // Fallback: health check
      return Response.json({ status: "ok", worker: "digest" }, { headers: corsHeaders });
    }

    // ── POST routes ──
    if (method === "POST") {
      // Subscribe
      if (path === "/intelligence/subscribe") {
        return handleSubscribe(request, env);
      }

      // Send digest (internal, authenticated)
      if (path === "/intelligence/send-digest") {
        return handleSendDigest(request, env);
      }

      if (path === "/intelligence/send-test") {
        let tb; try { tb = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); }
        const auth = request.headers.get("Authorization");
        if (!auth || auth !== `Bearer ${env.DIGEST_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
        if (!tb.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tb.email)) return Response.json({ error: "Invalid email" }, { status: 400, headers: corsHeaders });
        try {
          const today = intelToday();
          const result = await withTimeout(buildDigestHTML(env, today), 50000, "buildDigestHTML");
          if (!result?.html) return Response.json({ error: "digest build failed" }, { status: 500, headers: corsHeaders });
          // Rex 2026-08-25 bilingual test: body.locale picks the variant (default zh)
          const isEn = tb.locale === "en";
          const pickHtml = (isEn ? (result.htmlEn || result.html) : result.html);
          const subjHeadline = isEn ? (result.headlineEn || result.headline) : result.headline;
          const personalHtml = pickHtml.replace(
            /https:\/\/api\.bloodyrex\.xyz\/intelligence\/unsubscribe\?email=[^"'<>\s]*/g,
            `https://api.bloodyrex.xyz/intelligence/unsubscribe?email=${encodeURIComponent(tb.email)}`
          );
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Kim's Video <digest@bloodyrex.xyz>",
              to: tb.email,
              subject: subjHeadline ? `🎬 ${subjHeadline} · Kim's Video ${today}（测试）` : `Kim's Video 每日影音情报 · ${today}（测试）`,
              html: personalHtml,
            }),
          });
          const data = await r.json();
          return Response.json({ ok: r.ok, id: data?.id, error: data?.message || null }, { headers: corsHeaders });
        } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); }
      }

      // Unsubscribe (POST)
      if (path === "/intelligence/unsubscribe") {
        return handleUnsubscribe(request, env);
      }
    }

    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  },

  // ── Backup digest sender cron (06:35 Beijing; GH Actions 06:28 is primary) ──
  // Idempotent via KV "digestStatus:YYYY-MM-DD" guard — skips if today already sent.
  // NOTE: migratePurgeExpired 属于迁移功能（/migrate/*，未分配阶段），此处已移除。
  async scheduled(event, env, ctx) {
    const result = await sendDigestToAll(env);
    console.log("scheduled digest:", JSON.stringify(result));
  },
};

