import React from "react";
import { Icons } from "./Icons";

// ── Image proxy helper ──
function posterUrl(path) {
  if (!path) return "";
  if (path.startsWith("https://image.tmdb.org/")) {
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

function label(locale, zh, en) {
  return locale === "zh" ? zh : en;
}

function getTitle(item, locale) {
  return locale === "en" ? (item.titleEn || item.title) : item.title;
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

function AIScoreBadge({ score, confidence }) {
  if (!score && score !== 0) return null;
  const color = score >= 8 ? "#00ff88" : score >= 6 ? "#ff8800" : score >= 4 ? "#ff8800" : "#ff0044";
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black pixel-font" style={{ color }}>
      <Icons.Target className="w-3 h-3" />
      AI {score}
      {confidence ? ` (${Math.round(confidence * 100)}%)` : ""}
    </span>
  );
}

function Tags({ tags, color = "#ff00ff", locale = "zh" }) {
  if (!tags || !tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t, i) => (
        <span key={i} className="text-[8px] px-1.5 py-0.5 border font-black" style={{ color, borderColor: color }}>
          {locale === "zh" ? (GENRE_ZH[t] || t) : t}
        </span>
      ))}
    </div>
  );
}

// ── Generic Card Shell ──

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

      <div className="flex gap-3 p-3">
        {movie.poster ? (
          <img src={posterUrl(movie.poster)} alt={title} className="w-20 h-28 object-cover border-2 border-black flex-shrink-0" loading="lazy" />
        ) : (
          <div className="w-20 h-28 bg-gray-800 border-2 border-black flex items-center justify-center text-[10px] text-gray-500 font-bold flex-shrink-0">
            <Icons.Film />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="text-sm font-black leading-tight mb-0.5 truncate">{title}</h3>
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
            <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 mb-1">
              {locale === "en" ? (movie.summaryEn || movie.summary) : movie.summary}
            </p>
          )}
          {movie.reason && (
            <p className="text-[9px] text-[#ff00ff] font-bold leading-relaxed line-clamp-1">
              {locale === "en" ? (movie.reasonEn || movie.reason) : movie.reason}
            </p>
          )}
          <Tags tags={movie.tags} locale={locale} />
          {movie.audience && (
            <p className="text-[8px] text-gray-400 mt-auto pt-1">
              {locale === "en" ? "For: " : "适合: "}
              {locale === "en" ? (movie.audienceEn || movie.audience) : movie.audience}
            </p>
          )}
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
          <span className="text-gray-400 text-[9px]">{show.releaseDate || show.year || ""}</span>
        </div>
      </div>

      <div className="flex gap-3 p-3">
        {show.poster ? (
          <img src={posterUrl(show.poster)} alt={title} className="w-20 h-28 object-cover border-2 border-black flex-shrink-0" loading="lazy" />
        ) : (
          <div className="w-20 h-28 bg-gray-800 border-2 border-black flex items-center justify-center text-[10px] text-gray-500 font-bold flex-shrink-0">
            <Icons.Tv />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="text-sm font-black leading-tight mb-0.5 truncate">{title}</h3>
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
          {show.nextAirDate && (
            <p className="text-[9px] text-[#00ffff] font-bold mb-1">
              {locale === "en" ? "Next: " : "下次播出: "}{show.nextAirDate}
            </p>
          )}
          {show.summary && (
            <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 mb-1">
              {locale === "en" ? (show.summaryEn || show.summary) : show.summary}
            </p>
          )}
          <Tags tags={show.tags} color="#00ffff" locale={locale} />
          {show.audience && (
            <p className="text-[8px] text-gray-400 mt-auto pt-1">
              {locale === "en" ? "For: " : "适合: "}
              {locale === "en" ? (show.audienceEn || show.audience) : show.audience}
            </p>
          )}
        </div>
      </div>
    </CardShell>
  );
}

// ── AlbumCard ──

