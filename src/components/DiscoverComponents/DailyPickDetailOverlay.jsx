import React from "react";
import { Icons } from "../Icons";
import { StarRating, TrailerButtons } from "../Cards";
import { posterUrl } from "../../utils/poster";
import { useOverlayLock } from "../../hooks/useOverlayLock";

export function DailyPickDetailOverlay({ pick, locale, onClose }) {
  const zh = locale === "zh";
  const title = zh ? pick.title : (pick.titleEn || pick.title);
  useOverlayLock(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative w-full max-w-md bg-white border-4 border-black shadow-[8px_8px_0_0_rgba(0,255,255,1)]" onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 bg-[#ff00ff] border-2 border-black text-white font-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors z-10">×</button>
        <div className="flex gap-3 p-4 max-sm:p-3">
          {pick.poster ? (
            <img src={posterUrl(pick.poster)} alt={title} className="w-24 h-36 object-cover border-2 border-black flex-shrink-0" />
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