import React, { useState, useEffect, useRef } from "react";
import discoverData from "../data/discover.json";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";
import { posterAlt } from "../utils/posterAlt";
import { fetchMovieByTmdbId } from "../services/api";
import { fetchDiscoverResults, likeDiscoverResult } from "../services/discoverApi";

const LANG_BUTTON_STYLE = {
  fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
};

const GENRE_COLORS = {
  "科幻": "#ff00ff", "悬疑": "#00ffff", "恐怖": "#ff00ff",
  "动画": "#ffff00", "战争": "#ff00ff", "犯罪": "#00ffff",
  "剧情": "#ffff00", "奇幻": "#ff00ff",
};

const GENRE_THEMES = {
  "科幻": { zh: "时空、科技与人性探索", en: "time, technology, and human exploration" },
  "悬疑": { zh: "悬疑、记忆与身份认同", en: "suspense, memory, and identity" },
  "恐怖": { zh: "心理恐怖与氛围营造", en: "psychological dread and atmosphere" },
  "动画": { zh: "想象力与情感表达", en: "imagination and emotional expression" },
  "战争": { zh: "人性考验与历史反思", en: "human endurance and historical reflection" },
  "犯罪": { zh: "道德边界与命运纠缠", en: "moral boundaries and fate" },
  "剧情": { zh: "人性深度与社会洞察", en: "human depth and social insight" },
  "奇幻": { zh: "神话叙事与史诗冒险", en: "mythic storytelling and epic adventure" },
};

function usePosters(tmdbIds) {
  const [map, setMap] = useState({});
  useEffect(() => {
    const unique = [...new Set(tmdbIds)];
    if (!unique.length) return;
    let cancelled = false;
    (async () => {
      const result = {};
      await Promise.allSettled(unique.map(async id => {
        const data = await fetchMovieByTmdbId(id, "zh");
        if (data?.poster && !cancelled) result[id] = data.poster;
      }));
      if (!cancelled) setMap(prev => ({ ...prev, ...result }));
    })();
    return () => { cancelled = true; };
  }, [JSON.stringify([...new Set(tmdbIds)].sort())]);
  return map;
}

// ── Editor's Picks Card ──
function EditorPickCard({ pair, color, posterMap, locale }) {
  const srcPoster = posterMap[pair.source.tmdbId];
  const recPoster = posterMap[pair.recommend.tmdbId];
  const linkUrl = `/?from=${pair.source.tmdbId}&r=${pair.recommend.tmdbId}&s=${encodeURIComponent(pair.source.title)}&discover=1`;
  const posterW = "w-[50px] sm:w-[56px]";
  const posterH = "h-[72px] sm:h-[82px]";
  return (
    <a
      href={linkUrl}
      className="flex-shrink-0 min-w-[180px] sm:min-w-[200px] bg-white border-4 border-black flex flex-col items-center gap-2 p-3 hover:-translate-y-1 transition-all shadow-[6px_6px_0_0_rgba(0,0,0,1)]"
      style={{ borderBottomColor: color }}
    >
      <span className="text-[10px] font-bold text-gray-400 uppercase">{locale === "en" ? "If you like" : "如果你喜欢"}</span>
      {srcPoster ? (
        <img src={srcPoster} alt={pair.source.title} className={`${posterW} ${posterH} object-cover border-2 border-black`} loading="lazy" />
      ) : (
        <div className={`${posterW} ${posterH} bg-gray-800 border-2 border-black flex items-center justify-center text-[8px] text-gray-500 font-bold`}>?</div>
      )}
      <span className="text-xs font-black text-center leading-tight">{pair.source.title}</span>
      <span className="text-lg font-black" style={{ color }}>↓</span>
      {recPoster ? (
        <img src={recPoster} alt={pair.recommend.title} className={`${posterW} ${posterH} object-cover border-2 border-black`} loading="lazy" />
      ) : (
        <div className={`${posterW} ${posterH} bg-gray-800 border-2 border-black flex items-center justify-center text-[8px] text-gray-500 font-bold`}>?</div>
      )}
      <span className="text-xs font-black text-center leading-tight">{pair.recommend.title}</span>
      <p className="text-[10px] text-gray-500 text-center leading-relaxed line-clamp-2 px-1">{locale === "en" ? pair.reasonEn : pair.reason}</p>
      <span className="inline-block px-3 py-1 text-[10px] font-black text-black border-2 border-black uppercase" style={{ backgroundColor: color }}>
        {locale === "en" ? "Details →" : "查看详情 →"}
      </span>
    </a>
  );
}

