import React, { useState, useEffect } from "react";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";
import { StarRating, RatingBadge, TrailerButtons, FavoriteButton, makeEntry, GENRE_ZH } from "./IntelCards";
import { posterUrl } from "../utils/poster";

// ── CountdownCard (Coming Soon) ──

export function CountdownCard({ item, locale, onViewDetail }) {
  const zh = locale === "zh";
  const title = zh ? item.title : (item.titleEn || item.title);
  const mediaType = item.mediaType || "movie";
  const isMusicCard = mediaType === "album" || mediaType === "single";
  const musicTags = isMusicCard ? albumGenres(item) : [];
  const musicTagsEn = isMusicCard ? albumGenresEn(item) : [];
  const typeLabel = mediaType === "tv"
    ? (zh ? "剧集" : "TV")
    : mediaType === "album"
      ? (zh ? "专辑" : "ALBUM")
      : mediaType === "single"
        ? (zh ? "单曲" : "SINGLE")
        : (zh ? "电影" : "MOVIE");
  const typeColor = mediaType === "tv" ? "#00ffff"
    : mediaType === "album" || mediaType === "single" ? "#ffff00"
    : "#ff00ff";
  const days = (typeof item.daysUntil === "number" && !isNaN(item.daysUntil)) ? item.daysUntil : null;
  const countdownLabel = days === null
    ? (item.releaseDate || "")
    : days === 0
    ? (zh ? "今天" : "TODAY")
    : days === 1
    ? (zh ? "明天" : "1D")
    : zh ? `${days} 天后` : `${days} DAYS`;

  return (
    <CardShell className="relative overflow-hidden">
      <div className="absolute top-0 right-0 bg-[#ff00ff] text-black px-3 py-1 border-l-4 border-b-4 border-black z-10">
        <span className="text-[10px] font-black pixel-font">{countdownLabel}</span>
      </div>

      <div className="bg-black text-white px-3 py-2 flex items-center gap-2 text-xs">
        <span className="font-black pixel-font uppercase text-[9px]" style={{ color: typeColor }}>
          {typeLabel}
        </span>
        <span className="text-gray-400 text-[9px]">{item.releaseDate || ""}</span>
      </div>

      <div className="flex gap-3 max-sm:gap-2 p-3 max-sm:p-2">
        {item.poster ? (
          <img src={posterUrl(item.poster)} alt={title} className="w-20 max-sm:w-16 h-28 max-sm:h-24 object-cover border-2 border-black flex-shrink-0" loading="lazy" />
        ) : (
          <div className="w-20 max-sm:w-16 h-28 max-sm:h-24 bg-gray-800 border-2 border-black flex items-center justify-center text-[10px] text-gray-500 font-bold flex-shrink-0">
            <Icons.Calendar />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="text-sm font-black leading-tight mb-0.5 truncate">{title}</h3>
          {item.titleEn && item.titleEn !== (zh ? item.title : item.titleEn || item.title) && !isMusicCard && (
            <p className="text-xs text-gray-600 font-bold mb-1 truncate">{item.titleEn}</p>
          )}
          <div className="flex items-center gap-2 mb-1">
            <AIScoreBadge score={item.aiScore} confidence={item.confidence} />
            {item.anticipation && (
              <span className="text-[9px] text-[#ff00ff] font-bold">
                {zh ? "热门期待" : "HOT"}
              </span>
            )}
          </div>
          {item.summary && (
            <p className="text-[10px] max-sm:text-[9px] text-gray-500 leading-relaxed line-clamp-2 mb-1">
              {zh ? item.summary : (item.summaryEn || item.summary)}
            </p>
          )}
          {musicTags.length > 0
            ? <div className="flex flex-wrap gap-1">{musicTags.map((t, i) => <span key={i} className="text-[8px] px-1 bg-black text-white font-bold">{zh ? (GENRE_ZH[t] || t) : (musicTagsEn[i] || t)}</span>)}</div>
            : isMusicCard ? null : <Tags tags={item.tags} tagsEn={item.tagsEn} locale={locale} />}
          <div className="flex items-center gap-2 mt-1">
            {onViewDetail && (
              <button onClick={() => onViewDetail(item)}
                className="flex items-center justify-center w-6 h-6 bg-black border-2 border-black hover:bg-gray-800 transition-colors flex-shrink-0"
                title={zh ? "详情" : "Details"}>
                <Icons.Info className="w-3.5 h-3.5 text-white" />
              </button>
            )}
            {!isMusicCard && (item.titleEn || item.title) && (
              <a
                href={`https://www.imdb.com/find?q=${encodeURIComponent(((item.titleEn || item.title) + " " + (item.year || "")).trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-6 h-6 bg-[#F5C518] border-2 border-black hover:bg-[#dbaa00] transition-colors flex-shrink-0 overflow-hidden"
                title="Open in IMDb">
                <Icons.Imdb className="w-full h-full" />
              </a>
            )}
            <FavoriteButton entry={makeEntry(item, item.mediaType || "movie")} size="w-5 h-5" />
            <TrailerButtons item={item} locale={locale} />
          </div>
        </div>
      </div>
    </CardShell>
  );
}

// ── RankingCard (Trending) ──

export function RankingCard({ item, rank, locale, onViewDetail }) {
  const zh = locale === "zh";
  const title = zh ? item.title : (item.titleEn || item.title);
  const rankColors = ["#e8a000", "#c0c0c0", "#cd7f32"];
  const rankColor = rank <= 3 ? rankColors[rank - 1] : "#888";

  return (
    <CardShell className="flex items-stretch">
      <div className="flex items-center justify-center w-12 sm:w-14 flex-shrink-0 border-r-4 border-black" style={{ backgroundColor: rank <= 3 ? "#000" : "#333" }}>
        <span className="text-xl sm:text-2xl font-black pixel-font" style={{ color: rankColor }}>
          {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : `#${rank}`}
        </span>
      </div>

      <div className="flex-1 flex gap-3 p-3">
        {item.poster ? (
          <img src={posterUrl(item.poster)} alt={title} className="w-12 h-18 object-cover border-2 border-black flex-shrink-0" loading="lazy" />
        ) : item.cover ? (
          <img src={posterUrl(item.cover)} alt={title} className="w-12 h-12 object-cover border-2 border-black flex-shrink-0" loading="lazy" />
        ) : (
          <div className="w-12 h-18 bg-gray-800 border-2 border-black flex items-center justify-center text-[8px] text-gray-500 font-bold flex-shrink-0">—</div>
        )}

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h3 className="text-sm font-black leading-tight truncate">{title}</h3>
          {item.artist && <p className="text-[10px] text-gray-500 truncate">{item.artist}</p>}
          <div className="flex items-center gap-2 mt-0.5">
            <StarRating score={item.rating} max={10} />
            {item.trend && (
              <span className={`text-[9px] font-bold ${item.trend === "up" ? "text-green-500" : item.trend === "down" ? "text-red-500" : "text-[#00ffff]"}`}>
                {item.trend === "up" ? "↑" : item.trend === "down" ? "↓" : "●"}
              </span>
            )}
            {item.playCount > 0 && (
              <span className="text-[8px] text-gray-400 font-bold">
                {zh ? `播放 ${formatNumber(item.playCount)}` : `${formatNumber(item.playCount)} plays`}
              </span>
            )}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

// ── WeeklyCard (Weekly Report) ──

export function WeeklyCard({ report, locale, onViewDetail }) {
  const zh = locale === "zh";

  return (
    <CardShell>
      <div className="bg-black text-white px-3 py-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-black pixel-font text-black uppercase text-[9px]">
          {report.weekLabel || report.week || (zh ? "每周报告" : "WEEKLY")}
        </span>
        <span className="text-gray-400 text-[9px]">{report.date || ""}</span>
      </div>

      <div className="p-3">
        <h3 className="text-sm font-black mb-1">
          {zh ? (report.titleEn || report.title) : report.title}
        </h3>
        {report.highlights && report.highlights.length > 0 && (
          <ul className="list-disc list-inside text-[10px] text-gray-500 mb-2 space-y-0.5">
            {report.highlights.slice(0, 3).map((h, i) => (
              <li key={i}>{zh ? (h.en || h.text) : h.text || h}</li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-gray-400">
            {report.count ? (zh ? `${report.count} 条动态` : `${report.count} releases`) : ""}
          </span>
          <button
            onClick={() => onViewDetail?.(report)}
            className="px-3 py-1 text-[9px] font-black text-white bg-black border-2 border-black pixel-font uppercase hover:bg-gray-800 transition-colors"
          >
            {zh ? "阅读" : "READ"}
          </button>
        </div>
      </div>
    </CardShell>
  );
}

// ── SpotlightCard (AI Spotlight / Editor picks) ──

export function SpotlightCard({ pick, locale, onViewDetail }) {
  const zh = locale === "zh";
  const title = zh ? pick.title : (pick.titleEn || pick.title);
  const categoryColors = {
    editorsPick: "#ff00ff",
    hiddenGem: "#00ffff",
    mostAnticipated: "#ffff00",
    familyChoice: "#ff8800",
    sciFi: "#00ff88",
    horror: "#ff0044",
    documentary: "#8888ff",
  };
  const categoryLabels = {
    editorsPick: { zh: "编辑精选", en: "Editor's Pick" },
    hiddenGem: { zh: "隐藏宝藏", en: "Hidden Gem" },
    mostAnticipated: { zh: "最受期待", en: "Most Anticipated" },
    familyChoice: { zh: "家庭之选", en: "Family Choice" },
    sciFi: { zh: "科幻之选", en: "Sci-Fi Pick" },
    horror: { zh: "恐怖之选", en: "Horror Pick" },
    documentary: { zh: "纪录之选", en: "Documentary Pick" },
  };
  const cat = categoryLabels[pick.category] || categoryLabels.editorsPick;
  const catColor = categoryColors[pick.category] || "#ff00ff";

  return (
    <CardShell>
      <div className="px-3 py-2 flex items-center gap-2 text-xs" style={{ backgroundColor: catColor }}>
        <Icons.Star className="w-4 h-4 text-black" />
        <span className="font-black pixel-font text-black uppercase text-[9px]">
          {zh ? cat.zh : cat.en}
        </span>
      </div>

      <div className="flex gap-3 max-sm:gap-2 p-3 max-sm:p-2">
        {pick.poster ? (
          <img src={posterUrl(pick.poster)} alt={title} className="w-20 max-sm:w-16 h-28 max-sm:h-24 object-cover border-2 border-black flex-shrink-0" loading="lazy" />
        ) : pick.cover ? (
          <img src={posterUrl(pick.cover)} alt={title} className="w-20 max-sm:w-16 h-20 max-sm:h-16 object-cover border-2 border-black flex-shrink-0" loading="lazy" />
        ) : (
          <div className="w-20 max-sm:w-16 h-28 max-sm:h-24 bg-gray-800 border-2 border-black flex items-center justify-center text-[10px] text-gray-500 font-bold flex-shrink-0">
            <Icons.Target />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="text-sm font-black leading-tight mb-0.5">{title}</h3>
          {pick.titleEn && pick.titleEn !== (zh ? pick.title : pick.titleEn || pick.title) && !pick.artist && (
            <p className="text-xs text-gray-600 font-bold mb-1 truncate">{pick.titleEn}</p>
          )}
          {pick.artist && <p className="text-xs text-gray-600 font-bold mb-1">{pick.artist}</p>}
          <div className="flex items-center gap-2 mb-1">
            <StarRating score={pick.rating} max={10} />
            <AIScoreBadge score={pick.aiScore} confidence={pick.confidence} />
          </div>
          {pick.whyWatch && (
            <p className="text-[10px] max-sm:text-[9px] text-gray-500 leading-relaxed line-clamp-2 mb-1">
              {zh ? pick.whyWatch : (pick.whyWatchEn || pick.whyWatch)}
            </p>
          )}
          {pick.summary && (
            <p className="text-[9px] text-gray-400 leading-relaxed line-clamp-1">
              {zh ? pick.summary : (pick.summaryEn || pick.summary)}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {onViewDetail && (
              <button onClick={() => onViewDetail(pick)}
                className="flex items-center justify-center w-6 h-6 bg-black border-2 border-black hover:bg-gray-800 transition-colors flex-shrink-0"
                title={zh ? "详情" : "Details"}>
                <Icons.Info className="w-3.5 h-3.5 text-white" />
              </button>
            )}
            {!pick.artist && (pick.titleEn || pick.title) && (
              <a
                href={`https://www.imdb.com/find?q=${encodeURIComponent(((pick.titleEn || pick.title) + " " + (pick.year || "")).trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-6 h-6 bg-[#F5C518] border-2 border-black hover:bg-[#dbaa00] transition-colors flex-shrink-0 overflow-hidden"
                title="Open in IMDb">
                <Icons.Imdb className="w-full h-full" />
              </a>
            )}
            <FavoriteButton entry={makeEntry(pick, pick.mbid || pick.artist ? "album" : "movie")} size="w-5 h-5" />
            <TrailerButtons item={pick} locale={locale} />
          </div>
        </div>
      </div>
    </CardShell>
  );
}

// ── Unified wall-style card (2026-08-24): one card shape for movies, TV and
// albums across the Intelligence page. Same geometry as the Movie Wall card:
// aspect-[2/3] poster area (album covers are square → object-contain on black),
// rating badge bottom-right, title + date + genre bar below. No inline action
// buttons — the whole card opens the detail view.
export function WallStyleCard({ item, locale, badge, badgeColor = "#ffff00", subBadge, subBadgeColor = "#000000", ribbon, ribbonColor = "#ff00ff", metaLine, onClick }) {
  const zh = locale === "zh";
  const title = zh ? item.title : (item.titleEn || item.title);
  const isMusic = !!(item.mbid || item.artist);
  const rating = item.rating || 0;
  const genres = Array.isArray(item.genre) ? item.genre : [];

  return (
    <div onClick={() => onClick && onClick(item)}
      className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#ff00ff] transition-all group cursor-pointer">
      <div className="relative overflow-hidden border-b-2 border-black bg-black">
        {item.poster ? (
          <img src={posterUrl(item.poster)} alt={title} className="w-full aspect-[2/3] object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : item.cover ? (
          <img src={posterUrl(item.cover)} alt={title} className="w-full h-full aspect-[2/3] object-contain group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center text-gray-500">
            <Icons.Film className="w-8 h-8" />
          </div>
        )}
        {(badge || subBadge) && (
          <div className="absolute top-1.5 left-1.5 flex gap-1">
            {badge && (
              <span className="px-1.5 py-0.5 text-[9px] font-black border-2 border-black leading-none"
                style={{ backgroundColor: badgeColor, color: "#000" }}>
                {badge}
              </span>
            )}
            {subBadge && (
              <span className="px-1.5 py-0.5 text-[9px] font-black border-2 border-black leading-none"
                style={{ backgroundColor: "#000000", color: subBadgeColor }}>
                {subBadge}
              </span>
            )}
          </div>
        )}
        {/* Countdown ribbon — Rex 2026-08-25: unified to the wall card's status-badge
            design (8px, tight padding), positioned top-RIGHT per feedback. */}
        {ribbon && (
          <span className="absolute top-1.5 right-1.5 px-1 py-0.5 text-[8px] font-black border border-black leading-none z-10"
            style={{ backgroundColor: ribbonColor }}>
            {ribbon}
          </span>
        )}
        <RatingBadge score={rating} />
        {/* Favorite — bottom-LEFT of the poster so it never covers the rating
            badge (bottom-right). Rex 2026-10-28: unified across every card. */}
        <div className="absolute bottom-1.5 left-1.5 z-20">
          <FavoriteButton entry={makeEntry(item, (item.mbid || item.artist) ? "album" : "movie")} size="w-4 h-4" />
        </div>
      </div>
      <div className="p-2 max-sm:p-1.5">
        <h3 className="text-xs font-black truncate leading-tight" title={title}>{title}</h3>
        {isMusic && item.artist && (
          <p className="text-[9px] text-gray-500 font-bold truncate">{item.artist}</p>
        )}
        {/* Type-specific info line: TV premiere date / music release info */}
        {metaLine && (
          <p className="text-[9px] text-gray-600 font-bold truncate" title={typeof metaLine === "string" ? metaLine : undefined}>{metaLine}</p>
        )}
        <div className="flex items-center justify-between mt-1 gap-1">
          <span className="text-[9px] text-gray-600 font-bold truncate">{item.releaseDate || item.year || ""}</span>
          {(genres.length > 0 || (isMusic && Array.isArray(item.tags) && item.tags.length > 0)) && (
            <span className="text-[8px] px-1 bg-black text-white font-bold flex-shrink-0">
              {zh
                ? (genres[0] ? (GENRE_ZH[genres[0]] || genres[0]) : (item.tags?.[0] || ""))
                : (genres[0] || item.tagsEn?.[0] || item.tags?.[0] || "")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function formatNumber(n) {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
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

// For music items: get best available genre tags (AI -> Last.fm -> MB)
// This is a duplicate for backward compatibility, will be removed after migration
export function albumGenres_duplicate(item) {
  return albumGenres(item);
}
export function albumGenresEn_duplicate(item) {
  return albumGenresEn(item);
}

// Rating color tiers
export function ratingColor(score) {
  if (score >= 9) return "#ffd700";
  if (score >= 8) return "#00cfff";
  if (score >= 6) return "#00ff87";
  return "#ff4d4d";
}

function AIScoreBadge() {
  return null;
}
// ── Section Header ──

export function SectionHeader({ label, count, color = "#ff00ff", className = "" }) {
  return (
    <h2
      className={`text-lg sm:text-xl font-black mb-4 pixel-font inline-block px-4 py-1.5 border-4 border-black intel-title max-sm:text-xs ${className}`}
      style={{ color: "#fff", backgroundColor: color, boxShadow: "6px 6px 0 0 #000", textShadow: "2px 2px 0 rgba(0,0,0,0.3)" }}
    >
      {label}
      {count !== undefined && <span className="ml-2 text-sm opacity-75">({count})</span>}
    </h2>
  );
}

// ── Grid / List wrappers ──

export function CardGrid({ children, cols = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" }) {
  return <div className={`grid ${cols} gap-4`}>{children}</div>;
}

export function CardList({ children }) {
  return <div className="space-y-3">{children}</div>;
}
