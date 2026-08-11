import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";
import { GENRE_ZH } from "./Cards";
import { setCanonical } from "../services/seo";
import WallDetailView from "./WallDetailView";

const LANG_BUTTON_STYLE = {
  fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
};

// Common genre tags — everything else falls into the "其他 / OTHER" bucket
const COMMON_GENRES = [
  "Action", "Sci-Fi", "Comedy", "Romance",
  "Horror", "Drama", "Animation", "Thriller",
];

// Normalize genre to zh for filtering — wall.json mixes en (pipeline) and zh (community) genre values
const normGenre = (g) => GENRE_ZH[g] || g;
const COMMON_ZH = COMMON_GENRES.map(normGenre);

const PAGE_SIZE = 24;

const genreLabel = (g, locale) => (locale === "zh" ? GENRE_ZH[g] || g : g);

// Beijing date (YYYY-MM-DD) + midnight timestamp for day-diff math
const todayInfo = () => {
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  return { todayStr, todayTs: Date.parse(todayStr + "T00:00:00Z") };
};

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
        {/* Status badge */}
        <span
          className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-black border-2 border-black leading-none ${
            released ? "bg-black text-[#00ff00]" : "bg-[#ffff00] text-black"
          }`}
        >
          {released
            ? (zh ? "已上线" : "OUT")
            : (zh ? `${days}天后上映` : `IN ${days}D`)}
        </span>
        {/* Rating badge */}
        {movie.rating > 0 && (
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-black bg-[#ff00ff] text-white border-2 border-black leading-none">
            {movie.rating.toFixed(1)}
          </span>
        )}
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

// ── Main WallPage ──
const WallPage = () => {
  const { t, locale, toggleLocale } = useLocale();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all"); // all | released | upcoming
  // Hidden source filter (no UI yet — see filtered() comment). Kept for future "用户推荐" section.
  const [sourceFilter, setSourceFilter] = useState("all"); // all | rec | pipeline
  const [genreFilter, setGenreFilter] = useState("all"); // all | <genre> | other
  const [page, setPage] = useState(1);
  const [detailItem, setDetailItem] = useState(null); // open WallDetailView when set

  const { todayStr, todayTs } = useMemo(todayInfo, []);

  // Scroll back to top when opening a detail view
  useEffect(() => {
    if (detailItem) window.scrollTo({ top: 0 });
  }, [detailItem]);

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

  useEffect(() => {
    document.title = locale === "zh"
      ? "影视墙 | Movie Wall | Kim's Video"
      : "Movie Wall | Kim's Video";
    setCanonical("https://bloodyrex.xyz/wall/");
  }, [locale]);

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
      return true;
    });
  }, [data, statusFilter, genreFilter, sourceFilter, todayStr]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [statusFilter, genreFilter, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const zh = locale === "zh";

  const statusBtn = (id, label) => (
    <button
      key={id}
      onClick={() => setStatusFilter(id)}
      className={`px-4 py-2 text-sm font-black pixel-font uppercase border-4 border-black shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none transition-all ${
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
      {/* Animated comet border for the "来自社区" active state (clockwise, pixel-stepped, orange-yellow) */}
      <style>{`
        @property --wall-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        .community-btn-active {
          border-color: transparent;
          background:
            linear-gradient(#fff, #fff) padding-box,
            conic-gradient(from var(--wall-angle),
              #ffb800 0deg, #ffb800 38deg,
              rgba(255, 184, 0, 0.55) 80deg,
              rgba(255, 184, 0, 0.12) 130deg,
              transparent 180deg) border-box;
          animation: wall-spin 1.6s steps(8) infinite;
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

      {/* Title */}
      <section className="max-w-4xl mx-auto px-2 max-sm:px-3 sm:px-4 pt-3 pb-4 text-center relative">
        <h2 className="text-xl sm:text-2xl font-black text-white drop-shadow-[3px_3px_0_#ff00ff] pixel-font">
          {zh ? "🎬 影视墙" : "🎬 MOVIE WALL"}
        </h2>
        <p className="text-gray-300 text-sm max-w-xl mx-auto leading-relaxed mt-3">{t('wall.desc')}</p>
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
      ) : detailItem ? (
        <div className="max-w-4xl mx-auto px-4 max-sm:px-3">
          <WallDetailView item={detailItem} locale={locale} onClose={() => setDetailItem(null)} />
        </div>
      ) : (
        <>
          {/* Filter bar */}
          <div className="max-w-4xl mx-auto px-4 max-sm:px-3 mb-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {statusBtn("all", zh ? "全部" : "ALL")}
              {statusBtn("released", zh ? "已上线" : "OUT NOW")}
              {statusBtn("upcoming", zh ? "未上线" : "UPCOMING")}
              <span className="ml-auto text-[10px] sm:text-xs text-gray-400 font-bold pixel-font">
                {zh ? `共 ${filtered.length} 部` : `${filtered.length} FILMS`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {genreBtn("all", zh ? "全部类型" : "ALL GENRES")}
              {COMMON_GENRES.map((g) => genreBtn(g, genreLabel(g, locale)))}
              {genreBtn("other", zh ? "其他" : "OTHER")}
              {/* Source filter: films collected from user recommendations / community (source: "rec").
                  Card UI does NOT show this badge — cards keep showing only the genre tag.
                  Active state: clockwise pixel-comet border (bright orange-yellow, fading tail). */}
              <button
                onClick={() => setSourceFilter(sourceFilter === "rec" ? "all" : "rec")}
                className={`px-2.5 py-1 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all ${
                  sourceFilter === "rec" ? "community-btn-active bg-white text-black" : "border-black bg-white text-black hover:bg-gray-100"
                }`}
              >
                {zh ? "来自社区" : "FROM COMMUNITY"}
              </button>
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
          <Link to="/" className="hover:text-[#ffff00] transition-colors">{t('footer.home')}</Link>
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
    </div>
  );
};

export default WallPage;
