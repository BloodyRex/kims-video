import React, { useState, useEffect } from "react";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";
import { StarRating, TrailerButtons, GENRE_ZH } from "./Cards";
import { fetchMovieByTmdbId } from "../services/api";

// Same poster proxy as Cards.jsx (TMDB image CDN may be blocked in some regions)
function posterUrl(path) {
  if (!path) return "";
  if (path.startsWith("https://image.tmdb.org/") || path.startsWith("https://coverartarchive.org/")) {
    return "https://api.bloodyrex.xyz/poster-proxy?url=" + encodeURIComponent(path);
  }
  return path;
}

/**
 * Wall detail view — mirrors IntelDetailModal layout (intelligence page).
 * Base data comes from the wall.json item (zero requests); enriched fields
 * (director/runtime/cast/overview/imdb_id) lazy-load via fetchMovieByTmdbId
 * (Worker → TMDB, KV-cached, NO DeepSeek → zero LLM tokens).
 */
export default function WallDetailView({ item, locale, onClose }) {
  const zh = locale === "zh";
  const [detailData, setDetailData] = useState(null);

  useEffect(() => {
    if (!item.tmdbId) return;
    let cancelled = false;
    fetchMovieByTmdbId(item.tmdbId, locale).then((data) => {
      if (!cancelled && data) setDetailData(data);
    });
    return () => { cancelled = true; };
  }, [item.tmdbId, locale]);
  const enriched = detailData || {};

  const title = zh ? item.title : item.titleEn || item.title;
  const genres = Array.isArray(item.genre) ? item.genre : [];
  const tmdbUrl = `https://www.themoviedb.org/movie/${item.tmdbId}`;
  // Exact IMDb page when imdb_id is available (new Worker field), else fallback search
  const imdbUrl = enriched.imdb_id
    ? `https://www.imdb.com/title/${enriched.imdb_id}`
    : `https://www.imdb.com/find?q=${encodeURIComponent(((item.titleEn || item.title) + " " + (item.year || "")).trim())}`;

  // Status (released / countdown) — Beijing timezone, same logic as wall cards
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const released = !item.releaseDate || item.releaseDate <= todayStr;
  const days = item.releaseDate
    ? Math.ceil((Date.parse(item.releaseDate + "T00:00:00Z") - Date.parse(todayStr + "T00:00:00Z")) / 86400000)
    : 0;

  return (
    <div>
      {/* Bar */}
      <div className="flex items-center justify-between bg-black border-4 border-[#ff00ff] px-4 sm:px-6 py-3 mb-6 shadow-[6px_6px_0_0_#ff00ff]">
        <span className="font-black pixel-font text-[#ff00ff] text-xs sm:text-sm flex-shrink-0">
          {zh ? "作品详情" : "DETAILS"}
        </span>
        <button onClick={onClose}
          className="w-7 h-7 sm:w-8 sm:h-8 bg-[#ff00ff] border-2 border-black text-black flex items-center justify-center font-black text-xs sm:text-sm hover:bg-black hover:text-[#ff00ff] transition-colors pixel-font flex-shrink-0">
          X
        </button>
      </div>

      <div className="bg-white border-8 max-sm:border-4 border-black p-6 max-sm:p-4 md:p-8 shadow-[16px_16px_0_0_#ffff00] max-sm:shadow-[8px_8px_0_0_#ffff00]">
        {/* Poster + Info row */}
        <div className="flex flex-col md:flex-row gap-6 max-sm:gap-4 mb-4">
          {/* Poster */}
          <div className="w-full md:w-48 flex-shrink-0">
            {item.poster ? (
              <div className="border-4 border-black overflow-hidden shadow-[4px_4px_0_0_#000]">
                <img src={posterUrl(item.poster)} alt={title} className="w-full h-auto object-cover" />
              </div>
            ) : (
              <div className="border-4 border-black bg-gray-800 text-white flex items-center justify-center h-64 text-xs pixel-font shadow-[4px_4px_0_0_#000]">
                <Icons.Film className="w-8 h-8" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            {/* Title bar */}
            <div className="flex flex-wrap items-baseline gap-3 mb-4 bg-black p-3 border-2 border-[#00ffff]">
              <h2 className="text-3xl font-black text-white">{title}</h2>
              {item.titleEn && item.titleEn !== title && (
                <span className="text-[#00ffff] italic font-bold">{item.titleEn}</span>
              )}
              <span className="bg-[#ff00ff] text-white px-2 py-1 font-black pixel-font text-xs border-2 border-white ml-auto leading-none">
                {item.year || ""} | {zh ? "电影" : "MOVIE"}
              </span>
            </div>

            {/* Tags row: status + rating + director + runtime */}
            <div className="flex flex-wrap gap-2 mb-4">
              {released ? (
                <span className="bg-black text-[#00ff00] px-2 py-1 font-black text-xs border-2 border-black leading-none">
                  {zh ? "已上线" : "OUT NOW"}
                </span>
              ) : (
                <span className="bg-[#ffff00] text-black px-2 py-1 font-black text-xs border-2 border-black leading-none">
                  {zh ? `${days}天后上映` : `IN ${days}D`}
                </span>
              )}
              <StarRating score={item.rating} max={10} />
              {enriched.director && (
                <span className="bg-white text-black px-2 py-1 font-black text-xs border-2 border-black uppercase leading-none">
                  🎬 {zh ? (enriched.directorEn || enriched.director) : enriched.director}
                </span>
              )}
              {enriched.runtime && (
                <span className="bg-black text-white px-2 py-1 font-black text-xs border-2 border-[#00ffff] pixel-font leading-none">
                  ⏱ {zh ? `${enriched.runtime}分钟` : `${enriched.runtime} min`}
                </span>
              )}
            </div>

            {/* Genre badges — complete list from wall.json */}
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {genres.map((g, i) => (
                  <span key={i} className="bg-black text-white px-2 py-1 font-black text-xs border-2 border-[#ff00ff] pixel-font leading-none">
                    {zh ? (GENRE_ZH[g] || g) : g}
                  </span>
                ))}
              </div>
            )}

            {/* Cast — lazy-loaded, first 5 (same as intelligence page) */}
            {enriched.cast && enriched.cast.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {enriched.cast.slice(0, 5).map((actor, i) => (
                  <span key={i} className="bg-black text-white px-2 py-1 text-xs font-bold border border-gray-600 leading-none">🎭 {actor}</span>
                ))}
              </div>
            )}

            {/* Release date + first-seen meta */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 font-bold">
              {item.releaseDate && (
                <span>{zh ? `上线日期：${item.releaseDate}` : `Release: ${item.releaseDate}`}</span>
              )}
              {item.firstSeen && (
                <span>{zh ? `本站收录于 ${item.firstSeen}` : `Collected on ${item.firstSeen}`}</span>
              )}
            </div>
          </div>
        </div>

        {/* Summary — pre-translated zh summary from wall.json (instant), else lazy overview */}
        {(item.summary || enriched.overview) && (
          <div className="bg-[#f0f0f0] border-4 border-black p-4 mb-4">
            <p className="text-black font-bold leading-relaxed text-sm sm:text-base">{item.summary || enriched.overview}</p>
          </div>
        )}

        {/* Action buttons: TMDB + IMDb + YouTube + Bilibili (same styles as intelligence cards) */}
        <div className="flex flex-wrap items-center gap-2">
          <a href={tmdbUrl} target="_blank" rel="noopener noreferrer"
            className="inline-block px-4 py-2 bg-[#00dd00] hover:bg-[#00ff00] text-black border-4 border-black text-xs font-black uppercase transition-colors shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none pixel-font">
            {zh ? "在 TMDB 查看完整资料 ↗" : "View on TMDB ↗"}
          </a>
          <a href={imdbUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center w-10 h-10 bg-[#F5C518] border-4 border-black hover:bg-[#dbaa00] transition-colors flex-shrink-0 overflow-hidden shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none"
            title="Open in IMDb">
            <Icons.Imdb className="w-full h-full" />
          </a>
          <TrailerButtons item={{ titleEn: item.titleEn || item.title, tmdbId: item.tmdbId }} locale={locale} size="lg" />
        </div>
      </div>

      {/* Back button */}
      <div className="flex justify-center gap-4 pt-6 pb-8">
        <button onClick={onClose}
          className="flex items-center text-white bg-black border-4 border-[#00ffff] px-6 py-3 uppercase font-bold hover:bg-[#00ffff] hover:text-black transition-colors pixel-font text-sm shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none">
          {zh ? "← 返回影视墙" : "← BACK TO WALL"}
        </button>
      </div>
    </div>
  );
}
