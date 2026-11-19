import React from "react";
import { Icons } from "../Icons";
import { StarRating, TrailerButtons } from "../Cards";
import { useOverlayLock } from "../../hooks/useOverlayLock";

export function PairDetailOverlay({ pair, posterMap, metaMap, locale, onClose }) {
  const recPoster = posterMap[pair.recommend.tmdbId];
  const meta = metaMap[pair.recommend.tmdbId] || {};
  const zh = locale === "zh";
  const recTitle = zh ? pair.recommend.title : (pair.recommend.titleEn || pair.recommend.title);
  const srcTitle = zh ? pair.source.title : (pair.source.titleEn || pair.source.title);
  const genres = meta.genres || [];
  useOverlayLock(onClose);
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

export function genreLabel(g, locale) {
  return locale === "zh" ? g : g; // Will use actual GENRE_ZH from Cards
}