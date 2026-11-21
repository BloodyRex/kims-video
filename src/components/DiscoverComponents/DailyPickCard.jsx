import React from "react";
import { Icons } from "../Icons";
import { RatingBadge, FavoriteButton, makeEntry } from "../Cards";
import { posterUrl } from "../../utils/poster";

const PICK_CATS = {
  editors: { zh: "★ 编辑精选", en: "★ EDITOR", bg: "#ff00ff", text: "#000" },
  gem: { zh: "💎 隐藏宝藏", en: "💎 GEM", bg: "#00ffff", text: "#000" },
  trending: { zh: "🔥 热榜趋势", en: "🔥 TRENDING", bg: "#ffff00", text: "#000" },
};

export function DailyPickCard({ pick, locale, onOpen }) {
  const zh = locale === "zh";
  const cat = PICK_CATS[pick.pickCategory] || PICK_CATS.editors;
  const title = zh ? pick.title : (pick.titleEn || pick.title);

  return (
    <div onClick={() => onOpen(pick)}
      className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#ff00ff] transition-all group cursor-pointer">
      <div className="relative overflow-hidden border-b-2 border-black">
        {pick.poster ? (
          <img src={posterUrl(pick.poster)} alt={title} className="w-full aspect-[2/3] object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center text-gray-500"><Icons.Film className="w-8 h-8" /></div>
        )}
        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-black border-2 border-black leading-none"
          style={{ backgroundColor: cat.bg, color: cat.text }}>
          {zh ? cat.zh : cat.en}
        </span>
        <RatingBadge score={pick.rating} />
        <div className="absolute bottom-1.5 left-1.5 z-20">
          <FavoriteButton entry={makeEntry(pick, pick.mediaType || "movie")} size="w-4 h-4" />
        </div>
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