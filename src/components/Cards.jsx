import React, { useState, useEffect } from "react";
import { Icons } from "./Icons";
import { fetchMovieByTmdbId } from "../services/api";

// ── Image proxy helper ──
function posterUrl(path) {
  if (!path) return "";
  if (path.startsWith("https://image.tmdb.org/") || path.startsWith("https://coverartarchive.org/")) {
    return "https://api.bloodyrex.xyz/poster-proxy?url=" + encodeURIComponent(path);
  }
  return path;
}
// ── Shared helpers ──

export const GENRE_ZH = {
  "Action": "动作", "Adventure": "冒险", "Animation": "动画", "Comedy": "喜剧",
  "Crime": "犯罪", "Documentary": "纪录", "Drama": "剧情", "Family": "家庭",
  "Fantasy": "奇幻", "History": "历史", "Horror": "恐怖", "Music": "音乐",
  "Mystery": "悬疑", "Romance": "爱情", "Sci-Fi": "科幻", "TV Movie": "电视电影",
  "Thriller": "惊悚", "War": "战争", "Western": "西部",
  "Album": "专辑", "Single": "单曲", "EP": "EP", "Soundtrack": "原声",
  "Live": "现场", "Compilation": "合辑", "Remix": "混音",
};

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

function label(locale, zh, en) {
  return locale === "zh" ? zh : en;
}

function getTitle(item, locale) {
  return locale === "en" ? (item.titleEn || item.title) : (item.title || item.titleEn || "");
}

export function StarRating({ score, max = 10 }) {
  const pct = Math.min(Math.max((score || 0) / max, 0), 1);
  const stars = Math.round(pct * 5);
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`text-[10px] ${i <= stars ? "text-[#ff8800]" : "text-gray-400"}`}>
          ★
        </span>
      ))}
      <span className="text-[10px] text-gray-500 ml-1">{score?.toFixed(1) || "—"}</span>
    </span>
  );
}

function AIScoreBadge() {
  return null;
}

function Tags({ tags, tagsEn, color = "#ff00ff", locale = "zh" }) {
  const t = (!tags || !tags.length) ? [] : tags;
  const te = (!tagsEn || !tagsEn.length) ? [] : tagsEn;
  const display = locale === "en" && te.length ? te : t;
  if (!display.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {display.map((tag, i) => (
        <span key={i} className="text-[8px] px-1.5 py-0.5 border font-black" style={{ color, borderColor: color }}>
          {locale === "zh" ? (GENRE_ZH[tag] || tag) : tag}
        </span>
      ))}
    </div>
  );
}

// ── Trailer button component ──
export function TrailerButtons({ item, locale, size = "sm", forceType }) {
  const title = (item.titleEn || item.title || "");
  const tmdbId = item.tmdbId;
  const biliHref = `https://search.bilibili.com/all?keyword=${encodeURIComponent((title + " 预告片").trim())}`;
  const [ytKey, setYtKey] = React.useState(null);
  React.useEffect(() => {
    if (!tmdbId) return;
    const mtype = forceType || (item.type === "剧集" || item.type === "TV Series" || item.type === "tv" ? "tv" : "movie");
    fetch(`https://api.bloodyrex.xyz/intelligence/trailer?tmdbId=${tmdbId}&type=${mtype}`)
      .then(r => r.json())
      .then(d => { if (d.key) setYtKey(d.key); })
      .catch(() => {});
  }, [tmdbId]);
  const ytHref = ytKey
    ? `https://www.youtube.com/watch?v=${ytKey}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent((title + " trailer").trim())}`;
  // lg = large square with hard shadow, matching the TMDB text button (w-10 h-10 ≈ 40px)
  const lg = size === "lg";
  const baseCls = lg
    ? "flex items-center justify-center w-10 h-10 border-4 border-black transition-colors flex-shrink-0 shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none"
    : "flex items-center justify-center w-6 h-6 border-2 border-black transition-colors flex-shrink-0";
  return (
    <>
      <a href={ytHref} target="_blank" rel="noopener noreferrer"
        className={`${baseCls} bg-[#ff0000] hover:bg-[#cc0000]`}
        title={ytKey ? "观看YouTube预告片" : "在YouTube搜索预告片"}>
        <Icons.Youtube className={lg ? "w-6 h-6" : undefined} />
      </a>
      <a href={biliHref} target="_blank" rel="noopener noreferrer"
        className={`${baseCls} bg-white hover:bg-gray-100 overflow-hidden`}
        title="在Bilibili搜索预告片">
        <Icons.Bilibili className="w-full h-full" />
      </a>
    </>
  );
}

