import React from "react";
import { Icons } from "./Icons";

// ── Image proxy helper ──
function posterUrl(path) {
  if (!path) return "";
  if (path.startsWith("https://image.tmdb.org/") || path.startsWith("https://coverartarchive.org/")) {
    return "https://api.bloodyrex.xyz/poster-proxy?url=" + encodeURIComponent(path);
  }
  return path;
}
// ── Shared helpers ──

const GENRE_ZH = {
  "Action": "动作", "Adventure": "冒险", "Animation": "动画", "Comedy": "喜剧",
  "Crime": "犯罪", "Documentary": "纪录", "Drama": "剧情", "Family": "家庭",
  "Fantasy": "奇幻", "History": "历史", "Horror": "恐怖", "Music": "音乐",
  "Mystery": "悬疑", "Romance": "爱情", "Sci-Fi": "科幻", "TV Movie": "电视电影",
  "Thriller": "惊悚", "War": "战争", "Western": "西部",
  "Album": "专辑", "Single": "单曲", "EP": "EP", "Soundtrack": "原声",
  "Live": "现场", "Compilation": "合辑", "Remix": "混音",
};

// For music items: get best available genre tags (AI -> Last.fm -> MB)
function albumGenres(item) {
  if (item.tags?.length) return item.tags;
  if (item.lfmTags?.length) return item.lfmTags.slice(0, 5);
  if (item.genre) return [item.genre];
  return [];
}
function albumGenresEn(item) {
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

function StarRating({ score, max = 10 }) {
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
function TrailerButtons({ item, locale }) {
  const title = (item.titleEn || item.title || "");
  const tmdbId = item.tmdbId;
  const biliHref = `https://search.bilibili.com/all?keyword=${encodeURIComponent((title + " 预告片").trim())}`;
  const [ytKey, setYtKey] = React.useState(null);
  React.useEffect(() => {
    if (!tmdbId) return;
    const mtype = item.type === "剧集" || item.type === "TV Series" || item.type === "tv" ? "tv" : "movie";
    fetch(`https://api.bloodyrex.xyz/intelligence/trailer?tmdbId=${tmdbId}&type=${mtype}`)
      .then(r => r.json())
      .then(d => { if (d.key) setYtKey(d.key); })
      .catch(() => {});
  }, [tmdbId]);
  const ytHref = ytKey
    ? `https://www.youtube.com/watch?v=${ytKey}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent((title + " trailer").trim())}`;
  return (
    <>
      <a href={ytHref} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center w-6 h-6 bg-[#ff0000] border-2 border-black hover:bg-[#cc0000] transition-colors flex-shrink-0"
        title={ytKey ? "观看YouTube预告片" : "在YouTube搜索预告片"}>
        <Icons.Youtube />
      </a>
      <a href={biliHref} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center w-6 h-6 bg-[#00a1d6] border-2 border-black hover:bg-[#0085b3] transition-colors flex-shrink-0"
        title="在Bilibili搜索预告片">
        <Icons.Bilibili />
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
                className="px-2 py-0.5 text-[8px] font-black text-white bg-black border-2 border-black uppercase hover:bg-gray-800 transition-colors pixel-font">
                {locale === "en" ? "DETAILS" : "详情"}
              </button>
            )}
            <a
              href={`https://www.imdb.com/find?q=${encodeURIComponent(((movie.titleEn || movie.title) + " " + (movie.year || "")).trim())}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black text-white bg-[#F5C518] border-2 border-black uppercase hover:bg-[#dbaa00] transition-colors pixel-font"
              title="Open in IMDb"
            >
              <Icons.Imdb className="w-3 h-3" />
              IMDb
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
                className="px-2 py-0.5 text-[8px] font-black text-white bg-black border-2 border-black uppercase hover:bg-gray-800 transition-colors pixel-font">
                {locale === "en" ? "DETAILS" : "详情"}
              </button>
            )}
            <a
              href={`https://www.imdb.com/find?q=${encodeURIComponent(((show.titleEn || show.title) + " " + (show.year || "")).trim())}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black text-white bg-[#F5C518] border-2 border-black uppercase hover:bg-[#dbaa00] transition-colors pixel-font"
              title="Open in IMDb"
            >
              <Icons.Imdb className="w-3 h-3" />
              IMDb
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
                className="px-2 py-0.5 text-[8px] font-black text-white bg-black border-2 border-black uppercase hover:bg-gray-800 transition-colors pixel-font">
                {locale === "en" ? "DETAILS" : "详情"}
              </button>
            )}
            <a
              href={`https://open.spotify.com/search/${encodeURIComponent((artist + " " + title).trim())}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black text-white bg-[#1DB954] border-2 border-black uppercase hover:bg-[#169c46] transition-colors pixel-font"
              title="Open in Spotify"
            >
              <Icons.Spotify className="w-3 h-3" />
              SPOTIFY
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
                className="px-2 py-0.5 text-[8px] font-black text-white bg-black border-2 border-black uppercase hover:bg-gray-800 transition-colors pixel-font">
                {locale === "en" ? "DETAILS" : "详情"}
              </button>
            )}
            {!isMusicCard && (item.titleEn || item.title) && (
              <a
                href={`https://www.imdb.com/find?q=${encodeURIComponent(((item.titleEn || item.title) + " " + (item.year || "")).trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black text-white bg-[#F5C518] border-2 border-black uppercase hover:bg-[#dbaa00] transition-colors pixel-font"
                title="Open in IMDb"
              >
                <Icons.Imdb className="w-3 h-3" />
                IMDb
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
          <Tags tags={pick.tags} tagsEn={pick.tagsEn} color={catColor} locale={locale} />
          <div className="flex items-center gap-2 mt-1">
            {onViewDetail && (
              <button onClick={() => onViewDetail(pick)}
                className="px-2 py-0.5 text-[8px] font-black text-white bg-black border-2 border-black uppercase hover:bg-gray-800 transition-colors pixel-font">
                {locale === "en" ? "DETAILS" : "详情"}
              </button>
            )}
            {!pick.artist && (pick.titleEn || pick.title) && (
              <a
                href={`https://www.imdb.com/find?q=${encodeURIComponent(((pick.titleEn || pick.title) + " " + (pick.year || "")).trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black text-white bg-[#F5C518] border-2 border-black uppercase hover:bg-[#dbaa00] transition-colors pixel-font"
                title="Open in IMDb"
              >
                <Icons.Imdb className="w-3 h-3" />
                IMDb
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
      className={`text-lg sm:text-xl font-black mb-4 pixel-font inline-block px-4 py-1.5 border-4 border-black intel-title ${className}`}
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
  if (!item) return null;
  const title = getTitle(item, locale);
  const isMusic = type === "music" || type === "album";
  const typeLabel = type === "tv" ? (locale === "en" ? "TV SERIES" : "剧集")
    : isMusic ? (locale === "en" ? "ALBUM" : "专辑")
    : (locale === "en" ? "MOVIE" : "电影");
  const tmdbPath = type === "tv" ? "tv" : "movie";
  const tmdbUrl = `https://www.themoviedb.org/${tmdbPath}/${item.tmdbId}`;
  const mbUrl = item.mbid ? `https://musicbrainz.org/release/${item.mbid}` : "";
  const genres = Array.isArray(item.genre) ? item.genre : (item.genre ? [item.genre] : []);
  const musicGenres = isMusic ? albumGenres(item) : [];
  const musicGenresEn = isMusic ? albumGenresEn(item) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div className="bg-white border-4 border-black max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-[12px_12px_0_0_#ff00ff]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-black text-white px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-black pixel-font text-[#ff00ff] text-xs flex-shrink-0">{typeLabel}</span>
            {isMusic && item.recommendationTag && (
              <span className="text-[9px] px-1.5 py-0.5 font-black bg-[#ffff00] text-black leading-none">
                {locale === "en" ? (item.recommendationTagEn || item.recommendationTag) : item.recommendationTag}
              </span>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-[#ff00ff] border-2 border-black text-black flex items-center justify-center font-black text-sm hover:bg-black hover:text-[#ff00ff] transition-colors pixel-font flex-shrink-0">X</button>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="flex gap-4 mb-4">
            {item.poster ? (
              <img src={posterUrl(item.poster)} alt={title} className="w-28 h-40 object-cover border-2 border-black flex-shrink-0" />
            ) : (
              <div className="w-28 h-40 bg-gray-800 border-2 border-black flex items-center justify-center text-gray-500 font-bold flex-shrink-0">
                <Icons.Film className="w-8 h-8" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-black leading-tight mb-1">{title}</h2>
              {isMusic && item.artist && <p className="text-sm text-gray-600 font-bold mb-1">{item.artist}</p>}
              {item.year && <p className="text-sm text-gray-500 mb-1">{item.year}</p>}
              <div className="flex items-center gap-2 mb-2">
                <StarRating score={item.rating} max={10} />
                <AIScoreBadge score={item.aiScore} confidence={item.confidence} />
              </div>
              {isMusic
                ? (musicGenres.length > 0
                  ? <div className="flex flex-wrap gap-1">{musicGenres.map((t, i) => <span key={i} className="text-[9px] px-1.5 py-0.5 bg-black text-white font-bold">{locale === "zh" ? (GENRE_ZH[t] || t) : t}</span>)}</div>
                  : null)
                : genres.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {genres.map((g, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 bg-black text-white font-bold">{locale === "zh" ? (GENRE_ZH[g] || g) : g}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {item.summary && (
            <div className="mb-3">
              <p className="text-sm text-gray-600 leading-relaxed">{locale === "en" ? (item.summaryEn || item.summary) : item.summary}</p>
            </div>
          )}

          {isMusic
            ? (musicGenres.length > 0
              ? <div className="flex flex-wrap gap-1">{musicGenres.map((t, i) => <span key={i} className="text-[9px] px-1.5 py-0.5 border font-black" style={{ color: "#333", borderColor: "#333" }}>{locale === "zh" ? (GENRE_ZH[t] || t) : (musicGenresEn[i] || t)}</span>)}</div>
              : null)
            : <Tags tags={item.tags} tagsEn={item.tagsEn} locale={locale} />
          }
        </div>

        {/* Action Buttons */}
        <div className="border-t-4 border-black p-4 flex flex-col sm:flex-row gap-2">
          {!isMusic && item.tmdbId ? (
            <a href={tmdbUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 px-3 py-2.5 text-[10px] font-black text-center text-black bg-[#00ffff] border-2 border-black shadow-[3px_3px_0_0_#000] hover:translate-y-0.5 hover:shadow-[1px_1px_0_0_#000] transition-all pixel-font uppercase">
              {locale === "en" ? "View on TMDB" : "TMDB 查看完整资料"}
            </a>
          ) : isMusic && mbUrl ? (
            <a href={mbUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 px-3 py-2.5 text-[10px] font-black text-center text-black bg-[#00ffff] border-2 border-black shadow-[3px_3px_0_0_#000] hover:translate-y-0.5 hover:shadow-[1px_1px_0_0_#000] transition-all pixel-font uppercase">
              {locale === "en" ? "View on MusicBrainz" : "MusicBrainz 查看资料"}
            </a>
          ) : null}
          <button onClick={onClose}
            className="flex-1 px-3 py-2.5 text-[10px] font-black text-center text-white bg-black border-2 border-black shadow-[3px_3px_0_0_#000] hover:translate-y-0.5 hover:shadow-[1px_1px_0_0_#000] transition-all pixel-font uppercase">
            {locale === "en" ? "Back" : "返回"}
          </button>
        </div>
      </div>
    </div>
  );
}
