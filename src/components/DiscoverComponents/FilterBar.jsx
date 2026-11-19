import React from "react";
import { GENRE_ZH } from "../Cards";

export function FilterBar({ 
  locale, 
  sourceMode, 
  setSourceMode, 
  genreFilter, 
  setGenreFilter, 
  searchQuery, 
  setSearchQuery, 
  itemCount,
  buildPages,
  totalPages,
  safePage,
  setPage
}) {
  const zh = locale === "zh";
  const COMMON_GENRES = ["Action", "Sci-Fi", "Comedy", "Romance", "Horror", "Drama", "Animation", "Thriller", "Documentary"];
  const normGenre = (g) => g; // GENRE_ZH is in Cards
  const COMMON_ZH = COMMON_GENRES.map(normGenre);
  const genreLabel = (g, locale) => locale === "zh" ? g : g; // Will use actual GENRE_ZH from Cards

  const genreBtn = (id, label, color) => (
    <button key={id} onClick={() => setGenreFilter(id)}
      className={`px-2.5 py-1 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all ${
        genreFilter === id ? `bg-${color} text-white` : "bg-white text-black hover:bg-gray-100"
      }`}>
      {label}
    </button>
  );

  return (
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
        {/* Community comet toggle */}
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
        {/* Genre buttons will be rendered by parent with proper GENRE_ZH */}
      </div>
    </div>
  );
}