import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import discoverData from "../data/discover.json";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";
import { fetchMovieByTmdbId } from "../services/api";
import { fetchDiscoverResults, likeDiscoverResult } from "../services/discoverApi";
import { setCanonical } from "../services/seo";
import { TrailerButtons, StarRating, GENRE_ZH } from "./Cards";
import SubscribeSection from "./SubscribeSection";

const LANG_BUTTON_STYLE = {
  fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
};

// ── Wall-style organization (2026-08-23 redesign) ──
// Same skeleton as WallPage: poster-card grid (3/4/6 cols) + filter bar
// (genre chips + IME-safe search) + community comet-toggle + smart pagination.
// Pinned top row = the day's 编辑精选 (6 cards from /api/overview.json,
// ★编辑/💎宝藏/🔥热榜 — merged section curated in handleIntelOverview).
// Content modes: default = curated library pairs (discover.json),
// comet button = community submissions (KV). Status filter intentionally
// omitted (Rex confirmed): library content is almost all released.

const PAGE_SIZE = 24;

// Common genre chips — everything else falls into "其他 / OTHER" (same idea as the wall)
const COMMON_GENRES = [
  "Action", "Sci-Fi", "Comedy", "Romance",
  "Horror", "Drama", "Animation", "Thriller", "Documentary",
];
const normGenre = (g) => GENRE_ZH[g] || g;
const COMMON_ZH = COMMON_GENRES.map(normGenre);
const genreLabel = (g, locale) => (locale === "zh" ? GENRE_ZH[g] || g : g);

function todayInfo() {
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  return { todayStr, todayTs: Date.parse(todayStr + "T00:00:00Z") };
}

