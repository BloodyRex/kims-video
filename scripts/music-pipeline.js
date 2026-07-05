/**
 * Music Pipeline — MusicBrainz + Last.fm data collection
 * Runs in GitHub Actions (Node.js), no Worker subrequest limits.
 */

// ── Genre EN→ZH translation (mirrors worker GENRE_ZH) ──
const GENRE_ZH = {
  "hip hop": "嘻哈", "hip-hop": "嘻哈", "rap": "说唱", "trap": "陷阱说唱", "gangsta rap": "匪帮说唱", "old school hip hop": "老派嘻哈", "east coast hip hop": "东岸嘻哈", "west coast hip hop": "西岸嘻哈", "southern hip hop": "南部嘻哈", "underground hip hop": "地下嘻哈", "alternative hip hop": "另类嘻哈", "jazz rap": "爵士说唱", "cloud rap": "云说唱", "drill": "钻头说唱", "grime": "格里姆", "uk hip hop": "英国嘻哈",
  "pop": "流行", "art pop": "艺术流行", "dream pop": "梦幻流行", "synth pop": "合成器流行", "indie pop": "独立流行", "electropop": "电子流行", "dance pop": "舞曲流行", "k-pop": "韩流", "j-pop": "日语流行", "french pop": "法国流行", "latin pop": "拉丁流行",
  "rock": "摇滚", "indie rock": "独立摇滚", "alternative rock": "另类摇滚", "classic rock": "经典摇滚", "hard rock": "硬摇滚", "progressive rock": "前卫摇滚", "psychedelic rock": "迷幻摇滚", "garage rock": "车库摇滚", "post-rock": "后摇滚", "math rock": "数学摇滚", "soft rock": "软摇滚", "southern rock": "南方摇滚", "stoner rock": "石人摇滚", "folk rock": "民谣摇滚", "blues rock": "蓝调摇滚",
  "electronic": "电子", "electronic music": "电子音乐", "edm": "电子舞曲", "house": "浩室", "deep house": "深度浩室", "tech house": "科技浩室", "progressive house": "前卫浩室", "trance": "迷幻", "techno": "铁克诺", "dubstep": "回响贝斯", "drum and bass": "鼓打贝斯", "ambient": "氛围", "idm": "智能舞曲", "breakbeat": "碎拍", "downtempo": "缓拍", "chillout": "弛放", "trip hop": "神游舞曲", "industrial": "工业", "synthwave": "合成器浪潮", "vaporwave": "蒸汽波",
  "r&b": "节奏蓝调", "rnb": "节奏蓝调", "soul": "灵魂", "neo soul": "新灵魂", "funk": "放克", "disco": "迪斯科", "motown": "摩城",
  "jazz": "爵士", "fusion": "融合爵士", "smooth jazz": "流畅爵士", "acid jazz": "酸爵士", "bebop": "比波普", "cool jazz": "冷爵士", "free jazz": "自由爵士", "latin jazz": "拉丁爵士",
  "metal": "金属", "heavy metal": "重金属", "black metal": "黑金属", "death metal": "死亡金属", "doom metal": "厄运金属", "thrash metal": "鞭挞金属", "power metal": "力量金属", "symphonic metal": "交响金属", "folk metal": "民谣金属", "pagan metal": "异教金属", "viking metal": "维京金属", "gothic metal": "哥特金属", "progressive metal": "前卫金属", "nu metal": "新金属", "metalcore": "金属核", "deathcore": "死核",
  "country": "乡村", "folk": "民谣", "indie folk": "独立民谣", "singer-songwriter": "唱作人",
  "blues": "蓝调", "reggae": "雷鬼", "dancehall": "舞厅", "ska": "斯卡",
  "latin": "拉丁", "salsa": "萨尔萨", "bossa nova": "波萨诺瓦", "samba": "桑巴", "reggaeton": "雷击顿", "cumbia": "昆比亚", "bachata": "巴恰塔",
  "classical": "古典", "orchestral": "管弦乐", "chamber music": "室内乐", "opera": "歌剧", "baroque": "巴洛克",
  "jesus": "福音", "gospel": "福音", "christian": "基督教音乐", "christmas": "圣诞音乐",
  "punk": "朋克", "pop punk": "流行朋克", "hardcore punk": "硬核朋克", "post-punk": "后朋克", "skate punk": "滑板朋克",
  "indie": "独立", "alternative": "另类", "experimental": "实验", "avant-garde": "先锋",
  "instrumental": "器乐", "lo-fi": "低保真", "noise": "噪音乐", "ambient pop": "氛围流行",
  "world": "世界音乐", "african": "非洲音乐", "afrobeat": "非洲节拍", "caribbean": "加勒比音乐", "celtic": "凯尔特音乐", "japanese": "日本音乐", "korean": "韩国音乐", "chinese": "中国音乐",
  "soundtrack": "原声", "score": "配乐", "video game music": "游戏音乐", "anime": "动漫",
  "children": "儿童音乐", "comedy": "喜剧", "spoken word": "朗诵", "audiobook": "有声书",
  "electronic pop": "电子流行", "dreamy": "梦幻", "melancholic": "忧郁", "energetic": "活力", "dark": "暗黑", "romantic": "浪漫", "sexy": "性感", "chill": "放松", "party": "派对", "summer": "夏日",
  "favorites": "精选", "best of": "精选", "seen live": "现场", "live": "现场", "cover": "翻唱", "remix": "混音", "remastered": "重制", "deluxe": "豪华版", "compilation": "合辑",
  "rapcore": "说唱核", "g-funk": "G放克", "hardcore hip hop": "硬核说唱", "abstract hip hop": "抽象说唱", "experimental hip hop": "实验说唱", "concept rap": "概念说唱",
  "happy hardcore": "快乐硬核", "jersey club": "泽西俱乐部", "new age": "新世纪", "meditation": "冥想", "relaxation": "放松",
  "tropical": "热带音乐", "anthem": "圣歌", "epic": "史诗", "orchestral pop": "管弦流行",
};

