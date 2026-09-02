import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";
import { GENRE_ZH, RatingBadge } from "./Cards";
import { setCanonical } from "../services/seo";
import WallDetailView from "./WallDetailView";
import DetailOverlay from "./DetailOverlay";
import SubscribeSection from "./SubscribeSection";

const LANG_BUTTON_STYLE = {
  fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
};

// Common genre tags — everything else falls into the "其他 / OTHER" bucket
const COMMON_GENRES = [
  "Action", "Sci-Fi", "Comedy", "Romance",
  "Horror", "Drama", "Animation", "Thriller", "Documentary",
];

// Normalize genre to zh for filtering — wall.json mixes en (pipeline) and zh (community) genre values
const normGenre = (g) => GENRE_ZH[g] || g;
const COMMON_ZH = COMMON_GENRES.map(normGenre);

const PAGE_SIZE = 24;

const genreLabel = (g, locale) => (locale === "zh" ? GENRE_ZH[g] || g : g);

// Beijing date (YYYY-MM-DD) + midnight timestamp for day-diff math
function todayInfo() {
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  return { todayStr, todayTs: Date.parse(todayStr + "T00:00:00Z") };
}

function thirtyDaysAgoStr() {
  return new Date(Date.now() - 30 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

function buildPages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current - 1, current, current + 1]);
  return [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

// ── Wall Card ──
function WallCard({ movie, locale, todayStr, todayTs, onOpen }) {
  const released = !movie.releaseDate || movie.releaseDate <= todayStr;
  const days = movie.releaseDate
    ? Math.ceil((Date.parse(movie.releaseDate + "T00:00:00Z") - todayTs) / 86400000)
    : 0;
  const zh = locale === "zh";

  return (
    <div onClick={() => onOpen && onOpen(movie)}
      className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#ff00ff] transition-all group cursor-pointer">
      <div className="relative overflow-hidden border-b-2 border-black">
        {movie.poster ? (
          <img
            src={movie.poster}
            alt={movie.title}
            className="w-full aspect-[2/3] object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center text-gray-500">
            <Icons.Film className="w-8 h-8" />
          </div>
        )}
        {/* Status badge — Rex 2026-08-25: smaller (8px) so it doesn't crowd the poster */}
        <span
          className={`absolute top-1.5 left-1.5 px-1 py-0.5 text-[8px] font-black border border-black leading-none ${
            released ? "bg-black text-[#00ff00]" : "bg-[#ffff00] text-black"
          }`}
        >
          {released
            ? (zh ? "已上线" : "OUT")
            : (zh ? `${days}天后上映` : `IN ${days}D`)}
        </span>
        {/* Rating badge */}
        <RatingBadge score={movie.rating} />
      </div>
      <div className="p-2 max-sm:p-1.5">
        <h3 className="text-xs font-black truncate leading-tight" title={movie.title}>
          {movie.title}
        </h3>
        {movie.titleEn && (
          <p className="text-[9px] text-gray-500 font-bold truncate">{movie.titleEn}</p>
        )}
        <div className="flex items-center justify-between mt-1 gap-1">
          <span className="text-[9px] text-gray-600 font-bold truncate">
            {movie.releaseDate || movie.year || ""}
          </span>
          {movie.genre.length > 0 && (
            <span className="text-[8px] px-1 bg-black text-white font-bold flex-shrink-0">
              {genreLabel(movie.genre[0], locale)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TV Wall Card (per-season) ──
function TvWallCard({ show, locale, todayStr, onOpen }) {
  const zh = locale === "zh";
  const active = !!(show.latestAirDate && show.latestAirDate >= thirtyDaysAgoStr());
  const statusDot = active
    ? { cls: "bg-[#00ff00]", label: zh ? "追更中" : "AIRING" }
    : { cls: "bg-[#ffff00]", label: zh ? "待回归" : "HIATUS" };
  return (
    <div onClick={() => onOpen && onOpen(show)}
      className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#00ffff] transition-all group cursor-pointer">
      <div className="relative overflow-hidden border-b-2 border-black bg-black">
        {show.poster ? (
          <img src={show.poster} alt={show.title}
            className="w-full aspect-[2/3] object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy" />
        ) : (
          <div className="w-full aspect-[2/3] flex items-center justify-center text-gray-500">
            <Icons.Tv className="w-8 h-8" />
          </div>
        )}
        {/* Season badge — top-left, the per-season wall's signature */}
        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-black border-2 border-black leading-none bg-[#00ffff] text-black">
          S{show.season}
        </span>
        {/* Activity dot + label — top-right */}
        <span className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1 py-0.5 text-[8px] font-black bg-black/80 border border-gray-700 leading-none">
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot.cls}`} />
          <span className="text-white">{statusDot.label}</span>
        </span>
        {/* Rating badge */}
        <RatingBadge score={show.rating} />
      </div>
      <div className="p-2 max-sm:p-1.5">
        <h3 className="text-xs font-black truncate leading-tight" title={show.title}>{show.title}</h3>
        <p className="text-[9px] text-gray-500 font-bold truncate">
          {zh ? `更新至 S${show.season}E${show.episode ?? "?"}` : `S${show.season}E${show.episode ?? "?"}`}
        </p>
        <div className="flex items-center justify-between mt-1 gap-1">
          <span className="text-[9px] text-gray-600 font-bold truncate">{show.latestAirDate || ""}</span>
          {show.genre.length > 0 && (
            <span className="text-[8px] px-1 bg-black text-white font-bold flex-shrink-0">
              {genreLabel(show.genre[0], locale)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main WallPage ──
const WallPage = () => {
  const { t, locale, toggleLocale } = useLocale();
  // Dual mode (2026-08-24): /wall = 🎬 movie wall (default), /wall?type=tv = 📺 TV wall.
  // One page, two datasets — footer/nav links stay untouched, ?type=tv is shareable.
  const [wallType, setWallType] = useState(() =>
    new URLSearchParams(window.location.search).get("type") === "tv" ? "tv" : "movie"
  );
  const [tvData, setTvData] = useState(null);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all"); // all | released | upcoming
  // Hidden source filter (no UI yet — see filtered() comment). Kept for future "用户推荐" section.
  const [sourceFilter, setSourceFilter] = useState("all"); // all | rec | pipeline
  const [genreFilter, setGenreFilter] = useState("all"); // all | <genre> | other
  const [searchQuery, setSearchQuery] = useState(""); // film title search (zh + en)
  const [page, setPage] = useState(1);
  const [detailItem, setDetailItem] = useState(null); // open WallDetailView when set

  const { todayStr, todayTs } = useMemo(todayInfo, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wall.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => { cancelled = true; };
  }, []);

  // TV wall dataset — lazy: only fetched when the user switches to 📺 mode
  useEffect(() => {
    if (wallType !== "tv" || tvData) return;
    let cancelled = false;
    fetch("/api/tvwall.json")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { if (!cancelled) setTvData(d); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [wallType]);

  useEffect(() => {
    document.title = locale === "zh"
      ? (wallType === "tv" ? "剧集墙 | TV Wall | Kim's Video" : "影视墙 | Movie Wall | Kim's Video")
      : "Movie Wall | Kim's Video";
    setCanonical("https://bloodyrex.xyz/wall/");
  }, [locale, wallType]);

  // TV wall items: latestAirDate is the axis. Status = 追更中(30d activity) /
  // 待回归(older) — everything on this wall has aired by definition.
  const tvFiltered = useMemo(() => {
    if (!tvData) return [];
    const items = tvData.shows || [];
    return items.filter((s) => {
      if (statusFilter === "upcoming") return false; // no un-aired shows on the TV wall
      if (statusFilter === "released") {
        const active = s.latestAirDate && s.latestAirDate >= thirtyDaysAgoStr();
        if (!active) return false;
      }
      const q = searchQuery.trim().toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "");
      if (q && !((s.title || "").toLowerCase().includes(q) || (s.titleEn || "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [tvData, statusFilter, searchQuery]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.movies.filter((m) => {
      if (statusFilter === "released" && m.releaseDate && m.releaseDate > todayStr) return false;
      if (statusFilter === "upcoming" && (!m.releaseDate || m.releaseDate <= todayStr)) return false;
      if (genreFilter === "other") {
        if (m.genre.some((g) => COMMON_ZH.includes(normGenre(g)))) return false;
      } else if (genreFilter !== "all") {
        const fz = normGenre(genreFilter);
        if (!m.genre.some((g) => normGenre(g) === fz)) return false;
      }
      // Hidden source filter — capability kept for future UI (Rex 2026-08-08).
      // wall.json items may carry source: "rec" (user recommendation collection) or "pipeline" (default).
      // To expose the filter later: add a control that calls setSourceFilter("rec"/"pipeline"/"all").
      if (sourceFilter !== "all" && (m.source || "pipeline") !== sourceFilter) return false;
      // Search: case-insensitive substring match on zh title + en title.
      // React's default IME behavior drives onChange directly; strip zero-width
      // chars (ZWSP/ZWNJ/ZWJ/BOM) defensively so invisible IME residue can't
      // break matching. Pinyin intermediate states may briefly flash empty —
      // standard instant-search behavior, resolved on composition end.
      const q = searchQuery.trim().toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "");
      if (q) {
        const hit = (m.title || "").toLowerCase().includes(q) || (m.titleEn || "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [data, statusFilter, genreFilter, sourceFilter, searchQuery, todayStr]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [statusFilter, genreFilter, sourceFilter, searchQuery, wallType]);

  const totalPages = Math.max(1, Math.ceil((wallType === "tv" ? tvFiltered : filtered).length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = (wallType === "tv" ? tvFiltered : filtered).slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const zh = locale === "zh";

  // 2026-08-24: shrunk to match Discover page chips (text-[10px] sm:text-xs,
  // border-2) — Rex flagged the size mismatch between wall and discover.
  const statusBtn = (id, label) => (
    <button
      key={id}
      onClick={() => setStatusFilter(id)}
      className={`px-2.5 py-1 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all ${
        statusFilter === id ? "bg-[#ff00ff] text-white" : "bg-white text-black hover:bg-gray-100"
      }`}
    >
      {label}
    </button>
  );

  const genreBtn = (id, label) => (
    <button
      key={id}
      onClick={() => setGenreFilter(id)}
      className={`px-2.5 py-1 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all ${
        genreFilter === id ? "bg-[#ff00ff] text-white" : "bg-white text-black hover:bg-gray-100"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className={`min-h-screen graffiti-bg text-black pb-32 wall-page locale-${locale}`}>
      {/* Comet border for the "来自社区" button — ALWAYS animated (clockwise, solid head leading, fading tail).
          Active state adds the cyan fill; the comet animation keeps running. */}
      <style>{`
        @property --wall-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        .community-btn {
          border: 2px solid transparent;
          background:
            linear-gradient(#fff, #fff) padding-box,
            conic-gradient(from calc(var(--wall-angle) + 180deg),
              transparent 0deg, transparent 200deg,
              rgba(255, 184, 0, 0.15) 240deg, rgba(255, 184, 0, 0.15) 258deg,
              rgba(255, 184, 0, 0.5) 284deg, rgba(255, 184, 0, 0.5) 300deg,
              #ffb800 312deg, #ffb800 360deg) border-box;
          animation: wall-spin 1.6s steps(8) infinite;
        }
        .community-btn.on {
          background:
            linear-gradient(#00ffff, #00ffff) padding-box,
            conic-gradient(from calc(var(--wall-angle) + 180deg),
              transparent 0deg, transparent 200deg,
              rgba(255, 184, 0, 0.15) 240deg, rgba(255, 184, 0, 0.15) 258deg,
              rgba(255, 184, 0, 0.5) 284deg, rgba(255, 184, 0, 0.5) 300deg,
              #ffb800 312deg, #ffb800 360deg) border-box;
        }
        @keyframes wall-spin {
          to { --wall-angle: 360deg; }
        }
      `}</style>
      {/* Header — identical to the other three pages */}
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

      {/* Title + wall type switcher */}
      <section className="max-w-4xl mx-auto px-2 max-sm:px-3 sm:px-4 pt-3 pb-4 text-center relative">
        {/* Rex 2026-08-25: back to centered; zh keeps no space after emoji,
            EN keeps a single space ("🎬 MOVIE WALL") */}
        <h2 className="text-xl sm:text-2xl font-black text-white drop-shadow-[3px_3px_0_#ff00ff] pixel-font">
          {wallType === "tv" ? (zh ? "📺剧集墙" : "📺 TV WALL") : (zh ? "🎬影视墙" : "🎬 MOVIE WALL")}
        </h2>
        <p className="text-gray-300 text-sm max-w-xl mx-auto leading-relaxed mt-3">
          {wallType === "tv"
            ? (zh ? "按季追踪的剧集长卷——每季一张卡，按最新播出时间排布。" : "A per-season TV chronicle, arranged by latest air date.")
            : t('wall.desc')}
        </p>
        {/* Wall switcher — 🎬 movies | 📺 TV; ?type=tv keeps the mode shareable.
            Rex 2026-08-25: padding matched to Discover/Wall filter chips (px-2.5 py-1) */}
        <div className="inline-flex mt-4 border-2 border-black shadow-[3px_3px_0_0_#000] bg-white">
          <button
            onClick={() => { setWallType("movie"); setPage(1); }}
            className={`px-2.5 py-1 text-[10px] sm:text-xs font-black pixel-font uppercase transition-colors ${wallType === "movie" ? "bg-[#ff00ff] text-white" : "bg-white text-black hover:bg-gray-100"}`}>
            🎬 {zh ? "电影墙" : "MOVIES"}
          </button>
          <button
            onClick={() => { setWallType("tv"); setStatusFilter("all"); setPage(1); }}
            className={`px-2.5 py-1 text-[10px] sm:text-xs font-black pixel-font uppercase border-l-2 border-black transition-colors ${wallType === "tv" ? "bg-[#00ffff] text-black" : "bg-white text-black hover:bg-gray-100"}`}>
            📺 {zh ? "剧集墙" : "TV"}
          </button>
        </div>
      </section>

      {loadError ? (
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <p className="text-4xl mb-3">🎬</p>
          <p className="text-gray-400 text-sm font-bold mb-2">{t('wall.error')}</p>
          <button
            onClick={() => { setLoadError(false); window.location.reload(); }}
            className="inline-block px-6 py-2 text-xs font-black bg-[#ffff00] border-4 border-black pixel-font uppercase shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all"
          >
            {zh ? "重试" : "RETRY"}
          </button>
        </div>
      ) : !data ? (
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <p className="text-gray-500 text-xs font-bold pixel-font">{t('wall.loading')}</p>
        </div>
      ) : wallType === "tv" ? (
        <>
          {/* TV filter bar — simplified: status (追更中) + search */}
          <div className="max-w-4xl mx-auto px-4 max-sm:px-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all ${statusFilter === "all" && !searchQuery ? "bg-[#00ffff] text-black" : "bg-white text-black hover:bg-gray-100"}`}>
                {zh ? "全部剧集" : "ALL"}
              </button>
              <button
                onClick={() => setStatusFilter("released")}
                className={`px-2.5 py-1 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all ${statusFilter === "released" ? "bg-[#00ffff] text-black" : "bg-white text-black hover:bg-gray-100"}`}>
                🟢 {zh ? "追更中" : "AIRING"}
              </button>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={zh ? "搜索剧集…" : "SEARCH…"}
                  className="w-40 sm:w-56 px-2.5 py-1 text-xs font-bold bg-white text-black border-2 border-black shadow-[2px_2px_0_0_#000] focus:border-[#00ffff] outline-none pixel-font placeholder:text-gray-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    aria-label={zh ? "清除搜索" : "Clear search"}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] font-black text-gray-500 hover:text-black leading-none"
                  >×</button>
                )}
              </div>
              <span className="ml-auto text-[10px] sm:text-xs text-gray-400 font-bold pixel-font">
                {zh ? `共 ${tvFiltered.length} 季` : `${tvFiltered.length} SEASONS`}
              </span>
            </div>
          </div>

          {/* TV wall grid — per-season cards, latestAirDate axis */}
          <div className="max-w-4xl mx-auto px-4 max-sm:px-3">
            {!tvData ? (
              <div className="text-center py-16">
                <p className="text-gray-500 text-xs font-bold pixel-font">{t('wall.loading')}</p>
              </div>
            ) : pageItems.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">📺</p>
                <p className="text-gray-400 text-sm font-bold">{t('wall.empty')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-sm:gap-2">
                {pageItems.map((s) => (
                  <TvWallCard key={`${s.tmdbId}:S${s.season}`} show={s} locale={locale} todayStr={todayStr} onOpen={setDetailItem} />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Filter bar */}
          <div className="max-w-4xl mx-auto px-4 max-sm:px-3 mb-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {statusBtn("all", zh ? "全部" : "ALL")}
              {statusBtn("released", zh ? "已上线" : "OUT NOW")}
              {statusBtn("upcoming", zh ? "未上线" : "UPCOMING")}
              {/* Title search (zh + en), IME-safe */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={zh ? "搜索影片…" : "SEARCH…"}
                  className="w-40 sm:w-56 px-2.5 py-1 text-xs font-bold bg-white text-black border-2 border-black shadow-[2px_2px_0_0_#000] focus:border-[#ff00ff] outline-none pixel-font placeholder:text-gray-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    aria-label={zh ? "清除搜索" : "Clear search"}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] font-black text-gray-500 hover:text-black leading-none"
                  >×</button>
                )}
              </div>
              <span className="ml-auto text-[10px] sm:text-xs text-gray-400 font-bold pixel-font">
                {zh ? `共 ${filtered.length} 部` : `${filtered.length} FILMS`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Source filter: films collected from user recommendations / community (source: "rec").
                  Card UI does NOT show this badge — cards keep showing only the genre tag.
                  Always-on comet border (clockwise, solid head + fading tail).
                  Rex 2026-08-25: placed before ALL GENRES, matching Discover. */}
              <button
                onClick={() => setSourceFilter(sourceFilter === "rec" ? "all" : "rec")}
                className={`community-btn px-2.5 py-1 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all ${
                  sourceFilter === "rec" ? "on text-black" : "text-black"
                }`}
              >
                {zh ? "来自社区" : "FROM COMMUNITY"}
              </button>
              {genreBtn("all", zh ? "全部类型" : "ALL GENRES")}
              {COMMON_GENRES.map((g) => genreBtn(g, genreLabel(g, locale)))}
              {genreBtn("other", zh ? "其他" : "OTHER")}
            </div>
          </div>

          {/* Wall grid */}
          <div className="max-w-4xl mx-auto px-4 max-sm:px-3">
            {pageItems.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">🎬</p>
                <p className="text-gray-400 text-sm font-bold">{t('wall.empty')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-sm:gap-2">
                {pageItems.map((m) => (
                  <WallCard key={m.tmdbId} movie={m} locale={locale} todayStr={todayStr} todayTs={todayTs} onOpen={setDetailItem} />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="max-w-4xl mx-auto px-4 pt-8 pb-4 flex items-center justify-center gap-1.5 flex-wrap">
              <button
                onClick={() => setPage(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
                className="px-3 py-1.5 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-30 disabled:active:translate-y-0 disabled:active:shadow-[2px_2px_0_0_#000] bg-white text-black hover:bg-gray-100"
              >
                {zh ? "← 上一页" : "← PREV"}
              </button>
              {buildPages(safePage, totalPages).map((p, i, arr) => (
                <React.Fragment key={p}>
                  {i > 0 && p - arr[i - 1] > 1 && (
                    <span className="text-gray-500 text-xs font-black px-0.5">…</span>
                  )}
                  <button
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 text-xs font-black pixel-font border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all ${
                      p === safePage ? "bg-[#ffff00] text-black" : "bg-white text-black hover:bg-gray-100"
                    }`}
                  >
                    {p}
                  </button>
                </React.Fragment>
              ))}
              <button
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-1.5 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-30 disabled:active:translate-y-0 disabled:active:shadow-[2px_2px_0_0_#000] bg-white text-black hover:bg-gray-100"
              >
                {zh ? "下一页 →" : "NEXT →"}
              </button>
            </div>
          )}
        </>
      )}

      <SubscribeSection locale={locale} />

      {/* Lang floating button — same as Discover/Intelligence */}
      <div className="fixed bottom-[116px] sm:bottom-[128px] right-3 sm:right-4 z-40">
        <button
          onClick={toggleLocale}
          className="w-7 h-7 sm:w-8 sm:h-8 bg-[#ff00ff] border-2 border-black text-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors font-black text-[10px] sm:text-xs shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none"
          style={LANG_BUTTON_STYLE}
        >
          {locale === "zh" ? "En" : "中"}
        </button>
      </div>

      {/* Footer — same layout as the other pages */}
      <footer className={`fixed bottom-0 w-full z-10 text-center py-3 bg-black border-t-4 border-[#ffff00] text-white ${zh ? "text-sm max-sm:text-xs font-bold tracking-wider" : "pixel-font text-[10px] max-sm:text-[9px] uppercase tracking-widest"}`}>
        <p>
          <Link to="/?search=1" className="hover:text-[#ffff00] transition-colors">{t('footer.home')}</Link>
          <span className="text-gray-600 mx-2">|</span>
          <Link to="/discover" className="hover:text-[#ffff00] transition-colors">{t('footer.discover')}</Link>
          <span className="text-gray-600 mx-2">|</span>
          <Link to="/intelligence" className="hover:text-[#00ffff] transition-colors">{t('footer.intel')}</Link>
          <span className="text-gray-600 mx-2">|</span>
          <a href="mailto:rexhr@yahoo.com" className="hover:text-[#ffff00] transition-colors">{t('footer.contact')}</a>
          <span className="text-gray-800 mx-1">·</span>
          <Link to="/admin" className="text-gray-800 hover:text-[#ffff00] transition-colors text-[8px] opacity-20 hover:opacity-100">·</Link>
        </p>
      </footer>

      {/* Detail overlay — full-screen above the wall (site-wide standard, 2026-08-24).
          Closing restores scroll/filter state with zero refetch. */}
      {detailItem && (
        <DetailOverlay onClose={() => setDetailItem(null)}>
          <WallDetailView item={detailItem} locale={locale} onClose={() => setDetailItem(null)} />
        </DetailOverlay>
      )}
    </div>
  );
};

export default WallPage;
