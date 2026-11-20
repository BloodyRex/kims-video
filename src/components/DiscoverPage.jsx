import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import discoverData from "../data/discover.json";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";
import { setCanonical } from "../services/seo";
import SubscribeSection from "./SubscribeSection";
import SiteFooter from "./SiteFooter";
import {
  DailyPickCard,
  PairCard,
  PairDetailOverlay,
  DailyPickDetailOverlay,
  UserResultCard,
  PosterModal,
} from "./DiscoverComponents";
import { useDiscoverData } from "../hooks/useDiscoverData";

const LANG_BUTTON_STYLE = {
  fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
};

const COMMON_GENRES = [
  "Action", "Sci-Fi", "Comedy", "Romance",
  "Horror", "Drama", "Animation", "Thriller", "Documentary",
];
const normGenre = (g) => g;
const COMMON_ZH = COMMON_GENRES.map(normGenre);

function buildPages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current - 1, current, current + 1]);
  return [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

const DiscoverPage = () => {
  console.log('[DiscoverPage] render start', { location: window.location.pathname });
  const { t, locale, toggleLocale } = useLocale();
  const zh = locale === "zh";

  const {
    posterMap,
    metaMap,
    dailyPicks,
    userResults,
    loadingResults,
    sourceMode,
    setSourceMode,
    genreFilter,
    setGenreFilter,
    searchQuery,
    setSearchQuery,
    page,
    setPage,
    totalPages,
    safePage,
    pageItems,
    itemCount,
    filteredPairs,
    filteredUserResults,
    modalThumbnail,
    setModalThumbnail,
    detailPair,
    setDetailPair,
    detailPick,
    setDetailPick,
    scrollRef,
    buildPages: buildPagesFn,
    handleLike,
  } = useDiscoverData(discoverData, { locale, fetchDiscoverResults, likeDiscoverResult });
  console.log('[DiscoverPage] hook returned', { sourceMode, genreFilter, itemCount, loadingResults });

    const getTitle = (movie) => locale === "en" ? (movie.titleEn || movie.title) : movie.title;

    useEffect(() => {
      document.title = zh ? "发现 | AI 电影推荐社区 | Kim's Video" : "Discover | AI Movie Recommendations | Kim's Video";
      setCanonical("https://bloodyrex.xyz/discover/");
    }, [locale, zh]);

    const genreBtn = (id, label) => (
      <button key={id} onClick={() => setGenreFilter(id)}
        className={`px-2.5 py-1 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all ${
          genreFilter === id ? "bg-[#ff00ff] text-white" : "bg-white text-black hover:bg-gray-100"
        }`}>
        {label}
      </button>
    );

      console.log('[DiscoverPage] render complete, returning JSX');
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
          <h1 className="text-base sm:text-2xl font-black text-white pixel-font uppercase tracking-widest drop-shadow-[4px_4px_0_#ff00ff] max-sm:whitespace-normal sm:whitespace-nowrap break-words overflow-anywhere leading-tight" style={LANG_BUTTON_STYLE}>
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
              onChange={(e) => {
                if (e.target.composing) return;
                setSearchQuery(e.target.value);
              }}
              onCompositionStart={(e) => { e.target.composing = true; }}
              onCompositionEnd={(e) => { e.target.composing = false; }}
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
            }`}>
            {zh ? "来自社区" : "FROM COMMUNITY"}
          </button>
          <button onClick={() => setGenreFilter("all")}
            className={`px-2.5 py-1 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all ${
              genreFilter === "all" ? "bg-[#ff00ff] text-white" : "bg-white text-black hover:bg-gray-100"
            }`}>
            {zh ? "全部类型" : "ALL GENRES"}
          </button>
          {COMMON_GENRES.map((g) => (
            <button key={g} onClick={() => setGenreFilter(g)}
              className={`px-2.5 py-1 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all ${
                genreFilter === g ? "bg-[#00ffff] text-white" : "bg-white text-black hover:bg-gray-100"
              }`}>
              {g}
            </button>
          ))}
          <button onClick={() => setGenreFilter("other")}
            className={`px-2.5 py-1 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all ${
              genreFilter === "other" ? "bg-[#ffff00] text-white" : "bg-white text-black hover:bg-gray-100"
            }`}>
            {zh ? "其他" : "OTHER"}
          </button>
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
                  <UserResultCard key={r.id} result={r} posterMap={modalThumbnail ? {} : {}} locale={locale}
                    onLike={handleLike}
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
        <Link to="/search" className="inline-block px-8 py-3 text-sm font-black pixel-font uppercase text-white bg-black border-4 border-[#ffff00] shadow-[6px_6px_0_0_#ff00ff] hover:translate-y-1 hover:shadow-[3px_3px_0_0_#ff00ff] transition-all">{zh ? "← 获取属于你的 AI 推荐" : "← GET YOUR OWN AI PICKS"}</Link>
      </div>

      {/* Daily digest subscribe — same block as Intelligence (Rex 2026-08-25) */}
      <SubscribeSection locale={locale} />

      {/* Overlays */}
      {detailPair && <PairDetailOverlay pair={detailPair} posterMap={posterMap} metaMap={metaMap} locale={locale} onClose={() => setDetailPair(null)} />}
      {detailPick && <DailyPickDetailOverlay pick={detailPick} locale={locale} onClose={() => setDetailPick(null)} />}
      {modalThumbnail && <PosterModal thumbnail={modalThumbnail} onClose={() => setModalThumbnail(null)} />}

      {/* Lang floating button — adaptive: sits above SubscribeSection on mobile, above footer on desktop */}
            <div className="fixed bottom-0 right-0 z-40 p-4 pointer-events-none sm:static sm:pointer-events-auto sm:p-0">
              <div className="flex justify-end">
                <button onClick={toggleLocale}
                  className="w-7 h-7 sm:w-8 sm:h-8 bg-[#ff00ff] border-2 border-black text-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors font-black text-[10px] sm:text-xs shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none pointer-events-auto"
                  style={LANG_BUTTON_STYLE}>
                  {zh ? "En" : "中"}
                </button>
              </div>
            </div>

      <SiteFooter />
    </div>
  );
};

export default DiscoverPage;