function intelGenreZH(tags) {
  if (!tags || !tags.length) return "";
  for (const t of tags) {
    const key = t.toLowerCase().trim();
    if (/^\d+$/.test(key)) continue;
    if (GENRE_ZH[key]) return GENRE_ZH[key];
  }
  for (const t of tags) {
    const key = t.toLowerCase().trim();
    if (!/^\d+$/.test(key)) return t;
  }
  return tags[0];
}

// ── Helpers ──
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const today = () => new Date().toISOString().split("T")[0];
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().split("T")[0];
function daysOld(dateStr) {
  if (!dateStr) return 999;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 999;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// ── MusicBrainz: fetch releases in date range (paginated) ──
async function fetchMBReleases(config) {
  const dateFrom = daysAgo(config.releaseWindowDays);
  const dateTo = today();
  const allReleases = [];

  for (let page = 0; page < config.mbPages; page++) {
    const offset = page * config.mbPageSize;
    const qp = new URLSearchParams({
      query: `date:[${dateFrom} TO ${dateTo}]`,
      fmt: "json",
      limit: String(config.mbPageSize),
      offset: String(offset),
    });
    const url = `https://musicbrainz.org/ws/2/release?${qp.toString()}`;

    let data = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": process.env.MUSICBRAINZ_USER_AGENT || "BloodyRex-Intelligence/1.0 (rexhr@yahoo.com)" },
        });
        if (res.ok) { data = await res.json(); break; }
        if (res.status === 429) { await sleep(2000); continue; }
        console.warn(`MB page ${page} fail: ${res.status}`);
        break;
      } catch (e) {
        console.warn(`MB page ${page} error:`, e.message);
        await sleep(2000);
      }
    }

    if (data?.releases?.length) {
      const mapped = data.releases.map(r => ({
        mbid: r.id,
        title: r.title || "",
        artist: (r["artist-credit"] || []).map(ac => ac.name || ac.artist?.name || "").join(", "),
        releaseDate: r.date || "",
        year: (r.date || "").slice(0, 4),
        cover: "",
        status: r.status || "",
        country: r.country || "",
        primaryType: r["release-group"]?.["primary-type"] || "",
        secondaryTypes: r["release-group"]?.["secondary-types"] || [],
        tags: (r["release-group"]?.tags || []).map(t => t.name).slice(0, 5),
      }));
      allReleases.push(...mapped);
    }

    await sleep(1500); // MB rate limit: 1 req/s
  }

  return allReleases;
}