function CardShell({ children, className = "" }) {
  return (
    <div className={`bg-white border-4 border-black overflow-hidden shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 ${className}`}>
      {children}
    </div>
  );
}

// ── MovieCard ──

export function MovieCard({ movie, locale, onViewDetail }) {
  const title = getTitle(movie, locale);
  const genres = Array.isArray(movie.genre) ? movie.genre : (movie.genre ? [movie.genre] : []);

  return (
    <CardShell>
      <div className="bg-black text-white px-3 py-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-black pixel-font text-[#ff00ff] uppercase text-[9px]">
          {locale === "en" ? "MOVIE" : "电影"}
        </span>
        <span className="text-gray-400 text-[9px]">{movie.releaseDate || movie.year || ""}</span>
      </div>

      <div className="flex gap-3 max-sm:gap-2 p-3 max-sm:p-2">
        {movie.poster ? (
          <img src={posterUrl(movie.poster)} alt={title} className="w-20 max-sm:w-16 h-28 max-sm:h-24 object-cover border-2 border-black flex-shrink-0" loading="lazy" />
        ) : (
          <div className="w-20 h-28 bg-gray-800 border-2 border-black flex items-center justify-center text-[10px] text-gray-500 font-bold flex-shrink-0">
            <Icons.Film />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="text-sm font-black leading-tight mb-0.5 truncate">{title}</h3>
          {movie.titleEn && movie.titleEn !== (locale === "en" ? (movie.titleEn || movie.title) : movie.title) && (
            <p className="text-xs text-gray-600 font-bold mb-1 truncate">{movie.titleEn}</p>
          )}
          <div className="flex items-center gap-2 mb-1">
            <StarRating score={movie.rating} max={10} />
            <AIScoreBadge score={movie.aiScore} confidence={movie.confidence} />
          </div>
          {genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {genres.map((g, i) => (
                <span key={i} className="text-[8px] px-1 bg-black text-white font-bold">{locale === "zh" ? (GENRE_ZH[g] || g) : g}</span>
              ))}
            </div>
          )}
          {movie.summary && (
            <p className="text-[10px] max-sm:text-[9px] text-gray-500 leading-relaxed line-clamp-2 mb-1">
              {locale === "en" ? (movie.summaryEn || movie.summary) : (movie.summary || movie.summaryEn)}
            </p>
          )}
          {movie.reason && (
            <p className="text-[9px] text-[#ff00ff] font-bold leading-relaxed line-clamp-1">
              {locale === "en" ? (movie.reasonEn || movie.reason) : movie.reason}
            </p>
          )}
          <Tags tags={movie.tags} tagsEn={movie.tagsEn} locale={locale} />
          {movie.audience && (
            <p className="text-[8px] text-gray-400 mt-auto pt-1">
              {locale === "en" ? "For: " : "适合: "}
              {locale === "en" ? (movie.audienceEn || movie.audience) : movie.audience}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {onViewDetail && (
              <button onClick={() => onViewDetail(movie)}
                className="flex items-center justify-center w-6 h-6 bg-black border-2 border-black hover:bg-gray-800 transition-colors flex-shrink-0"
                title={locale === "en" ? "Details" : "详情"}>
                <Icons.Info className="w-3.5 h-3.5 text-white" />
              </button>
            )}
            <a
              href={`https://www.imdb.com/find?q=${encodeURIComponent(((movie.titleEn || movie.title) + " " + (movie.year || "")).trim())}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-6 h-6 bg-[#F5C518] border-2 border-black hover:bg-[#dbaa00] transition-colors flex-shrink-0 overflow-hidden"
              title="Open in IMDb"
            >
              <Icons.Imdb className="w-full h-full" />
            </a>
            <TrailerButtons item={movie} locale={locale} />
          </div>
        </div>
      </div>
    </CardShell>
  );
}

// ── TVCard ──

export function TVCard({ show, locale, onViewDetail }) {
  const title = getTitle(show, locale);
  const genres = Array.isArray(show.genre) ? show.genre : (show.genre ? [show.genre] : []);

  return (
    <CardShell>
      <div className="bg-black text-white px-3 py-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-black pixel-font text-[#00ffff] uppercase text-[9px]">
          {locale === "en" ? "TV" : "剧集"}
        </span>
        <div className="flex items-center gap-2">
          {show.season && (
            <span className="text-[8px] text-gray-300">
              S{show.season}{show.episode ? `E${show.episode}` : ""}
            </span>
          )}
          <span className="text-gray-400 text-[9px]">{show.latestAirDate || show.releaseDate || show.year || ""}</span>
        </div>
      </div>

      <div className="flex gap-3 max-sm:gap-2 p-3 max-sm:p-2">
        {show.poster ? (
          <img src={posterUrl(show.poster)} alt={title} className="w-20 max-sm:w-16 h-28 max-sm:h-24 object-cover border-2 border-black flex-shrink-0" loading="lazy" />
        ) : (
          <div className="w-20 max-sm:w-16 h-28 max-sm:h-24 bg-gray-800 border-2 border-black flex items-center justify-center text-[10px] text-gray-500 font-bold flex-shrink-0">
            <Icons.Tv />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="text-sm font-black leading-tight mb-0.5 truncate">{title}</h3>
          {show.titleEn && show.titleEn !== (locale === "en" ? (show.titleEn || show.title) : show.title) && (
            <p className="text-xs text-gray-600 font-bold mb-1 truncate">{show.titleEn}</p>
          )}
          <div className="flex items-center gap-2 mb-1">
            <StarRating score={show.rating} max={10} />
            <AIScoreBadge score={show.aiScore} confidence={show.confidence} />
          </div>
          {genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {genres.map((g, i) => (
                <span key={i} className="text-[8px] px-1 bg-black text-white font-bold">{locale === "zh" ? (GENRE_ZH[g] || g) : g}</span>
              ))}
            </div>
          )}
          {show.releaseDate && (
            <p className="text-[9px] text-[#00ffff] font-bold mb-1">
              {locale === "en" ? "Premiered: " : "首播: "}{show.releaseDate}
            </p>
          )}
          {show.summary && (
            <p className="text-[10px] max-sm:text-[9px] text-gray-500 leading-relaxed line-clamp-2 mb-1">
              {locale === "en" ? (show.summaryEn || show.summary) : (show.summary || show.summaryEn)}
            </p>
          )}
          <Tags tags={show.tags} tagsEn={show.tagsEn} color="#00ffff" locale={locale} />
          {show.audience && (
            <p className="text-[8px] text-gray-400 mt-auto pt-1">
              {locale === "en" ? "For: " : "适合: "}
              {locale === "en" ? (show.audienceEn || show.audience) : show.audience}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {onViewDetail && (
              <button onClick={() => onViewDetail(show)}
                className="flex items-center justify-center w-6 h-6 bg-black border-2 border-black hover:bg-gray-800 transition-colors flex-shrink-0"
                title={locale === "en" ? "Details" : "详情"}>
                <Icons.Info className="w-3.5 h-3.5 text-white" />
              </button>
            )}
            <a
              href={`https://www.imdb.com/find?q=${encodeURIComponent(((show.titleEn || show.title) + " " + (show.year || "")).trim())}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-6 h-6 bg-[#F5C518] border-2 border-black hover:bg-[#dbaa00] transition-colors flex-shrink-0 overflow-hidden"
              title="Open in IMDb"
            >
              <Icons.Imdb className="w-full h-full" />
            </a>
            <TrailerButtons item={show} locale={locale} />
          </div>
        </div>
      </div>
    </CardShell>
  );
}

// ── AlbumCard ──

const TAG_STYLES = {
  trending: { bg: "bg-red-600", text: "text-white" },
  editor: { bg: "bg-blue-600", text: "text-white" },
  "hidden-gem": { bg: "bg-purple-600", text: "text-white" },
  world: { bg: "bg-teal-600", text: "text-white" },
};

function getTagStyle(tagId) {
  return TAG_STYLES[tagId] || { bg: "bg-gray-600", text: "text-white" };
}

export function AlbumCard({ album, locale, onViewDetail }) {
  const [coverError, setCoverError] = React.useState(false);
  const title = album.title || "";
  const artist = album.artist || "";
  const displayTags = albumGenres(album);
  const displayTagsEn = albumGenresEn(album);
  const tagId = album.recommendationTagId || "";
  const tagLabel = album.recommendationTag || "";
  const tagStyle = getTagStyle(tagId);
  const coverSrc = !coverError && (album.cover || (album.mbid ? `https://coverartarchive.org/release/${album.mbid}/front-250.jpg` : null));

  return (
    <CardShell>
      <div className="bg-black text-white px-3 py-2 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-black pixel-font text-[#ffff00] uppercase text-[9px] flex-shrink-0">
            {locale === "en" ? "ALBUM" : "专辑"}
          </span>
          {tagLabel && (
            <span className={`text-[8px] px-1.5 py-0.5 font-black ${tagStyle.bg} ${tagStyle.text} leading-none`}>
              {locale === "en" ? (album.recommendationTagEn || tagLabel) : tagLabel}
            </span>
          )}
        </div>
        <span className="text-gray-400 text-[9px] flex-shrink-0">{album.releaseDate || album.year || ""}</span>
      </div>

      <div className="flex gap-3 max-sm:gap-2 p-3 max-sm:p-2">
        {coverSrc ? (
          <img src={posterUrl(coverSrc)} alt={title} className="w-20 max-sm:w-16 h-20 max-sm:h-16 object-cover border-2 border-black flex-shrink-0" loading="lazy" onError={() => setCoverError(true)} />
        ) : (
          <div className="w-20 max-sm:w-16 h-20 max-sm:h-16 bg-gray-800 border-2 border-black flex items-center justify-center text-[10px] text-gray-500 font-bold flex-shrink-0">
            <Icons.Music />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="text-sm font-black leading-tight mb-0.5 truncate">{title}</h3>
          <p className="text-xs text-gray-600 font-bold mb-1 truncate">{artist}</p>

          {displayTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {displayTags.map((g, i) => (
                <span key={i} className="text-[8px] px-1 bg-black text-white font-bold">
                  {locale === "zh" ? (GENRE_ZH[g] || g) : (displayTagsEn[i] || g)}
                </span>
              ))}
            </div>
          )}

          {/* Recommendation text (primary) */}
          {(album.highlight || album.summary) && (
            <p className="text-[10px] max-sm:text-[9px] text-gray-500 leading-relaxed line-clamp-2 mb-1">
              {locale === "en" ? (album.highlightEn || album.summaryEn || album.highlight || album.summary) : (album.highlight || album.summary)}
            </p>
          )}

          <AIScoreBadge score={album.aiScore} confidence={album.confidence} />
          <div className="flex items-center gap-2 mt-1">
            {onViewDetail && (
              <button onClick={() => onViewDetail(album)}
                className="flex items-center justify-center w-6 h-6 bg-black border-2 border-black hover:bg-gray-800 transition-colors flex-shrink-0"
                title={locale === "en" ? "Details" : "详情"}>
                <Icons.Info className="w-3.5 h-3.5 text-white" />
              </button>
            )}
            <a
              href={`https://open.spotify.com/search/${encodeURIComponent((artist + " " + title).trim())}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-6 h-6 bg-white border-2 border-black hover:bg-gray-100 transition-colors flex-shrink-0"
              title="Open in Spotify"
            >
              <Icons.Spotify className="w-3.5 h-3.5" />
            </a>
            <a
              href={`https://music.apple.com/us/search?term=${encodeURIComponent((artist + " " + title).trim())}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-6 h-6 bg-white border-2 border-black hover:bg-gray-100 transition-colors flex-shrink-0 overflow-hidden"
              title="Open in Apple Music"
            >
              <Icons.AppleMusic className="w-full h-full" />
            </a>
            <a
              href={`https://music.163.com/#/search/m/?s=${encodeURIComponent((artist + " " + title).trim())}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-6 h-6 bg-[#C20C0C] border-2 border-black hover:bg-[#a00a0a] transition-colors flex-shrink-0 overflow-hidden"
              title="Open in NetEase Cloud Music"
            >
              <Icons.NeteaseCloudMusic className="w-full h-full" />
            </a>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

// ── CountdownCard (Coming Soon) ──

export function CountdownCard({ item, locale, onViewDetail }) {
  const title = getTitle(item, locale);
  const mediaType = item.mediaType || "movie";
  const isMusicCard = mediaType === "album" || mediaType === "single";
  const musicTags = isMusicCard ? albumGenres(item) : [];
  const musicTagsEn = isMusicCard ? albumGenresEn(item) : [];
  const typeLabel = mediaType === "tv"
    ? (locale === "en" ? "TV" : "剧集")
    : mediaType === "album"
      ? (locale === "en" ? "ALBUM" : "专辑")
      : mediaType === "single"
        ? (locale === "en" ? "SINGLE" : "单曲")
        : (locale === "en" ? "MOVIE" : "电影");
  const typeColor = mediaType === "tv" ? "#00ffff"
    : mediaType === "album" || mediaType === "single" ? "#ffff00"
    : "#ff00ff";
  const days = (typeof item.daysUntil === "number" && !isNaN(item.daysUntil)) ? item.daysUntil : null;
  const countdownLabel = days === null
    ? (item.releaseDate || "")
    : days === 0
    ? (locale === "en" ? "TODAY" : "今天")
    : days === 1
    ? (locale === "en" ? "TOMORROW" : "明天")
    : locale === "en" ? `${days} DAYS` : `${days} 天后`;
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
          {item.titleEn && item.titleEn !== (locale === "en" ? (item.titleEn || item.title) : item.title) && !isMusicCard && (
            <p className="text-xs text-gray-600 font-bold mb-1 truncate">{item.titleEn}</p>
          )}
          <div className="flex items-center gap-2 mb-1">
            <AIScoreBadge score={item.aiScore} confidence={item.confidence} />
            {item.anticipation && (
              <span className="text-[9px] text-[#ff00ff] font-bold">
                {locale === "en" ? "HOT" : "热门期待"}
              </span>
            )}
          </div>
          {item.summary && (
            <p className="text-[10px] max-sm:text-[9px] text-gray-500 leading-relaxed line-clamp-2 mb-1">
              {locale === "en" ? (item.summaryEn || item.summary) : item.summary}
            </p>
          )}
          {musicTags.length > 0
            ? <div className="flex flex-wrap gap-1">{musicTags.map((t, i) => <span key={i} className="text-[8px] px-1 bg-black text-white font-bold">{locale === "zh" ? (GENRE_ZH[t] || t) : (musicTagsEn[i] || t)}</span>)}</div>
            : isMusicCard ? null : <Tags tags={item.tags} tagsEn={item.tagsEn} locale={locale} />
          }
          <div className="flex items-center gap-2 mt-1">
            {onViewDetail && (
              <button onClick={() => onViewDetail(item)}
                className="flex items-center justify-center w-6 h-6 bg-black border-2 border-black hover:bg-gray-800 transition-colors flex-shrink-0"
                title={locale === "en" ? "Details" : "详情"}>
                <Icons.Info className="w-3.5 h-3.5 text-white" />
              </button>
            )}
            {!isMusicCard && (item.titleEn || item.title) && (
              <a
                href={`https://www.imdb.com/find?q=${encodeURIComponent(((item.titleEn || item.title) + " " + (item.year || "")).trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-6 h-6 bg-[#F5C518] border-2 border-black hover:bg-[#dbaa00] transition-colors flex-shrink-0 overflow-hidden"
                title="Open in IMDb"
              >
                <Icons.Imdb className="w-full h-full" />
              </a>
            )}
            <TrailerButtons item={item} locale={locale} />
          </div>
        </div>
      </div>
    </CardShell>
  );
}

function formatNumber(n) {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

// ── RankingCard (Trending) ──

export function RankingCard({ item, rank, locale, onViewDetail }) {
  const title = getTitle(item, locale);
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
                {locale === "zh" ? `播放 ${formatNumber(item.playCount)}` : `${formatNumber(item.playCount)} plays`}
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
  return (
    <CardShell>
      <div className="bg-black text-white px-3 py-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-black pixel-font text-black uppercase text-[9px]">
          {report.weekLabel || report.week || (locale === "en" ? "WEEKLY" : "每周报告")}
        </span>
        <span className="text-gray-400 text-[9px]">{report.date || ""}</span>
      </div>

      <div className="p-3">
        <h3 className="text-sm font-black mb-1">
          {locale === "en" ? (report.titleEn || report.title) : report.title}
        </h3>
        {report.highlights && report.highlights.length > 0 && (
          <ul className="list-disc list-inside text-[10px] text-gray-500 mb-2 space-y-0.5">
            {report.highlights.slice(0, 3).map((h, i) => (
              <li key={i}>{locale === "en" ? (h.en || h.text) : h.text || h}</li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-gray-400">
            {report.count ? (locale === "en" ? `${report.count} releases` : `${report.count} 条动态`) : ""}
          </span>
          <button
            onClick={() => onViewDetail?.(report)}
            className="px-3 py-1 text-[9px] font-black text-white bg-black border-2 border-black pixel-font uppercase hover:bg-gray-800 transition-colors"
          >
            {locale === "en" ? "READ" : "阅读"}
          </button>
        </div>
      </div>
    </CardShell>
  );
}

// ── SpotlightCard (AI Spotlight / Editor picks) ──

export function SpotlightCard({ pick, locale, onViewDetail }) {
  const title = getTitle(pick, locale);
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
          {locale === "en" ? cat.en : cat.zh}
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
          {pick.titleEn && pick.titleEn !== (locale === "en" ? (pick.titleEn || pick.title) : pick.title) && !pick.artist && (
            <p className="text-xs text-gray-600 font-bold mb-1 truncate">{pick.titleEn}</p>
          )}
          {pick.artist && <p className="text-xs text-gray-600 font-bold mb-1">{pick.artist}</p>}
          <div className="flex items-center gap-2 mb-1">
            <StarRating score={pick.rating} max={10} />
            <AIScoreBadge score={pick.aiScore} confidence={pick.confidence} />
          </div>
          {pick.whyWatch && (
            <p className="text-[10px] max-sm:text-[9px] text-gray-500 leading-relaxed line-clamp-2 mb-1">
              {locale === "en" ? (pick.whyWatchEn || pick.whyWatch) : pick.whyWatch}
            </p>
          )}
          {pick.summary && (
            <p className="text-[9px] text-gray-400 leading-relaxed line-clamp-1">
              {locale === "en" ? (pick.summaryEn || pick.summary) : pick.summary}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {onViewDetail && (
              <button onClick={() => onViewDetail(pick)}
                className="flex items-center justify-center w-6 h-6 bg-black border-2 border-black hover:bg-gray-800 transition-colors flex-shrink-0"
                title={locale === "en" ? "Details" : "详情"}>
                <Icons.Info className="w-3.5 h-3.5 text-white" />
              </button>
            )}
            {!pick.artist && (pick.titleEn || pick.title) && (
              <a
                href={`https://www.imdb.com/find?q=${encodeURIComponent(((pick.titleEn || pick.title) + " " + (pick.year || "")).trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-6 h-6 bg-[#F5C518] border-2 border-black hover:bg-[#dbaa00] transition-colors flex-shrink-0 overflow-hidden"
                title="Open in IMDb"
              >
                <Icons.Imdb className="w-full h-full" />
              </a>
            )}
            <TrailerButtons item={pick} locale={locale} />
          </div>
        </div>
      </div>
    </CardShell>
  );
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

// ── Intelligence Detail Modal ──

export function IntelDetailModal({ item, type, locale, onClose }) {
  // ⚠️ Hooks first, then early returns — and `enriched` must be declared before
  // imdbUrl uses it. Violating either crashed the intelligence page (black
  // screen) the moment a detail view opened (2026-08-24).
  const [detailData, setDetailData] = useState(null);
  useEffect(() => {
    if (!item?.tmdbId) return;
    const music = type === "music" || type === "album";
    if (music) return;
    let cancelled = false;
    fetchMovieByTmdbId(item.tmdbId, locale).then(data => {
      if (!cancelled && data) setDetailData(data);
    });
    return () => { cancelled = true; };
  }, [item?.tmdbId, type, locale]);

  if (!item) return null;
  const zh = locale === "zh";
  const title = getTitle(item, locale);
  const isMusic = type === "music" || type === "album";
  const isTV = type === "tv";
  // Type chip in the title bar + TrailerButtons lookup — declaration was lost in
  // the earlier restore and crashed every detail view (ReferenceError → black screen)
  const typeLabel = isMusic ? (zh ? "专辑" : "ALBUM") : isTV ? (zh ? "剧集" : "TV") : (zh ? "电影" : "MOVIE");
  const enriched = detailData || {};
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

        {/* Summary — full width below poster+info */}
        {item.summary && (
          <div className="bg-[#f0f0f0] border-4 border-black p-4 mb-4">
            <p className="text-black font-bold leading-relaxed text-sm sm:text-base">
              {locale === "en" ? (item.summaryEn || item.summary) : item.summary}
            </p>
          </div>
        )}

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
      <div className="flex justify-center gap-4 pt-6 pb-8">
        <button onClick={onClose}
          className="flex items-center text-white bg-black border-4 border-[#00ffff] px-6 py-3 uppercase font-bold hover:bg-[#00ffff] hover:text-black transition-colors pixel-font text-sm shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none">
          {locale === "en" ? "← Back" : "← 返回情报"}
        </button>
      </div>
    </div>
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
        {/* Countdown ribbon — CountdownCard's top-right corner design */}
        {ribbon && (
          <div className="absolute top-0 right-0 px-2 py-1 border-l-4 border-b-4 border-black z-10"
            style={{ backgroundColor: ribbonColor }}>
            <span className="text-[9px] sm:text-[10px] font-black pixel-font text-black leading-none">{ribbon}</span>
          </div>
        )}
        {rating > 0 && (
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-black bg-[#ff00ff] text-white border-2 border-black leading-none">
            {rating.toFixed(1)}
          </span>
        )}
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