function buildPages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current - 1, current, current + 1]);
  return [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

// ── Daily Pick Card (Wall-card style; pinned editor's-picks row) ──
const PICK_CATS = {
  editors: { zh: "★ 编辑精选", en: "★ EDITOR", bg: "#ff00ff", text: "#000" },
  gem: { zh: "💎 隐藏宝藏", en: "💎 GEM", bg: "#00ffff", text: "#000" },
  trending: { zh: "🔥 热榜趋势", en: "🔥 TRENDING", bg: "#ffff00", text: "#000" },
};

function DailyPickCard({ pick, locale, onOpen }) {
  const cat = PICK_CATS[pick.pickCategory] || PICK_CATS.editors;
  const zh = locale === "zh";
  const title = zh ? pick.title : (pick.titleEn || pick.title);
  return (
    <div onClick={() => onOpen(pick)}
      className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#ff00ff] transition-all group cursor-pointer">
      <div className="relative overflow-hidden border-b-2 border-black">
        {pick.poster ? (
          <img src={pick.poster} alt={title} className="w-full aspect-[2/3] object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center text-gray-500"><Icons.Film className="w-8 h-8" /></div>
        )}
        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-black border-2 border-black leading-none"
          style={{ backgroundColor: cat.bg, color: cat.text }}>
          {zh ? cat.zh : cat.en}
        </span>
        {(pick.rating || 0) > 0 && (
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-black bg-[#ff00ff] text-white border-2 border-black leading-none">
            {pick.rating.toFixed(1)}
          </span>
        )}
      </div>
      <div className="p-2 max-sm:p-1.5">
        <h3 className="text-xs font-black truncate leading-tight" title={title}>{title}</h3>
        {pick.titleEn && pick.titleEn !== title && (
          <p className="text-[9px] text-gray-500 font-bold truncate">{pick.titleEn}</p>
        )}
        <div className="flex items-center justify-between mt-1 gap-1">
          <span className="text-[9px] text-gray-600 font-bold truncate">{pick.releaseDate || pick.year || ""}</span>
          {Array.isArray(pick.genre) && pick.genre.length > 0 && (
            <span className="text-[8px] px-1 bg-black text-white font-bold flex-shrink-0">{pick.genre[0]}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Library Pair Card (Wall-card style; "推荐自" badge reveals source) ──
function PairCard({ pair, posterMap, metaMap, locale, onOpen }) {
  // Desktop: hovering the CARD reveals the source name next to the badge (CSS group-hover).
  // Mobile: tapping the badge toggles it (no hover available).
  const [showSrc, setShowSrc] = useState(false);
  const recPoster = posterMap[pair.recommend.tmdbId];
  const meta = metaMap[pair.recommend.tmdbId] || {};
  const zh = locale === "zh";
  const recTitle = zh ? pair.recommend.title : (pair.recommend.titleEn || pair.recommend.title);
  const srcTitle = zh ? pair.source.title : (pair.source.titleEn || pair.source.title);
  const genres = meta.genres || [];

  return (
    <div onClick={() => onOpen(pair)}
      className="group bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#00ffff] transition-all cursor-pointer">
      <div className="relative overflow-hidden border-b-2 border-black">
        {recPoster ? (
          <img src={recPoster} alt={recTitle} className="w-full aspect-[2/3] object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center text-gray-500"><Icons.Film className="w-8 h-8" /></div>
        )}
        {/* Rex spec: badge says 推荐自 — desktop hover shows the source title, mobile taps it */}
        <span onClick={(e) => { e.stopPropagation(); setShowSrc(v => !v); }}
          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-black border-2 border-black leading-none bg-[#ffff00] text-black select-none">
          {zh ? "推荐自" : "IF YOU LIKE"}
        </span>
        <span className={`absolute top-7 left-1.5 max-w-[85%] px-1.5 py-0.5 text-[9px] font-bold border-2 border-black leading-tight bg-black text-white truncate pointer-events-none transition-opacity duration-150 ${showSrc ? "opacity-100" : "opacity-0 sm:group-hover:opacity-100"}`}>
          《{srcTitle}》
        </span>
        {(meta.rating || 0) > 0 && (
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-black bg-[#ff00ff] text-white border-2 border-black leading-none">
            {meta.rating.toFixed(1)}
          </span>
        )}
      </div>
      <div className="p-2 max-sm:p-1.5">
        <h3 className="text-xs font-black truncate leading-tight" title={recTitle}>{recTitle}</h3>
        <div className="flex items-center justify-between mt-1 gap-1">
          <span className="text-[9px] text-gray-600 font-bold truncate">{meta.releaseDate || pair.recommend.year || ""}</span>
          {genres.length > 0 && (
            <span className="text-[8px] px-1 bg-black text-white font-bold flex-shrink-0">
              {genreLabel(genres[0], locale)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Pair detail overlay (pair context moves here from the old wide cards) ──
function PairDetailOverlay({ pair, posterMap, metaMap, locale, onClose }) {
  const recPoster = posterMap[pair.recommend.tmdbId];
  const meta = metaMap[pair.recommend.tmdbId] || {};
  const zh = locale === "zh";
  const recTitle = zh ? pair.recommend.title : (pair.recommend.titleEn || pair.recommend.title);
  const srcTitle = zh ? pair.source.title : (pair.source.titleEn || pair.source.title);
  const genres = meta.genres || [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative w-full max-w-md bg-white border-4 border-black shadow-[8px_8px_0_0_rgba(0,255,255,1)]" onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 bg-[#ff00ff] border-2 border-black text-white font-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors z-10">×</button>
        <div className="bg-black text-white px-4 py-2.5 text-xs">
          <span className="font-black pixel-font uppercase text-[10px] text-[#ffff00]">
            {zh ? <>如果你喜欢《{pair.source.title}》</> : <>If you like {srcTitle}</>}
          </span>
        </div>
        <div className="flex gap-3 p-4 max-sm:p-3">
          {recPoster ? (
            <img src={recPoster} alt={recTitle} className="w-24 h-36 object-cover border-2 border-black flex-shrink-0" />
          ) : (
            <div className="w-24 h-36 bg-gray-800 border-2 border-black flex items-center justify-center text-gray-500"><Icons.Film /></div>
          )}
          <div className="flex-1 min-w-0 flex flex-col">
            <h3 className="text-base font-black leading-tight">{recTitle}</h3>
            {(meta.rating || 0) > 0 && <div className="mt-1"><StarRating score={meta.rating} max={10} /></div>}
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {genres.slice(0, 4).map((g, i) => (
                  <span key={i} className="text-[8px] px-1 bg-black text-white font-bold">{genreLabel(g, locale)}</span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-600 leading-relaxed mt-2 flex-1">{zh ? pair.reason : pair.reasonEn}</p>
            {/* Wall-style 4-button row: TMDB + IMDb + YouTube + Bilibili (uniform lg) */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <a href={`https://www.themoviedb.org/movie/${pair.recommend.tmdbId}`} target="_blank" rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-[#00dd00] hover:bg-[#00ff00] text-black border-4 border-black text-xs font-black uppercase transition-colors shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none pixel-font">
                {zh ? "在 TMDB 查看 ↗" : "View on TMDB ↗"}
              </a>
              <a href={`https://www.imdb.com/find?q=${encodeURIComponent(((pair.recommend.titleEn || pair.recommend.title) + " " + (pair.recommend.year || "")).trim())}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 bg-[#F5C518] border-4 border-black hover:bg-[#dbaa00] transition-colors flex-shrink-0 overflow-hidden shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none" title="Open in IMDb">
                <Icons.Imdb className="w-full h-full" />
              </a>
              <TrailerButtons item={pair.recommend} locale={locale} size="lg" forceType="movie" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Daily pick detail overlay (single-movie version) ──
function DailyPickDetailOverlay({ pick, locale, onClose }) {
  const zh = locale === "zh";
  const title = zh ? pick.title : (pick.titleEn || pick.title);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative w-full max-w-md bg-white border-4 border-black shadow-[8px_8px_0_0_rgba(0,255,255,1)]" onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 bg-[#ff00ff] border-2 border-black text-white font-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors z-10">×</button>
        <div className="flex gap-3 p-4 max-sm:p-3">
          {pick.poster ? (
            <img src={pick.poster} alt={title} className="w-24 h-36 object-cover border-2 border-black flex-shrink-0" />
          ) : (
            <div className="w-24 h-36 bg-gray-800 border-2 border-black flex items-center justify-center text-gray-500"><Icons.Film /></div>
          )}
          <div className="flex-1 min-w-0 flex flex-col">
            <h3 className="text-base font-black leading-tight">{title}</h3>
            {pick.titleEn && pick.titleEn !== title && <p className="text-xs text-gray-600 font-bold">{pick.titleEn}</p>}
            {(pick.rating || 0) > 0 && <div className="mt-1"><StarRating score={pick.rating} max={10} /></div>}
            {Array.isArray(pick.genre) && pick.genre.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {pick.genre.slice(0, 4).map((g, i) => (
                  <span key={i} className="text-[8px] px-1 bg-black text-white font-bold">{g}</span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-600 leading-relaxed mt-2 line-clamp-4 flex-1">{zh ? pick.summary : (pick.summaryEn || pick.summary)}</p>
            {/* Wall-style 4-button row: TMDB + IMDb + YouTube + Bilibili (uniform lg) */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {pick.tmdbId && (
                <a href={`https://www.themoviedb.org/movie/${pick.tmdbId}`} target="_blank" rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-[#00dd00] hover:bg-[#00ff00] text-black border-4 border-black text-xs font-black uppercase transition-colors shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none pixel-font">
                  {zh ? "在 TMDB 查看 ↗" : "View on TMDB ↗"}
                </a>
              )}
              <a href={`https://www.imdb.com/find?q=${encodeURIComponent(((pick.titleEn || pick.title) + " " + (pick.year || "")).trim())}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 bg-[#F5C518] border-4 border-black hover:bg-[#dbaa00] transition-colors flex-shrink-0 overflow-hidden shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none" title="Open in IMDb">
                <Icons.Imdb className="w-full h-full" />
              </a>
              <TrailerButtons item={{ ...pick, type: "movie" }} locale={locale} size="lg" forceType="movie" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── User Result Card (community; likes + poster modal kept) ──
function UserResultCard({ result, posterMap, locale, onLike, onOpenPoster }) {
  const src = result.sourceMovies?.[0] || {};
  const likes = result.likes || 0;
  const storedLiked = (() => { try { return JSON.parse(localStorage.getItem("kims_liked") || "[]"); } catch { return []; } })();
  const [liked, setLiked] = useState(storedLiked.includes(result.id));
  const [likesLocal, setLikesLocal] = useState(likes + (storedLiked.includes(result.id) ? 1 : 0));

  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (liked) return;
    setLiked(true);
    setLikesLocal(l => l + 1);
    try {
      const r = await likeDiscoverResult(result.id);
      if (onLike) onLike(result.id, r.likes);
      try {
        const likedArr = JSON.parse(localStorage.getItem("kims_liked") || "[]");
        if (!likedArr.includes(result.id)) { likedArr.push(result.id); localStorage.setItem("kims_liked", JSON.stringify(likedArr)); }
      } catch {}
    } catch (e) { console.error("Like failed:", e); }
  };

  return (
    <div className={`bg-white border-4 max-sm:border-2 border-black overflow-hidden shadow-[6px_6px_0_0_rgba(0,0,0,1)] max-sm:shadow-[3px_3px_0_0_rgba(0,0,0,1)] transition-all ${result.thumbnail ? "hover:-translate-y-1 cursor-pointer" : ""}`}
      onClick={() => result.thumbnail && onOpenPoster(result.thumbnail)}>
      <div className="bg-black text-white px-3 py-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-black pixel-font uppercase truncate">{src.title || ""}{src.year ? ` (${src.year})` : ""}</span>
        <span className="text-gray-400 font-bold truncate">{result.contributorName || (locale === "en" ? "Anonymous" : "匿名用户")}</span>
      </div>
      <div className="flex p-2 gap-2 overflow-x-auto">
        {result.recommendations.map((rec, i) => {
          const poster = posterMap[rec.tmdbId];
          const detailUrl = `/?from=${src.tmdbId || ""}&r=${rec.tmdbId}&discover=1`;
          const badge = i < 2 ? (locale === "en" ? "HOT" : "热门") : i < 4 ? (locale === "en" ? "NICHE" : "冷门") : (locale === "en" ? "WILD" : "争议");
          const bc = i < 2 ? "bg-[#ff00ff]" : i < 4 ? "bg-[#00ffff]" : "bg-[#ffff00]";
          return (
            <Link key={i} to={detailUrl} onClick={e => e.stopPropagation()} className="flex-shrink-0 w-16 group">
              {poster ? <img src={poster} alt={rec.title} className="w-16 h-24 object-cover border-2 border-black group-hover:border-[#ff00ff] transition-colors" loading="lazy" /> : <div className="w-16 h-24 bg-gray-800 border-2 border-black flex items-center justify-center text-[8px] text-gray-500 font-bold">?</div>}
              <span className={`block text-[8px] font-black text-center mt-0.5 px-0.5 ${bc} text-black`}>{badge}</span>
            </Link>
          );
        })}
      </div>
      <div className="px-3 pb-2 flex items-center justify-between text-[10px] text-gray-500">
        <span>{new Date(result.createdAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" })}</span>
        <button onClick={handleLike} className={`flex items-center gap-1 font-bold px-1.5 py-0.5 border border-gray-300 hover:bg-gray-100 transition-colors ${liked ? "text-[#ff00ff] border-[#ff00ff]" : ""}`}><span>{liked ? "♥" : "♡"}</span> {likesLocal}</button>
      </div>
    </div>
  );
}

// ── Poster Modal (community thumbnail zoom) ──
function PosterModal({ thumbnail, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 bg-[#ff00ff] border-2 border-black text-white font-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors z-10">×</button>
        <img src={thumbnail} alt="Full recommendation poster" className="max-w-full max-h-[85vh] border-4 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)]" />
      </div>
    </div>
  );
}

// ── Main DiscoverPage ──
const DiscoverPage = () => {
  const { t, locale, toggleLocale } = useLocale();
  const zh = locale === "zh";
  const [posterMap, setPosterMap] = useState({});
  const [metaMap, setMetaMap] = useState({});
  const [dailyPicks, setDailyPicks] = useState([]);
  const [userResults, setUserResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(true);

  // Wall-style controls
  const [sourceMode, setSourceMode] = useState("community"); // editor | community (comet toggle) — default community (2026-08-28 Rex决策)
  const [genreFilter, setGenreFilter] = useState("all");   // all | <genre> | other
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const [modalThumbnail, setModalThumbnail] = useState(null);
  const [detailPair, setDetailPair] = useState(null);
  const [detailPick, setDetailPick] = useState(null);
  const scrollRef = useRef(null);

  const getTitle = (movie) => locale === "en" ? (movie.titleEn || movie.title) : movie.title;

  useEffect(() => {
    document.title = zh ? "发现 | AI 电影推荐社区 | Kim's Video" : "Discover | AI Movie Recommendations | Kim's Video";
    setCanonical("https://bloodyrex.xyz/discover/");
  }, [locale]);

  // Posters + meta for the curated library (localStorage cache, 24h TTL)
  useEffect(() => {
    const allIds = new Set();
    discoverData.genres.forEach(g => g.pairs.forEach(p => { allIds.add(p.source.tmdbId); allIds.add(p.recommend.tmdbId); }));
    let cancelled = false;
    (async () => {
      try {
        const cached = localStorage.getItem("kims_discover_posters");
        const ts = localStorage.getItem("kims_discover_posters_ts");
        if (cached && ts && (Date.now() - parseInt(ts)) < 86400000) {
          const parsed = JSON.parse(cached);
          if (!cancelled) setPosterMap(parsed);
          // still fetch meta (ratings/genres) — small payload, needed for filters
        }
      } catch {}
      const map = {};
      const meta = {};
      const ids = [...allIds];
      for (let i = 0; i < ids.length; i += 5) {
        const batch = ids.slice(i, i + 5);
        await Promise.allSettled(batch.map(async id => {
          const data = await fetchMovieByTmdbId(id, "zh");
          if (!data || cancelled) return;
          if (data.poster) map[id] = data.poster;
          meta[id] = {
            rating: data.vote_average || data.rating || 0,
            genres: Array.isArray(data.genres) ? data.genres.map(g => g.name || g) : [],
            releaseDate: data.release_date || data.releaseDate || "",
            originalTitle: data.original_title || data.originalTitle || "",
            year: (data.release_date || data.releaseDate || "").slice(0, 4) || data.year || "",
          };
        }));
      }
      if (!cancelled) {
        setPosterMap(prev => ({ ...prev, ...map }));
        setMetaMap(meta);
        try { localStorage.setItem("kims_discover_posters", JSON.stringify(map)); localStorage.setItem("kims_discover_posters_ts", String(Date.now())); } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Day's editor picks (fixed 6, ★/💎/🔥) — same data as Intelligence 总览.
  // discover-daily.json is the pipeline mirror; overview.json works as fallback.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let d = await fetch("/api/discover-daily.json").then(r => (r.ok ? r.json() : null));
        if (!d) d = await fetch("/api/overview.json").then(r => (r.ok ? r.json() : null));
        if (!cancelled) setDailyPicks(d?.picks || d?.editorsPicks || []);
      } catch {
        if (!cancelled) setDailyPicks([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Community results
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingResults(true);
      try { const data = await fetchDiscoverResults({ sort: "popular", limit: 30 }); if (!cancelled) setUserResults(data.results || []); } catch { if (!cancelled) setUserResults([]); }
      if (!cancelled) setLoadingResults(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const userRecTmdbIds = useMemo(() => {
    const ids = [];
    userResults.forEach(r => r.recommendations?.forEach(rec => { if (rec.tmdbId) ids.push(rec.tmdbId); }));
    return ids;
  }, [userResults]);

  const [userPosterMap, setUserPosterMap] = useState({});
  useEffect(() => {
    const unique = [...new Set(userRecTmdbIds)];
    if (!unique.length) return;
    let cancelled = false;
    (async () => {
      const result = {};
      await Promise.allSettled(unique.map(async id => {
        const data = await fetchMovieByTmdbId(id, "zh");
        if (data?.poster && !cancelled) result[id] = data.poster;
      }));
      if (!cancelled) setUserPosterMap(prev => ({ ...prev, ...result }));
    })();
    return () => { cancelled = true; };
  }, [JSON.stringify([...new Set(userRecTmdbIds)].sort())]);

  // ── Filtering (mirrors WallPage) ──
  const allPairs = useMemo(() => discoverData.genres.flatMap(g => g.pairs), []);

  const filteredPairs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "");
    return allPairs.filter((p) => {
      // genre filter compares the RECOMMENDED film's genres (metaMap)
      const genres = (metaMap[p.recommend.tmdbId]?.genres || []).map(normGenre);
      if (genreFilter === "other") {
        if (genres.some(g => COMMON_ZH.includes(g))) return false;
      } else if (genreFilter !== "all") {
        const fz = normGenre(genreFilter);
        if (!genres.some(g => g === fz)) return false;
      }
      if (q) {
        const hit =
          (p.recommend.title || "").toLowerCase().includes(q) ||
          (p.recommend.titleEn || "").toLowerCase().includes(q) ||
          (p.source.title || "").toLowerCase().includes(q) ||
          (p.source.titleEn || "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [allPairs, metaMap, genreFilter, searchQuery]);

  const filteredUserResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "");
    return userResults.filter((r) => {
      if (genreFilter !== "all") {
        const fz = normGenre(genreFilter);
        if ((r.genre || "剧情") !== fz) return false;
      }
      if (q) {
        const hay = [
          r.contributorName || "",
          ...(r.recommendations || []).map(rec => rec.title || ""),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [userResults, genreFilter, searchQuery]);

  useEffect(() => { setPage(1); }, [genreFilter, searchQuery, sourceMode]);

  const totalPages = Math.max(1, Math.ceil(
    (sourceMode === "editor" ? filteredPairs.length : filteredUserResults.length) / PAGE_SIZE
  ));
  const safePage = Math.min(page, totalPages);
  const pageItems = sourceMode === "editor"
    ? filteredPairs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : filteredUserResults.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const genreBtn = (id, label) => (
    <button key={id} onClick={() => setGenreFilter(id)}
      className={`px-2.5 py-1 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all ${
        genreFilter === id ? "bg-[#ff00ff] text-white" : "bg-white text-black hover:bg-gray-100"
      }`}>
      {label}
    </button>
  );

  const itemCount = sourceMode === "editor" ? filteredPairs.length : filteredUserResults.length;

  return (
    <div className={`min-h-screen graffiti-bg text-black pb-32 discover-page locale-${locale}`}>
      {/* Comet border for the 来自社区 toggle — identical treatment to the wall */}
      <style>{`
        @property --discover-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        .community-btn {
          border: 2px solid transparent;
          background:
            linear-gradient(#fff, #fff) padding-box,
            conic-gradient(from calc(var(--discover-angle) + 180deg),
              transparent 0deg, transparent 200deg,
              rgba(255, 184, 0, 0.15) 240deg, rgba(255, 184, 0, 0.15) 258deg,
              rgba(255, 184, 0, 0.5) 284deg, rgba(255, 184, 0, 0.5) 300deg,
              #ffb800 312deg, #ffb800 360deg) border-box;
          animation: discover-spin 1.6s steps(8) infinite;
        }
        .community-btn.on {
          background:
            linear-gradient(#00ffff, #00ffff) padding-box,
            conic-gradient(from calc(var(--discover-angle) + 180deg),
              transparent 0deg, transparent 200deg,
              rgba(255, 184, 0, 0.15) 240deg, rgba(255, 184, 0, 0.15) 258deg,
              rgba(255, 184, 0, 0.5) 284deg, rgba(255, 184, 0, 0.5) 300deg,
              #ffb800 312deg, #ffb800 360deg) border-box;
        }
        @keyframes discover-spin {
          to { --discover-angle: 360deg; }
        }
      `}</style>

      {/* Header — identical to the other pages */}
      <header className="relative z-10 flex flex-col items-center py-4 mb-10 bg-black border-b-8 border-[#ff00ff] shadow-[0_8px_0_0_rgba(0,255,255,1)]">
        <Link to="/" className="flex items-center justify-center hover:opacity-80 transition-opacity">
          <div className="bg-[#ffff00] p-2 border-4 border-black mr-4 transform -rotate-6">
            <span className="text-black transform rotate-90"><Icons.Play /></span>
          </div>
          <h1 className="text-lg sm:text-2xl font-black text-white pixel-font uppercase tracking-widest drop-shadow-[4px_4px_0_#ff00ff] whitespace-nowrap" style={LANG_BUTTON_STYLE}>
            KIM'S <span className="text-[#00ffff]">VIDEO</span>
          </h1>
        </Link>
        <p className="text-gray-500 text-[10px] max-sm:text-[9px] pixel-font mt-1 tracking-wider">{t('tagline')}</p>
      </header>

      {/* Title */}
      <section className="max-w-4xl mx-auto px-2 max-sm:px-3 sm:px-4 pt-3 pb-4 text-center relative">
        <h2 className="text-2xl sm:text-3xl font-black text-white drop-shadow-[3px_3px_0_#ff00ff] pixel-font">
          {zh ? "🎬发现" : "🎬DISCOVER"}
        </h2>
        <p className="text-gray-300 text-sm max-w-xl mx-auto leading-relaxed mt-3">{t('discover.desc')}</p>
      </section>

      {/* Pinned row: the day's editor picks (always on top, unaffected by filters) */}
      {dailyPicks.length > 0 && (
        <section className="mb-6">
          <div className="max-w-4xl mx-auto px-4 max-sm:px-3 mb-3">
            <h3 className="inline-block px-4 py-1.5 text-xs sm:text-sm font-black pixel-font uppercase tracking-widest bg-black text-[#ffff00] border-2 border-[#ffff00] shadow-[4px_4px_0_0_#ff00ff] max-sm:text-[11px]">
              {zh ? "★ 今日编辑精选" : "★ Today's Editor's Picks"}
            </h3>
          </div>
          <div ref={scrollRef} className="max-w-4xl mx-auto px-4 max-sm:px-3">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-sm:gap-2">
              {dailyPicks.map((p, i) => (
                <DailyPickCard key={`${p.tmdbId}-${i}`} pick={p} locale={locale} onOpen={setDetailPick} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Filter bar — same layout as the wall */}
      <div className="max-w-4xl mx-auto px-4 max-sm:px-3 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* Search (IME-safe, mirrors wall) */}
          <div className="relative">
            <input type="text" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={zh ? "搜索影片…" : "SEARCH…"}
              className="w-40 sm:w-56 px-2.5 py-1 text-xs font-bold bg-white text-black border-2 border-black shadow-[2px_2px_0_0_#000] focus:border-[#ff00ff] outline-none pixel-font placeholder:text-gray-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} aria-label={zh ? "清除搜索" : "Clear search"}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] font-black text-gray-500 hover:text-black leading-none">×</button>
            )}
          </div>
          <span className="ml-auto text-[10px] sm:text-xs text-gray-400 font-bold pixel-font">
            {sourceMode === "editor"
              ? (zh ? `共 ${itemCount} 组推荐` : `${itemCount} PAIRS`)
              : (zh ? `共 ${itemCount} 份发现` : `${itemCount} FINDS`)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Community comet toggle (same interaction as the wall's 来自社区) —
              Rex 2026-08-25: placed before ALL GENRES on both Discover and Wall */}
          <button
            onClick={() => setSourceMode(sourceMode === "editor" ? "community" : "editor")}
            className={`community-btn px-2.5 py-1 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all ${
              sourceMode === "community" ? "on text-black" : "text-black"
            }`}
          >
            {zh ? "来自社区" : "FROM COMMUNITY"}
          </button>
          {genreBtn("all", zh ? "全部类型" : "ALL GENRES")}
          {COMMON_GENRES.map((g) => genreBtn(g, genreLabel(g, locale)))}
          {genreBtn("other", zh ? "其他" : "OTHER")}
        </div>
      </div>

      {/* Content grid */}
      <div className="max-w-4xl mx-auto px-4 max-sm:px-3">
        {sourceMode === "editor" ? (
          pageItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🎬</p>
              <p className="text-gray-400 text-sm font-bold">{zh ? "没有匹配的推荐" : "No matching picks"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-sm:gap-2">
              {pageItems.map((pair, idx) => (
                <PairCard key={`${pair.source.tmdbId}-${pair.recommend.tmdbId}-${idx}`} pair={pair}
                  posterMap={posterMap} metaMap={metaMap} locale={locale} onOpen={setDetailPair} />
              ))}
            </div>
          )
        ) : (
          <>
            {loadingResults && <p className="text-center text-gray-500 text-xs py-8">{zh ? "加载用户发现..." : "Loading community..."}</p>}
            {!loadingResults && itemCount === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">🎬</p>
                <p className="text-gray-400 text-sm font-bold mb-2">{zh ? "暂无用户发现" : "No community picks yet"}</p>
                <p className="text-gray-500 text-xs mb-4">{zh ? "成为第一个分享 AI 推荐结果的人！" : "Be the first to share!"}</p>
                <Link to="/" className="inline-block px-6 py-2 text-xs font-black bg-[#ffff00] border-4 border-black pixel-font uppercase shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all">{zh ? "获取你的推荐" : "GET YOUR PICKS"}</Link>
              </div>
            )}
            {!loadingResults && itemCount > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-sm:gap-2">
                {pageItems.map(r => (
                  <UserResultCard key={r.id} result={r} posterMap={userPosterMap} locale={locale}
                    onLike={(id, newLikes) => setUserResults(prev => prev.map(x => x.id === id ? { ...x, likes: newLikes } : x))}
                    onOpenPoster={(url) => setModalThumbnail(url)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Pagination — same pattern as the wall */}
      {totalPages > 1 && (
        <div className="max-w-4xl mx-auto px-4 pt-8 pb-4 flex items-center justify-center gap-1.5 flex-wrap">
          <button onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1}
            className="px-3 py-1.5 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-30 disabled:active:translate-y-0 disabled:active:shadow-[2px_2px_0_0_#000] bg-white text-black hover:bg-gray-100">
            {zh ? "← 上一页" : "← PREV"}
          </button>
          {buildPages(safePage, totalPages).map((p, i, arr) => (
            <React.Fragment key={p}>
              {i > 0 && p - arr[i - 1] > 1 && <span className="text-gray-500 text-xs font-black px-0.5">…</span>}
              <button onClick={() => setPage(p)}
                className={`w-8 h-8 text-xs font-black pixel-font border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all ${
                  p === safePage ? "bg-[#ffff00] text-black" : "bg-white text-black hover:bg-gray-100"
                }`}>
                {p}
              </button>
            </React.Fragment>
          ))}
          <button onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages}
            className="px-3 py-1.5 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-30 disabled:active:translate-y-0 disabled:active:shadow-[2px_2px_0_0_#000] bg-white text-black hover:bg-gray-100">
            {zh ? "下一页 →" : "NEXT →"}
          </button>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 max-sm:px-3 pt-8 pb-16 text-center">
        <Link to="/?search=1" className="inline-block px-8 py-3 text-sm font-black pixel-font uppercase text-white bg-black border-4 border-[#ffff00] shadow-[6px_6px_0_0_#ff00ff] hover:translate-y-1 hover:shadow-[3px_3px_0_0_#ff00ff] transition-all">{zh ? "← 获取属于你的 AI 推荐" : "← GET YOUR OWN AI PICKS"}</Link>
      </div>

      {/* Daily digest subscribe — same block as Intelligence (Rex 2026-08-25) */}
      <SubscribeSection locale={locale} />

      {/* Overlays */}
      {detailPair && <PairDetailOverlay pair={detailPair} posterMap={posterMap} metaMap={metaMap} locale={locale} onClose={() => setDetailPair(null)} />}
      {detailPick && <DailyPickDetailOverlay pick={detailPick} locale={locale} onClose={() => setDetailPick(null)} />}
      {modalThumbnail && <PosterModal thumbnail={modalThumbnail} onClose={() => setModalThumbnail(null)} />}

      {/* Lang floating button */}
      <div className="fixed bottom-[116px] sm:bottom-[128px] right-3 sm:right-4 z-40">
        <button onClick={toggleLocale}
          className="w-7 h-7 sm:w-8 sm:h-8 bg-[#ff00ff] border-2 border-black text-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors font-black text-[10px] sm:text-xs shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none"
          style={LANG_BUTTON_STYLE}>
          {zh ? "En" : "中"}
        </button>
      </div>

      {/* Footer — same layout as the other pages */}
      <footer className={`fixed bottom-0 w-full z-10 text-center py-3 bg-black border-t-4 border-[#ffff00] text-white ${zh ? "text-sm max-sm:text-xs font-bold tracking-wider" : "pixel-font text-[10px] max-sm:text-[9px] uppercase tracking-widest"}`}>
        <p>
          <Link to="/?search=1" className="hover:text-[#ffff00] transition-colors">{t('footer.home')}</Link>
          <span className="text-gray-600 mx-2">|</span>
          <Link to="/intelligence" className="hover:text-[#00ffff] transition-colors">{t('footer.intel')}</Link>
          <span className="text-gray-600 mx-2">|</span>
          <Link to="/wall" className="hover:text-[#ff00ff] transition-colors">{t('footer.wall')}</Link>
          <span className="text-gray-600 mx-2">|</span>
          <a href="mailto:rexhr@yahoo.com" className="hover:text-[#ffff00] transition-colors">{t('footer.contact')}</a>
          <span className="text-gray-800 mx-1">·</span>
          <Link to="/admin" className="text-gray-800 hover:text-[#ffff00] transition-colors text-[8px] opacity-20 hover:opacity-100">·</Link>
        </p>
      </footer>
    </div>
  );
};

export default DiscoverPage;