export function AlbumCard({ album, locale, onViewDetail }) {
  const title = album.title || "";
  const artist = album.artist || "";

  return (
    <CardShell>
      <div className="bg-black text-white px-3 py-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-black pixel-font text-[#ffff00] uppercase text-[9px]">
          {locale === "en" ? "ALBUM" : "专辑"}
        </span>
        <span className="text-gray-400 text-[9px]">{album.releaseDate || album.year || ""}</span>
      </div>

      <div className="flex gap-3 p-3">
        {album.cover ? (
          <img src={posterUrl(album.cover)} alt={title} className="w-20 h-20 object-cover border-2 border-black flex-shrink-0" loading="lazy" />
        ) : (
          <div className="w-20 h-20 bg-gray-800 border-2 border-black flex items-center justify-center text-[10px] text-gray-500 font-bold flex-shrink-0">
            <Icons.Music />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="text-sm font-black leading-tight mb-0.5 truncate">{title}</h3>
          <p className="text-xs text-gray-600 font-bold mb-1 truncate">{artist}</p>
          {album.genre && (
            <span className="text-[8px] px-1 bg-black text-white font-bold self-start mb-1">{locale === "zh" ? (GENRE_ZH[album.genre] || album.genre) : album.genre}</span>
          )}
          {album.category && (
            <span className={`text-[8px] px-1.5 py-0.5 self-start mb-1 font-black ${album.category === "global" ? "bg-[#ff00ff] text-white" : "bg-gray-300 text-gray-700"}`}>
              {album.category === "global"
                ? (locale === "zh" ? "✨ 全球关注" : "✨ GLOBAL")
                : (locale === "zh" ? "💎 小众佳作" : "💎 NICHE")}
            </span>
          )}
          {album.highlight && (
            <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 mb-1 italic">
              {locale === "en" ? (album.highlightEn || album.highlight) : album.highlight}
            </p>
          )}
          {album.summary && !album.highlight && (
            <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 mb-1">
              {locale === "en" ? (album.summaryEn || album.summary) : album.summary}
            </p>
          )}
          <AIScoreBadge score={album.aiScore} confidence={album.confidence} />
          <Tags tags={album.tags} color="#333" locale={locale} />
        </div>
      </div>
    </CardShell>
  );
}

// ── CountdownCard (Coming Soon) ──

export function CountdownCard({ item, locale, onViewDetail }) {
  const title = getTitle(item, locale);
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
        <span className="font-black pixel-font text-[#ff00ff] uppercase text-[9px]">
          {locale === "en" ? "COMING" : "即将"}
        </span>
        <span className="text-gray-400 text-[9px]">{item.releaseDate || ""}</span>
      </div>

      <div className="flex gap-3 p-3">
        {item.poster ? (
          <img src={posterUrl(item.poster)} alt={title} className="w-20 h-28 object-cover border-2 border-black flex-shrink-0" loading="lazy" />
        ) : (
          <div className="w-20 h-28 bg-gray-800 border-2 border-black flex items-center justify-center text-[10px] text-gray-500 font-bold flex-shrink-0">
            <Icons.Calendar />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="text-sm font-black leading-tight mb-0.5 truncate">{title}</h3>
          <div className="flex items-center gap-2 mb-1">
            <AIScoreBadge score={item.aiScore} confidence={item.confidence} />
            {item.anticipation && (
              <span className="text-[9px] text-[#ff00ff] font-bold">
                {locale === "en" ? "HOT" : "热门期待"}
              </span>
            )}
          </div>
          {item.summary && (
            <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 mb-1">
              {locale === "en" ? (item.summaryEn || item.summary) : item.summary}
            </p>
          )}
          <Tags tags={item.tags} locale={locale} />
        </div>
      </div>
    </CardShell>
  );
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

      <div className="flex gap-3 p-3">
        {pick.poster ? (
          <img src={posterUrl(pick.poster)} alt={title} className="w-20 h-28 object-cover border-2 border-black flex-shrink-0" loading="lazy" />
        ) : pick.cover ? (
          <img src={posterUrl(pick.cover)} alt={title} className="w-20 h-20 object-cover border-2 border-black flex-shrink-0" loading="lazy" />
        ) : (
          <div className="w-20 h-28 bg-gray-800 border-2 border-black flex items-center justify-center text-[10px] text-gray-500 font-bold flex-shrink-0">
            <Icons.Target />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="text-sm font-black leading-tight mb-0.5">{title}</h3>
          {pick.artist && <p className="text-xs text-gray-600 font-bold mb-1">{pick.artist}</p>}
          <div className="flex items-center gap-2 mb-1">
            <StarRating score={pick.rating} max={10} />
            <AIScoreBadge score={pick.aiScore} confidence={pick.confidence} />
          </div>
          {pick.whyWatch && (
            <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 mb-1">
              {locale === "en" ? (pick.whyWatchEn || pick.whyWatch) : pick.whyWatch}
            </p>
          )}
          {pick.summary && (
            <p className="text-[9px] text-gray-400 leading-relaxed line-clamp-1">
              {locale === "en" ? (pick.summaryEn || pick.summary) : pick.summary}
            </p>
          )}
          <Tags tags={pick.tags} color={catColor} locale={locale} />
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
