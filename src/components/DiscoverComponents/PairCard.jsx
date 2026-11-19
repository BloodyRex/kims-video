import React, { useState } from "react";
import { Icons } from "../Icons";
import { RatingBadge, StarRating, FavoriteButton, makeEntry } from "../Cards";
import { posterUrl } from "../../utils/poster";

export function PairCard({ pair, posterMap, metaMap, locale, onOpen }) {
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
        <RatingBadge score={meta.rating} />
        <div className="absolute bottom-1.5 left-1.5 z-20">
          <FavoriteButton entry={makeEntry(pair.recommend, "movie")} size="w-4 h-4" />
        </div>
      </div>
      <div className="p-2 max-sm:p-1.5">
        <h3 className="text-xs font-black truncate leading-tight" title={recTitle}>{recTitle}</h3>
        <div className="flex items-center justify-between mt-1 gap-1">
          <span className="text-[9px] text-gray-600 font-bold truncate">{meta.releaseDate || pair.recommend.year || ""}</span>
          {genres.length > 0 && (
            <span className="text-[8px] px-1 bg-black text-white font-bold flex-shrink-0">{genreLabel(genres[0], locale)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function genreLabel(g, locale) {
  return locale === "zh" ? g : g; // Will use actual GENRE_ZH from Cards
}