// ── User Result Card ──
function UserResultCard({ result, posterMap, locale }) {
  const src = result.sourceMovies?.[0] || {};
  const likes = result.likes || 0;
  const [liked, setLiked] = useState(false);
  const [likesLocal, setLikesLocal] = useState(likes);

  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (liked) return;
    setLiked(true);
    setLikesLocal(l => l + 1);
    try { await likeDiscoverResult(result.id); } catch { /* silent */ }
  };

  return (
    <div className="bg-white border-4 border-black overflow-hidden shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all">
      <div className="bg-black text-white px-3 py-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-black pixel-font uppercase truncate">
          {src.title || ""}{src.year ? ` (${src.year})` : ""}
        </span>
        <span className="text-gray-400 font-bold truncate">
          {result.contributorName || (locale === "en" ? "Anonymous" : "匿名用户")}
        </span>
      </div>
      <div className="flex p-2 gap-2 overflow-x-auto">
        {result.recommendations.map((rec, i) => {
          const poster = posterMap[rec.tmdbId];
          const detailUrl = `/?from=${src.tmdbId || ""}&r=${rec.tmdbId}`;
          const badge = i < 2 ? (locale === "en" ? "HOT" : "热门") : i < 4 ? (locale === "en" ? "NICHE" : "冷门") : (locale === "en" ? "WILD" : "争议");
          const badgeColor = i < 2 ? "bg-[#ff00ff]" : i < 4 ? "bg-[#00ffff]" : "bg-[#ffff00]";
          return (
            <a key={i} href={detailUrl} className="flex-shrink-0 w-16 group relative">
              {poster ? (
                <img src={poster} alt={rec.title} className="w-16 h-24 object-cover border-2 border-black group-hover:border-[#ff00ff] transition-colors" loading="lazy" />
              ) : (
                <div className="w-16 h-24 bg-gray-800 border-2 border-black flex items-center justify-center text-[8px] text-gray-500 font-bold">?</div>
              )}
              <span className={`block text-[8px] font-black text-center mt-0.5 px-0.5 ${badgeColor} text-black`}>{badge}</span>
            </a>
          );
        })}
      </div>
      <div className="px-3 pb-2 flex items-center justify-between text-[10px] text-gray-500">
        <span>{new Date(result.createdAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" })}</span>
        <button
          onClick={handleLike}
          className={`flex items-center gap-1 font-bold px-1.5 py-0.5 border border-gray-300 hover:bg-gray-100 transition-colors ${liked ? "text-[#ff00ff] border-[#ff00ff]" : ""}`}
        >
          <span>{liked ? "♥" : "♡"}</span> {likesLocal}
        </button>
      </div>
    </div>
  );
}

// ── Main DiscoverPage ──
const DiscoverPage = () => {
  const { t, locale, toggleLocale } = useLocale();
  const [posterMap, setPosterMap] = useState({});
  const [userResults, setUserResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    const allIds = new Set();
    (discoverData.editorPicks || []).forEach(p => {
      allIds.add(p.source.tmdbId);
      allIds.add(p.recommend.tmdbId);
    });
    discoverData.genres.forEach(g => g.pairs.forEach(p => {
      allIds.add(p.source.tmdbId);
      allIds.add(p.recommend.tmdbId);
    }));
    let cancelled = false;
    (async () => {
      const map = {};
      await Promise.allSettled([...allIds].map(async id => {
        const data = await fetchMovieByTmdbId(id, locale);
        if (data?.poster && !cancelled) map[id] = data.poster;
      }));
      if (!cancelled) setPosterMap(map);
    })();
    return () => { cancelled = true; };
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingResults(true);
      try {
        const data = await fetchDiscoverResults({ sort: "popular", limit: 30 });
        if (!cancelled) setUserResults(data.results || []);
      } catch (e) {
        if (!cancelled) setUserResults([]);
      }
      if (!cancelled) setLoadingResults(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const userRecTmdbIds = [];
  userResults.forEach(r => r.recommendations?.forEach(rec => {
    if (rec.tmdbId) userRecTmdbIds.push(rec.tmdbId);
  }));
  const userPosterMap = usePosters(userRecTmdbIds);

  const userByGenre = {};
  for (const r of userResults) {
    const g = r.genre || "剧情";
    if (!userByGenre[g]) userByGenre[g] = [];
    userByGenre[g].push(r);
  }

  useEffect(() => {
    document.title = locale === "zh"
      ? "AI 电影推荐发现页 | Discover 相似电影合集 | Kim's Video"
      : "AI Movie Discovery Hub | Curated Film Recommendations | Kim's Video";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.content = locale === "zh"
        ? "探索基于 AI 的电影推荐组合，发现与你喜欢电影相似的科幻、剧情与悬疑作品。"
        : "Explore AI-powered movie recommendation pairs. Discover sci-fi, drama, and mystery films similar to your favorites.";
    }
  }, [locale]);

  const getTitle = (movie) => locale === "en" ? (movie.titleEn || movie.title) : movie.title;
  const getBracketed = (movie) => locale === "zh" ? `《${movie.title}》` : getTitle(movie);

  return (
    <div className="min-h-screen graffiti-bg text-black pb-32">
      {/* Header */}
      <header className="relative z-10 bg-black border-b-8 border-[#ff00ff] shadow-[0_8px_0_0_rgba(0,255,255,1)]">
        <div className="flex flex-col items-center py-4">
          <button
            onClick={toggleLocale}
            className="absolute top-2 left-2 sm:top-3 sm:left-3 w-7 h-7 sm:w-9 sm:h-9 bg-[#ff00ff] border-2 border-black text-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors font-black sm:text-sm z-20"
            style={LANG_BUTTON_STYLE}
          >
            {locale === "zh" ? "En" : "中"}
          </button>
          <a href="/" className="flex items-center justify-center hover:opacity-80 transition-opacity">
            <div className="bg-[#ffff00] p-2 border-4 border-black mr-4 transform -rotate-6">
              <span className="text-black transform rotate-90"><Icons.Play /></span>
            </div>
            <div className="text-xl sm:text-3xl font-black text-white pixel-font uppercase tracking-widest drop-shadow-[4px_4px_0_#ff00ff] whitespace-nowrap">
              KIM'S <span className="text-[#00ffff]">VIDEO</span>
            </div>
          </a>
          <p className="text-gray-500 text-xs pixel-font mt-1 tracking-wider">{t('tagline')}</p>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-4 pt-10 pb-4 text-center">
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-3 drop-shadow-[3px_3px_0_#ff00ff] pixel-font">
          {t('discover.title')}
        </h2>
        <p className="text-gray-300 text-sm max-w-xl mx-auto leading-relaxed">
          {t('discover.desc')}
        </p>
      </section>

      {/* ── Editor's Picks Carousel ── */}
      <section className="max-w-4xl mx-auto px-2 sm:px-4 mb-10">
        <h3 className="px-2 sm:px-0 text-sm font-black pixel-font text-[#ffff00] uppercase tracking-widest mb-3">
          {locale === "en" ? "★ Editor's Picks" : "★ 编辑精选"}
        </h3>
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-3 px-2 sm:px-0"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
        >
          {(discoverData.editorPicks || []).map((pair, i) => (
            <div key={i} style={{ scrollSnapAlign: "start" }}>
              <EditorPickCard pair={pair} color={GENRE_COLORS["科幻"] || "#ff00ff"} posterMap={posterMap} locale={locale} />
            </div>
          ))}
          <a
            href="/"
            className="flex-shrink-0 min-w-[140px] sm:min-w-[160px] bg-[#ffff00] border-4 border-black flex flex-col items-center justify-center gap-2 p-4 text-center hover:bg-[#ffff40] transition-colors shadow-[6px_6px_0_0_rgba(0,0,0,1)]"
            style={{ scrollSnapAlign: "start" }}
          >
            <span className="text-2xl">🎬</span>
            <span className="text-sm font-black pixel-font uppercase">{locale === "en" ? "Start" : "开始"}</span>
            <span className="text-xs text-gray-600">{locale === "en" ? "→ Get Picks" : "→ 获取推荐"}</span>
          </a>
        </div>
      </section>

      {/* ── Genre sections ── */}
      <div className="max-w-4xl mx-auto px-4">
        {discoverData.genres.map((genre) => {
          const color = GENRE_COLORS[genre.name] || "#ff00ff";
          const genreUserResults = userByGenre[genre.name] || [];
          const hasUserContent = genreUserResults.length > 0;

          return (
            <section key={genre.name} className="mb-12">
              <h2
                className="text-xl sm:text-2xl font-black mb-6 pixel-font inline-block px-4 py-2 border-4 border-black"
                style={{ color: "#fff", backgroundColor: color, boxShadow: "6px 6px 0 0 #000", textShadow: "2px 2px 0 rgba(0,0,0,0.3)" }}
              >
                {locale === "en" ? (discoverData.genres.find(g => g.name === genre.name)?.nameEn || genre.name) : genre.name}
              </h2>

              <div className="space-y-4">
                {genre.pairs.map((pair, idx) => {
                  const detailUrl = `/?from=${pair.source.tmdbId}&r=${pair.recommend.tmdbId}&s=${encodeURIComponent(pair.source.title)}&discover=1`;
                  return (
                    <article
                      key={idx}
                      className="bg-white border-4 border-black p-5"
                      style={{ boxShadow: `8px 8px 0 0 ${color}` }}
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
                        <span className="text-sm font-bold text-gray-500">{t('discover.if_like')}</span>
                        <span className="font-black text-lg" style={{ color }}>
                          {getBracketed(pair.source)}
                        </span>
                        <span className="text-gray-400 text-sm">({pair.source.year})</span>
                        <span className="text-gray-500 mx-1 text-lg">{t('discover.arrow')}</span>
                        <span className="font-black text-lg text-black">
                          {getBracketed(pair.recommend)}
                        </span>
                        <span className="text-gray-400 text-sm">({pair.recommend.year})</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{locale === "en" ? pair.reasonEn : pair.reason}</p>
                      <div className="flex gap-2 flex-wrap">
                        <a
                          href={detailUrl}
                          className="inline-block px-4 py-2 text-xs font-black text-black border-2 border-black uppercase shadow-[3px_3px_0_0_#000] hover:translate-y-0.5 transition-all"
                          style={{ backgroundColor: color }}
                        >
                          {t('discover.view_detail')} →
                        </a>
                        <a
                          href={`/?from=${pair.source.tmdbId}`}
                          className="inline-block px-4 py-2 text-xs font-black text-black border-2 border-black bg-[#ffff00] uppercase shadow-[3px_3px_0_0_#000] hover:translate-y-0.5 transition-all"
                        >
                          {locale === "en" ? `More from ${pair.source.titleEn || pair.source.title}` : `更多「${pair.source.title}」→`}
                        </a>
                      </div>
                    </article>
                  );
                })}

                {hasUserContent && (
                  <div className="mt-6">
                    <h4 className="text-sm font-black text-gray-400 pixel-font uppercase mb-3">
                      {locale === "en" ? `★ Community (${genreUserResults.length})` : `★ 用户发现 (${genreUserResults.length})`}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {genreUserResults.map((result) => (
                        <UserResultCard key={result.id} result={result} posterMap={userPosterMap} locale={locale} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}

        {loadingResults && (
          <p className="text-center text-gray-500 text-xs py-8">{locale === "en" ? "Loading community..." : "加载用户发现..."}</p>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-8 pb-16 text-center">
        <a
          href="/"
          className="inline-block px-8 py-3 text-sm font-black pixel-font uppercase text-white bg-black border-4 border-[#ffff00] shadow-[6px_6px_0_0_#ff00ff] hover:translate-y-1 hover:shadow-[3px_3px_0_0_#ff00ff] transition-all"
        >
          {locale === "en" ? "← Get Your Own AI Picks" : "← 获取属于你的 AI 推荐"}
        </a>
      </div>
    </div>
  );
};

export default DiscoverPage;