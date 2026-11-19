import React, { useState, useEffect } from "react";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";
import { StarRating, TrailerButtons, GENRE_ZH } from "./IntelCards";
import { posterUrl } from "../utils/poster";
import { pickSummary, matchesDetailType } from "./IntelCards";
import { fetchMovieByTmdbId } from "../services/api";
import { toggleFavorite, listFavorites } from "../utils/personalStore";
import { useMovieDetail } from "../hooks/useMovieDetail";

export function IntelDetailModal({ item, type, locale, onClose }) {
  const zh = locale === "zh";
  const { data: detailData, loading: detailLoading } = useMovieDetail(item?.tmdbId, locale, type === "tv" ? "tv" : "movie");

  if (!item) return null;
  const title = getTitle(item, locale);
  const isMusic = type === "music" || type === "album";
  const isTV = type === "tv";
  // Type chip in the title bar + TrailerButtons lookup — declaration was lost in
  // the earlier restore and crashed every detail view (ReferenceError → black screen)
  const typeLabel = isMusic ? (zh ? "专辑" : "ALBUM") : isTV ? (zh ? "剧集" : "TV") : (zh ? "电影" : "MOVIE");
  const enriched = detailData || {};
  // ponytail: legacy music favourites have no verifiable description source (no mbid/lastfm endpoint),
  // so they show the explicit "暂无介绍" text; new ones keep the summary saved at save time.
  const summary = pickSummary(item, locale, enriched);
  const tmdbPath = isTV ? "tv" : "movie";
  const tmdbUrl = `https://www.themoviedb.org/${tmdbPath}/${item.tmdbId}`;
  // Exact IMDb page when imdb_id is available (lazy-loaded), else fallback search
  const imdbUrl = enriched.imdb_id
    ? `https://www.imdb.com/title/${enriched.imdb_id}`
    : `https://www.imdb.com/find?q=${encodeURIComponent(((item.titleEn || item.title) + " " + (item.year || "")).trim())}`;
  const genres = Array.isArray(item.genre) ? item.genre : (item.genre ? [item.genre] : []);
  const musicGenres = isMusic ? albumGenres(item) : [];

  // Countdown badge data (mirrors wall detail status chip)
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const released = !item.releaseDate || item.releaseDate <= todayStr;
  const daysToRelease = item.releaseDate
    ? Math.ceil((Date.parse(item.releaseDate + "T00:00:00Z") - Date.parse(todayStr + "T00:00:00Z")) / 86400000)
    : 0;

  return (
    <div>
      {/* Bar — identical to WallDetailView */}
      <div className="flex items-center justify-between bg-black border-4 border-[#ff00ff] px-4 sm:px-6 py-3 mb-6 shadow-[6px_6px_0_0_#ff00ff]">
        <span className="font-black pixel-font text-[#ff00ff] text-xs sm:text-sm flex-shrink-0">
          {isMusic ? (zh ? "专辑详情" : "ALBUM DETAILS") : (zh ? "作品详情" : "DETAILS")}
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
            {item.poster || item.cover ? (
              <div className="border-4 border-black overflow-hidden shadow-[4px_4px_0_0_#000]">
                <img src={posterUrl(item.poster || item.cover)} alt={title} className="w-full h-auto object-cover" />
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
              {!isMusic && item.titleEn && item.titleEn !== title && (
                <span className="text-[#00ffff] italic font-bold">{item.titleEn}</span>
              )}
              {isMusic && item.artist && <span className="text-gray-400 italic font-bold text-sm">{item.artist}</span>}
              <span className="bg-[#ff00ff] text-white px-2 py-1 font-black pixel-font text-xs border-2 border-white ml-auto leading-none">
                {item.year || ""} | {typeLabel}
              </span>
            </div>

            {/* Tags row: countdown/status + rating + director + runtime (wall order) */}
            <div className="flex flex-wrap gap-2 mb-4">
              {!isMusic && (released ? (
                <span className="bg-black text-[#00ff00] px-2 py-1 font-black text-xs border-2 border-black leading-none">
                  {zh ? "已上线" : "OUT NOW"}
                </span>
              ) : (
                <span className="bg-[#ffff00] text-black px-2 py-1 font-black text-xs border-2 border-black leading-none">
                  {zh ? `${daysToRelease}天后上映` : `IN ${daysToRelease}D`}
                </span>
              ))}
              <StarRating score={item.rating} max={10} />
              <AIScoreBadge score={item.aiScore} confidence={item.confidence} />
              {!isMusic && enriched.director && (
                <span className="bg-white text-black px-2 py-1 font-black text-xs border-2 border-black uppercase leading-none">
                  🎬 {zh ? (enriched.directorEn || enriched.director) : enriched.director}
                </span>
              )}
              {!isMusic && enriched.runtime && (
                <span className="bg-black text-white px-2 py-1 font-black text-xs border-2 border-[#00ffff] pixel-font leading-none">
                  ⏱ {zh ? `${enriched.runtime}分钟` : `${enriched.runtime} min`}
                </span>
              )}
            </div>

            {/* Genre badges */}
            {isMusic
              ? (musicGenres.length > 0
                ? <div className="flex flex-wrap gap-2 mb-4">{musicGenres.map((tg, i) => <span key={i} className="bg-black text-white px-2 py-1 font-black text-xs border-2 border-gray-600 pixel-font leading-none">{zh ? (GENRE_ZH[tg] || tg) : tg}</span>)}</div>
                : null)
              : genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {genres.map((g, i) => (
                  <span key={i} className="bg-black text-white px-2 py-1 font-black text-xs border-2 border-[#ff00ff] pixel-font leading-none">{zh ? (GENRE_ZH[g] || g) : g}</span>
                ))}
              </div>
            )}

            {/* Cast */}
            {!isMusic && enriched.cast && enriched.cast.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {enriched.cast.slice(0, 5).map((actor, i) => (
                  <span key={i} className="bg-black text-white px-2 py-1 text-xs font-bold border border-gray-600 leading-none">🎭 {actor}</span>
                ))}
              </div>
            )}

            {/* AI tags */}
            {!isMusic && item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {item.tags.slice(0, 3).map((tg, i) => (
                  <span key={i} className="px-2 py-1 font-black text-xs border-2 border-black pixel-font leading-none" style={{ backgroundColor: "#ffff00", color: "#000" }}>
                    #{zh ? tg : (item.tagsEn?.[i] || tg)}
                  </span>
                ))}
              </div>
            )}

            {/* Music recommendation tag */}
            {isMusic && item.recommendationTag && (
              <div className="bg-black border-2 border-[#ffff00] p-3 mb-4">
                <span className="text-xs text-[#ffff00] font-black pixel-font">
                  {locale === "en" ? (item.recommendationTagEn || item.recommendationTag) : item.recommendationTag}
                </span>
              </div>
            )}

            {/* Release date line */}
            {!isMusic && item.releaseDate && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 font-bold">
                <span>{zh ? `上映日期：${item.releaseDate}` : `Release: ${item.releaseDate}`}</span>
              </div>
            )}
          </div>
        </div>

        {/* Summary — full width below poster+info. 无任何文案时明确写"暂无介绍"，不编造 */}
        <div className="bg-[#f0f0f0] border-4 border-black p-4 mb-4">
          <p className="text-black font-bold leading-relaxed text-sm sm:text-base">
            {summary || (zh ? "暂无介绍" : "No synopsis available")}
          </p>
        </div>

        {/* Action buttons — music: Spotify/Apple Music/NetEase (legacy AlbumCard set);
            film/TV: TMDB + IMDb + YouTube + Bilibili. Uniform lg sizing. */}
        <div className="flex flex-wrap items-center gap-2">
          {isMusic ? (
            <>
              <a href={`https://open.spotify.com/search/${encodeURIComponent(((item.artist || "") + " " + title).trim())}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 bg-white border-4 border-black hover:bg-gray-100 transition-colors flex-shrink-0 shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none"
                title="Open in Spotify">
                <Icons.Spotify className="w-full h-full" />
              </a>
              <a href={`https://music.apple.com/us/search?term=${encodeURIComponent(((item.artist || "") + " " + title).trim())}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 bg-white border-4 border-black hover:bg-gray-100 transition-colors flex-shrink-0 overflow-hidden shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none"
                title="Open in Apple Music">
                <Icons.AppleMusic className="w-full h-full" />
              </a>
              <a href={`https://music.163.com/#/search/m/?s=${encodeURIComponent(((item.artist || "") + " " + title).trim())}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 bg-[#C20C0C] border-4 border-black hover:bg-[#a00a0a] transition-colors flex-shrink-0 overflow-hidden shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none"
                title="Open in NetEase Cloud Music">
                <Icons.NeteaseCloudMusic className="w-full h-full" />
              </a>
            </>
          ) : (
            <>
              {item.tmdbId && (
                <a href={tmdbUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-[#00dd00] hover:bg-[#00ff00] text-black border-4 border-black text-xs font-black uppercase transition-colors shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none pixel-font self-center">
                  {zh ? "在 TMDB 查看完整资料 ↗" : "View on TMDB ↗"}
                </a>
              )}
              <a href={imdbUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 bg-[#F5C518] border-4 border-black hover:bg-[#dbaa00] transition-colors flex-shrink-0 overflow-hidden shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none"
                title="Open in IMDb">
                <Icons.Imdb className="w-full h-full" />
              </a>
              <TrailerButtons item={{ ...item, type: typeLabel }} locale={locale} size="lg" forceType={isTV ? "tv" : "movie"} />
            </>
          )}
        </div>
      </div>

      {/* Back button — 返回情报 kept per Rex */}
      <div className="flex justify-center gap-4 pt-6 pb-8 pb-safe">
        <button onClick={onClose}
          className="flex items-center text-white bg-black border-4 border-[#00ffff] px-6 py-3 uppercase font-bold hover:bg-[#00ffff] hover:text-black transition-colors pixel-font text-sm shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none">
          {locale === "en" ? "← Back" : "← 返回情报"}
        </button>
      </div>
    </div>
  );
}

// Helper function from IntelCards
function getTitle(item, locale) {
  return locale === "en" ? (item.titleEn || item.title) : (item.title || item.titleEn || "");
}

// For music items: get best available genre tags (AI -> Last.fm -> MB)
export function albumGenres(item) {
  if (item.tags?.length) return item.tags;
  if (item.lfmTags?.length) return item.lfmTags.slice(0, 5);
  if (item.genre) return [item.genre];
  return [];
}
export function albumGenresEn(item) {
  if (item.tagsEn?.length) return item.tagsEn;
  if (item.lfmTags?.length) return item.lfmTags.slice(0, 5);
  return [];
}

function AIScoreBadge() {
  return null;
}