// ── Album type filter: keep Album/EP, exclude remixes/live/compilations ──
function isValidAlbum(r) {
  if (r.primaryType !== "Album" && r.primaryType !== "EP") return false;
  const st = new Set(r.secondaryTypes || []);
  const badST = ["Live", "Compilation", "Remix", "Soundtrack", "Demo", "Bootleg", "Karaoke", "Other"];
  for (const t of badST) { if (st.has(t)) return false; }
  const t = (r.title || "").toLowerCase();
  const badKW = ["live", "remastered", "deluxe", "expanded", "anniversary", "greatest hits", "the collection", "box set", "instrumental", "remix album", "karaoke", "bootleg", "demo"];
  for (const kw of badKW) { if (t.includes(kw)) return false; }
  return true;
}

// ── Deduplicate by release group (MB artist+title normalization) ──
function dedupByReleaseGroup(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = `${item.artist.toLowerCase().trim()}|||${item.title.toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Score artists by release count, multi-country, label spread ──
function scoreAndRankArtists(releases) {
  const artistMap = new Map();

  for (const r of releases) {
    const key = r.artist.toLowerCase().trim();
    if (!artistMap.has(key)) {
      artistMap.set(key, { name: r.artist, releaseCount: 0, countries: new Set(), hasOfficial: false });
    }
    const a = artistMap.get(key);
    a.releaseCount++;
    if (r.country) a.countries.add(r.country);
    if (r.status === "Official") a.hasOfficial = true;
  }

  const scored = [...artistMap.values()].map(a => {
    let score = 0;
    score += Math.min(a.releaseCount, 10) * 5;          // up to 50 for release count
    score += Math.min(a.countries.size, 3) * 10;         // up to 30 for multi-country
    if (a.hasOfficial) score += 20;                       // +20 for official releases
    return { ...a, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// ── Last.fm: fetch artist info (listeners, playcount, tags) ──
async function fetchArtistInfo(artistName) {
  if (!process.env.LASTFM_API_KEY) return null;
  try {
    const url = new URL("https://ws.audioscrobbler.com/2.0/");
    url.searchParams.set("method", "artist.getinfo");
    url.searchParams.set("artist", artistName);
    url.searchParams.set("api_key", process.env.LASTFM_API_KEY);
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "KimVideo-Pipeline/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.artist?.stats) {
      return {
        listeners: parseInt(data.artist.stats.listeners) || 0,
        playcount: parseInt(data.artist.stats.playcount) || 0,
        tags: (data.artist.tags?.tag || []).map(t => t.name).slice(0, 10),
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ── Last.fm: fetch album info (listeners, playcount, tags) ──
async function fetchAlbumInfo(artist, album) {
  if (!process.env.LASTFM_API_KEY) return null;
  try {
    const url = new URL("https://ws.audioscrobbler.com/2.0/");
    url.searchParams.set("method", "album.getinfo");
    url.searchParams.set("artist", artist);
    url.searchParams.set("album", album);
    url.searchParams.set("api_key", process.env.LASTFM_API_KEY);
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "KimVideo-Pipeline/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.album) {
      return {
        listeners: parseInt(data.album.listeners) || 0,
        playcount: parseInt(data.album.playcount) || 0,
        tags: (data.album.tags?.tag || []).map(t => t.name).slice(0, 5),
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ── Last.fm: fetch top albums by genre tag (charts) ──
async function fetchCharts(config) {
  if (!process.env.LASTFM_API_KEY) return [];
  const seen = new Set();
  const all = [];

  for (const tag of config.chartTags) {
    try {
      await sleep(300); // throttle
      const url = new URL("https://ws.audioscrobbler.com/2.0/");
      url.searchParams.set("method", "tag.gettopalbums");
      url.searchParams.set("tag", tag);
      url.searchParams.set("limit", "30");
      url.searchParams.set("api_key", process.env.LASTFM_API_KEY);
      url.searchParams.set("format", "json");

      const res = await fetch(url.toString(), {
        headers: { "User-Agent": "KimVideo-Pipeline/1.0" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.albums?.album) {
        for (const a of data.albums.album) {
          const key = (a.name + "|||" + (a.artist?.name || "")).toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            all.push({
              title: a.name || "",
              artist: a.artist?.name || "",
              listeners: 0,
              playcount: 0,
              cover: a.image?.find(i => i.size === "large")?.["#text"]
                || a.image?.find(i => i.size === "extralarge")?.["#text"]
                || "",
              mbid: a.mbid || "",
              releaseDate: "",
              year: "",
              primaryType: "Album",
              secondaryTypes: [],
              lfmTags: [],
              tags: [],
              tagsEn: [],
              genre: "",
            });
          }
        }
      }
    } catch (e) {
      // skip tag on error
    }
  }

  return all;
}

// ── Scoring formula ──
function scoreCandidate(artistListeners, albumListeners, releaseDaysOld) {
  const artistScore = Math.min(40, Math.log10(Math.max(1, artistListeners)) / 6 * 40);
  const albumScore = Math.min(30, Math.log10(Math.max(1, albumListeners)) / 6 * 30);
  const freshness = Math.max(0, 30 - releaseDaysOld);
  return {
    total: artistScore + albumScore + freshness,
    breakdown: { artist: artistScore, album: albumScore, freshness },
  };
}

// ── Main orchestrator ──
export async function collectMusicCandidates(config) {
  const startTime = Date.now();
  const stats = { mbRaw: 0, afterFilter: 0, artistsChecked: 0, afterArtistFilter: 0, albumEnriched: 0, chartItems: 0, totalCandidates: 0, sentToWorker: 0 };

  // ── Phase 1: Fetch MusicBrainz releases (30 days) ──
  console.log("[MB] Fetching releases (last 30 days)...");
  const allReleases = await fetchMBReleases(config);
  stats.mbRaw = allReleases.length;
  console.log(`[MB] Got ${stats.mbRaw} raw releases`);

  // ── Phase 1.5: Filter valid albums ──
  const valid = allReleases.filter(r => isValidAlbum(r));
  stats.afterFilter = valid.length;
  console.log(`[MB] After type filter: ${stats.afterFilter}`);

  // ── Phase 1.6: Dedup by release group ──
  const deduped = dedupByReleaseGroup(valid);
  console.log(`[MB] After dedup: ${deduped.length}`);

  // ── Phase 2: Score and rank artists → top N ──
  const rankedArtists = scoreAndRankArtists(deduped);
  const topArtists = rankedArtists.slice(0, config.artistCheckLimit);
  console.log(`[MB] Top artists to check: ${topArtists.length}`);

  // ── Phase 3: Fetch Last.fm artist info (batched) ──
  console.log("[LFM] Fetching artist info...");
  const artistResults = new Map();

  for (let i = 0; i < topArtists.length; i += 5) {
    const batch = topArtists.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(a => fetchArtistInfo(a.name))
    );
    batch.forEach((a, idx) => {
      const r = results[idx];
      if (r.status === "fulfilled" && r.value) {
        artistResults.set(a.name.toLowerCase().trim(), r.value);
      }
    });
    if (i + 5 < topArtists.length) await sleep(500);
  }

  stats.artistsChecked = artistResults.size;
  console.log(`[LFM] Artist data obtained: ${stats.artistsChecked}`);

  // ── Phase 4: Build MB candidates with artist data ──
  const mbCandidates = [];

  for (const release of deduped) {
    const key = release.artist.toLowerCase().trim();
    const ad = artistResults.get(key);
    if (!ad) continue;

    // Skip very obscure artists
    if (ad.listeners < config.minArtistListeners) continue;

    // Find the best release per artist (prefer Album over EP, earliest date)
    const existingIdx = mbCandidates.findIndex(c => c.artist.toLowerCase().trim() === key);
    if (existingIdx >= 0) {
      const existing = mbCandidates[existingIdx];
      // Prefer Album over EP
      if (release.primaryType === "Album" && existing.type === "EP") {
        mbCandidates[existingIdx] = buildCandidate(release, ad);
      }
      continue;
    }

    mbCandidates.push(buildCandidate(release, ad));
  }

  stats.afterArtistFilter = mbCandidates.length;
  console.log(`[MB] After artist popularity filter (≥${config.minArtistListeners} listeners): ${stats.afterArtistFilter}`);

  // Sort MB candidates by artist listeners descending, take top for album enrichment
  mbCandidates.sort((a, b) => b.artistListeners - a.artistListeners);
  const topForEnrich = mbCandidates.slice(0, config.albumEnrichLimit);

  // ── Phase 5: Enrich top albums with album.getinfo ──
  console.log("[LFM] Enriching top albums...");
  for (let i = 0; i < topForEnrich.length; i++) {
    const c = topForEnrich[i];
    const info = await fetchAlbumInfo(c.artist, c.title);
    if (info) {
      c.albumListeners = info.listeners;
      c.albumPlaycount = info.playcount;
      c.lfmTags = info.tags;
      c.genres = info.tags.map(t => intelGenreZH([t])).filter(Boolean).slice(0, 5);
      c.genresEn = info.tags.slice(0, 5);
    }
    await sleep(300); // throttle
  }
  stats.albumEnriched = topForEnrich.length;
  console.log(`[LFM] Albums enriched: ${stats.albumEnriched}`);

  // ── Phase 6: Fetch Last.fm charts ──
  console.log("[LFM] Fetching genre charts...");
  const chartItems = await fetchCharts(config);
  stats.chartItems = chartItems.length;
  console.log(`[LFM] Chart items: ${stats.chartItems}`);

  // Build chart candidates (no artist popularity filter needed — charts are inherently popular)
  const chartCandidates = [];
  for (const c of chartItems) {
    const dup = mbCandidates.some(mc =>
      mc.title.toLowerCase() === c.title.toLowerCase() &&
      mc.artist.toLowerCase() === c.artist.toLowerCase()
    );
    if (!dup) {
      chartCandidates.push({
        id: `chart-${chartCandidates.length}`,
        mbid: c.mbid,
        title: c.title,
        artist: c.artist,
        releaseDate: c.releaseDate,
        type: "Album",
        country: "",
        genres: [],
        genresEn: [],
        lfmTags: [],
        cover: c.cover || "",
        source: "chart",
        artistListeners: 0,
        artistPlaycount: 0,
        albumListeners: c.listeners,
        albumPlaycount: c.playcount,
        score: 0,
        scoreBreakdown: { artist: 0, album: 0, freshness: 0 },
      });
    }
  }

  // ── Phase 7: Score all candidates ──
  const allCandidates = [...mbCandidates, ...chartCandidates];
  stats.totalCandidates = allCandidates.length;

  for (const c of allCandidates) {
    const rd = daysOld(c.releaseDate);
    const scored = scoreCandidate(c.artistListeners, c.albumListeners, rd);
    c.score = scored.total;
    c.scoreBreakdown = scored.breakdown;
    c.daysOld = rd;
  }

  // Sort by score descending
  allCandidates.sort((a, b) => b.score - a.score);
  const topCandidates = allCandidates.slice(0, config.candidateLimitForAI);
  stats.sentToWorker = topCandidates.length;

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[DONE] ${stats.totalCandidates} total candidates, ${stats.sentToWorker} sent to AI. ${elapsed}s`);

  return { candidates: allCandidates, topCandidates: topCandidates, stats };
}

// ── Build candidate object from MB release + artist data ──
function buildCandidate(release, artistData) {
  return {
    id: `mb-${release.mbid}`,
    mbid: release.mbid,
    title: release.title,
    artist: release.artist,
    releaseDate: release.releaseDate,
    year: release.releaseDate ? release.releaseDate.slice(0, 4) : "",
    type: release.primaryType === "EP" ? "EP" : "Album",
    country: release.country || "",
    genres: [],
    genresEn: [],
    lfmTags: artistData.tags || [],
    cover: release.cover || "",
    source: "musicbrainz",
    artistListeners: artistData.listeners || 0,
    artistPlaycount: artistData.playcount || 0,
    albumListeners: 0,
    albumPlaycount: 0,
    score: 0,
    scoreBreakdown: { artist: 0, album: 0, freshness: 0 },
  };
}

// ── Strip debug fields for Worker payload ──
export function stripDebugFields(c) {
  const { filterReason, daysOld, mbArtistScore, ...rest } = c;
  return rest;
}
