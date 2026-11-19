import React, { useState, useEffect } from "react";
import { Icons } from "./Icons";
import { fetchMovieByTmdbId } from "../services/api";
import { useLocale } from "../i18n";
import { toggleFavorite, listFavorites } from "../utils/personalStore";
import { posterUrl } from "../utils/poster";
import { useMovieDetail } from "../hooks/useMovieDetail";

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

// ── Rating color tiers (2026-09-02, Rex): score badge background by tier.
// ≥9 gold (top-tier, gets the comet animated border), 8-9 cyan, 6-8 green, <6 red.
// Only color + border change — sizing/position stay identical to the old badge.
export function ratingColor(score) {
  if (score >= 9) return "#ffd700";   // top tier — gold + comet border
  if (score >= 8) return "#00cfff";   // excellent — cyan
  if (score >= 6) return "#00ff87";   // good — green
  return "#ff4d4d";                    // below 6 — red
}

// Rating badge with tier color + (≥9) comet animated border, matching the
// "来自社区" button's conic-gradient comet effect. Identical size/position to
// the original badge (absolute bottom-right, 9px, px-1.5 py-0.5, 2px border).
export function RatingBadge({ score }) {
  if (!(score > 0)) return null;
  const bg = ratingColor(score);
  const comet = score >= 9;
  // Light tier backgrounds (cyan 8-9, green 6-8) get dark text for contrast on
  // the small 9px badge; gold (≥9, comet) and red (<6) keep white on dark.
  const dark = score >= 6 && score < 9;
  return (
    <span
      className={"absolute bottom-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-black leading-none " +
        (comet ? "rating-comet text-black" : (dark ? "text-black" : "text-white") + " border-2 border-black")}
      style={!comet ? { backgroundColor: bg } : undefined}
    >
      {score.toFixed(1)}
    </span>
  );
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

export function AIScoreBadge() {
  return null;
}

export function Tags({ tags, tagsEn, color = "#ff00ff", locale = "zh" }) {
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

export function CardShell({ children, className = "" }) {
  return (
    <div className={`bg-white border-4 border-black overflow-hidden shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 ${className}`}>
      {children}
    </div>
  );
}

// ── 星标收藏按钮 ──
export function makeEntry(item, type) {
  return {
    id: item.tmdbId
      ? `tmdb:${item.tmdbId}`
      : item.mbid
      ? `mbid:${item.mbid}`
      : `${type}:${(item.titleEn || item.title || "")}:${item.year || ""}`,
    type,
    title: item.titleEn || item.title || "",
    titleEn: item.titleEn || undefined,
    year: item.year || undefined,
    poster: item.poster || item.cover || undefined,
    source: "kims-video",
    summary: item.summary || undefined,
    summaryEn: item.summaryEn || undefined,
    highlight: item.highlight || undefined,
    highlightEn: item.highlightEn || undefined,
    ...(item.tmdbId ? { tmdbId: item.tmdbId } : {}),
    ...(item.mbid ? { mbid: item.mbid } : {}),
  };
}

/* 收藏态用金色描边星，未收藏灰色；点击调用数据层 toggleFavorite */
export function FavoriteButton({ entry, size = "w-5 h-5" }) {
  const { locale } = useLocale();
  const [isFav, setIsFav] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const favs = await listFavorites();
        if (!cancelled) setIsFav(favs.some((f) => f.id === entry.id));
      } catch (_) {}
      setMounted(true);
    })();
    return () => { cancelled = true; };
  }, [entry.id]);

  const onClick = async (e) => {
    e.stopPropagation();
    const now = await toggleFavorite(entry);
    setIsFav(now);
  };

  if (!mounted) return null;

  const label = locale === "zh" ? (isFav ? "已收藏，点击取消" : "收藏") : isFav ? "Favorited, click to remove" : "Favorite";

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center ${size} border-2 border-black transition-all flex-shrink-0 ${isFav ? "bg-[#ffd700]" : "bg-white hover:bg-[#fff3b0]"}`}
      title={label}
      aria-label={label}
    >
      <Icons.Star
        className="w-3 h-3"
        style={
          isFav
            ? { fill: "#000", stroke: "#000", strokeWidth: 2 }
            : { fill: "none", stroke: "#6b7280", strokeWidth: 2.2 }
        }
      />
    </button>
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
              title="Open in IMDb">
              <Icons.Imdb className="w-full h-full" />
            </a>
            <FavoriteButton entry={makeEntry(movie, "movie")} size="w-5 h-5" />
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
              title="Open in IMDb">
              <Icons.Imdb className="w-full h-full" />
            </a>
            <FavoriteButton entry={makeEntry(show, "tv")} size="w-5 h-5" />
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
              title="Open in Spotify">
              <Icons.Spotify className="w-3.5 h-3.5" />
            </a>
            <a
              href={`https://music.apple.com/us/search?term=${encodeURIComponent((artist + " " + title).trim())}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-6 h-6 bg-white border-2 border-black hover:bg-gray-100 transition-colors flex-shrink-0 overflow-hidden"
              title="Open in Apple Music">
              <Icons.AppleMusic className="w-full h-full" />
            </a>
            <a
              href={`https://music.163.com/#/search/m/?s=${encodeURIComponent((artist + " " + title).trim())}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-6 h-6 bg-[#C20C0C] border-2 border-black hover:bg-[#a00a0a] transition-colors flex-shrink-0 overflow-hidden"
              title="Open in NetEase Cloud Music">
              <Icons.NeteaseCloudMusic className="w-full h-full" />
            </a>
            <FavoriteButton entry={makeEntry(album, "album")} size="w-5 h-5" />
          </div>
        </div>
      </div>
    </CardShell>
  );
}
/* 收藏详情弹框的摘要取值：优先用保存时写下的文案，其次才用抓回来的 overview。
   旧收藏（保存时没有 summary）靠 enriched.overview 兜底；音乐没有可信来源时留空。 */
export function pickSummary(item = {}, locale = "zh", enriched = {}) {
  return locale === "en"
    ? (item.summaryEn || item.highlightEn || item.summary || item.highlight || enriched.overview || "")
    : (item.summary || item.highlight || item.summaryEn || item.highlightEn || enriched.overview || "");
}

/* 抓详情接口先查电影再回落剧集，TMDB id 撞号时会把另一部作品返回来。
   收藏详情只接受同类型的返回，避免给剧集显示电影简介。 */
export function matchesDetailType(type, dataType) {
  const allowed = type === "tv" ? ["tv", "tv series", "剧集"] : ["movie", "电影"];
  return allowed.includes(String(dataType || "").toLowerCase());
}
