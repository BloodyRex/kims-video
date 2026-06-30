import React, { useState, useEffect, useRef } from "react";
import discoverData from "../data/discover.json";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";
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

const GENRE_SLUGS = {
  "科幻": "sci-fi", "悬疑": "mystery", "恐怖": "horror",
  "动画": "animation", "战争": "war", "犯罪": "crime",
  "剧情": "drama", "奇幻": "fantasy",
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

// ── Editor's Picks Card (community style, horizontal scroll) ──
function EditorPickCard({ pair, posterMap, locale, getTitle, onOpenPoster }) {
  const srcPoster = posterMap[pair.source.tmdbId];
  const recPoster = posterMap[pair.recommend.tmdbId];
  const linkUrl = `/?from=${pair.source.tmdbId}&r=${pair.recommend.tmdbId}&s=${encodeURIComponent(pair.source.title)}&discover=1`;
  const srcTitle = getTitle(pair.source);
  const recTitle = getTitle(pair.recommend);

  return (
    <div className="flex-shrink-0 w-[260px] sm:w-[300px] bg-white border-4 border-black overflow-hidden shadow-[6px_6px_0_0_rgba(0,0,0,1)]" style={{ scrollSnapAlign: "start" }}>
      {/* Source header bar */}
      <div className="bg-black text-white px-3 py-2 flex items-center gap-2 text-xs">
        <span className="font-black pixel-font text-xs text-gray-400 uppercase">{locale === "en" ? "If you like" : "如果你喜欢"}</span>
        <span className="font-black text-sm truncate">{srcTitle}</span>
        <span className="text-gray-400 flex-shrink-0">({pair.source.year})</span>
        <span className="text-gray-500 mx-1"></span>
      </div>

      {/* Body */}
      <div className="flex gap-3 p-3">
        {recPoster ? (
          <img src={recPoster} alt={recTitle} className="w-16 h-24 object-cover border-2 border-black flex-shrink-0" loading="lazy" />
        ) : (
          <div className="w-16 h-24 bg-gray-800 border-2 border-black flex items-center justify-center text-xs text-gray-500 font-bold flex-shrink-0">?</div>
        )}
        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="text-sm font-black mb-1 leading-tight">{recTitle}</h3>
          <span className="text-[10px] text-gray-400 mb-1">({pair.recommend.year})</span>
          <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 flex-1">{locale === "en" ? pair.reasonEn : pair.reason}</p>
          <a
            href={linkUrl}
            className="inline-block self-start mt-2 px-2.5 py-1 text-[10px] font-black text-white bg-black border-2 border-black uppercase hover:bg-gray-800 transition-colors"
          >
            {locale === "en" ? "Details" : "查看详情"}
          </a>
        </div>
      </div>
    </div>
  );
}

// ── User Result Card ──
function UserResultCard({ result, posterMap, locale, onLike, onOpenPoster }) {
  const src = result.sourceMovies?.[0] || {};
  const likes = result.likes || 0;
  const storedLiked = (() => { try { return JSON.parse(localStorage.getItem("kims_liked") || "[]"); } catch { return []; } })();
  const [liked, setLiked] = useState(storedLiked.includes(result.id));
  const [likesLocal, setLikesLocal] = useState(likes + (storedLiked.includes(result.id) ? 1 : 0));

  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (liked) return;
    setLiked(true);
    setLikesLocal(l => l + 1);
    try {
      const r = await likeDiscoverResult(result.id);
      if (onLike) onLike(result.id, r.likes);
      try {
        const likedArr = JSON.parse(localStorage.getItem("kims_liked") || "[]");
        if (!likedArr.includes(result.id)) { likedArr.push(result.id); localStorage.setItem("kims_liked", JSON.stringify(likedArr)); }
      } catch {}
    } catch (e) { console.error("Like failed:", e); }
  };

  const handleCardClick = () => {
    if (result.thumbnail) {
      onOpenPoster(result.thumbnail);
    }
  };

  return (
    <div
      className={`bg-white border-4 border-black overflow-hidden shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all ${result.thumbnail ? "hover:-translate-y-1 cursor-pointer" : ""}`}
      onClick={handleCardClick}
    >
      <div className="bg-black text-white px-3 py-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-black pixel-font uppercase truncate">{src.title || ""}{src.year ? ` (${src.year})` : ""}</span>
        <span className="text-gray-400 font-bold truncate">{result.contributorName || (locale === "en" ? "Anonymous" : "匿名用户")}</span>
      </div>
      <div className="flex p-2 gap-2 overflow-x-auto">
        {result.recommendations.map((rec, i) => {
          const poster = posterMap[rec.tmdbId];
          const detailUrl = `/?from=${src.tmdbId || ""}&r=${rec.tmdbId}&discover=1`;
          const badge = i < 2 ? (locale === "en" ? "HOT" : "热门") : i < 4 ? (locale === "en" ? "NICHE" : "冷门") : (locale === "en" ? "WILD" : "争议");
          const bc = i < 2 ? "bg-[#ff00ff]" : i < 4 ? "bg-[#00ffff]" : "bg-[#ffff00]";
          return (
            <a key={i} href={detailUrl} onClick={e => e.stopPropagation()} className="flex-shrink-0 w-16 group">
              {poster ? <img src={poster} alt={rec.title} className="w-16 h-24 object-cover border-2 border-black group-hover:border-[#ff00ff] transition-colors" loading="lazy" /> : <div className="w-16 h-24 bg-gray-800 border-2 border-black flex items-center justify-center text-[8px] text-gray-500 font-bold">?</div>}
              <span className={`block text-[8px] font-black text-center mt-0.5 px-0.5 ${bc} text-black`}>{badge}</span>
            </a>
          );
        })}
      </div>
      <div className="px-3 pb-2 flex items-center justify-between text-[10px] text-gray-500">
        <span>{new Date(result.createdAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" })}</span>
        <button onClick={handleLike} className={`flex items-center gap-1 font-bold px-1.5 py-0.5 border border-gray-300 hover:bg-gray-100 transition-colors ${liked ? "text-[#ff00ff] border-[#ff00ff]" : ""}`}><span>{liked ? "♥" : "♡"}</span> {likesLocal}</button>
      </div>
    </div>
  );
}

// ── Poster Modal ──
function PosterModal({ thumbnail, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 bg-[#ff00ff] border-2 border-black text-white font-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors z-10"
        >×</button>
        <img
          src={thumbnail}
          alt="Full recommendation poster"
          className="max-w-full max-h-[85vh] border-4 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)]"
        />
        <p className="text-center text-white text-xs mt-2 font-bold">{thumbnail.includes("bloodyrex") ? "" : "Click outside to close"}</p>
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
  const [activeTab, setActiveTab] = useState("editor");

  const [modalThumbnail, setModalThumbnail] = useState(null);
  const scrollRef = useRef(null);

  const getTitle = (movie) => locale === "en" ? (movie.titleEn || movie.title) : movie.title;
  const getBracketed = (movie) => locale === "zh" ? `《${movie.title}》` : getTitle(movie);
  const genreSlug = (name) => GENRE_SLUGS[name] || name;

  const editorPickIds = new Set();
  (discoverData.editorPicks || []).forEach(p => editorPickIds.add(`${p.source.tmdbId}-${p.recommend.tmdbId}`));

  const totalPairs = discoverData.genres.reduce((s, g) => s + g.pairs.filter(p => !editorPickIds.has(p.source.tmdbId + "-" + p.recommend.tmdbId)).length, 0);

  useEffect(() => {
    const allIds = new Set();
    (discoverData.editorPicks || []).forEach(p => { allIds.add(p.source.tmdbId); allIds.add(p.recommend.tmdbId); });
    discoverData.genres.forEach(g => g.pairs.forEach(p => { allIds.add(p.source.tmdbId); allIds.add(p.recommend.tmdbId); }));
    let cancelled = false;
    (async () => {
      // Check localStorage cache first (24h TTL)
      try {
        const cached = localStorage.getItem("kims_discover_posters");
        const ts = localStorage.getItem("kims_discover_posters_ts");
        if (cached && ts && (Date.now() - parseInt(ts)) < 86400000) {
          const parsed = JSON.parse(cached);
          if (!cancelled) setPosterMap(parsed);
          return;
        }
      } catch {}
      const map = {};
      await Promise.allSettled([...allIds].map(async id => { const data = await fetchMovieByTmdbId(id, "zh"); if (data?.poster && !cancelled) map[id] = data.poster; }));
      if (!cancelled) {
        setPosterMap(map);
        try { localStorage.setItem("kims_discover_posters", JSON.stringify(map)); localStorage.setItem("kims_discover_posters_ts", String(Date.now())); } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingResults(true);
      try { const data = await fetchDiscoverResults({ sort: "popular", limit: 30 }); if (!cancelled) setUserResults(data.results || []); } catch { if (!cancelled) setUserResults([]); }
      if (!cancelled) setLoadingResults(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const userRecTmdbIds = [];
  userResults.forEach(r => r.recommendations?.forEach(rec => { if (rec.tmdbId) userRecTmdbIds.push(rec.tmdbId); }));
  const userPosterMap = usePosters(userRecTmdbIds);

  const userByGenre = {};
  for (const r of userResults) { const g = r.genre || "剧情"; if (!userByGenre[g]) userByGenre[g] = []; userByGenre[g].push(r); }
  const totalUserCount = userResults.length;

  const handleLikeUpdate = (id, newLikes) => {
    setUserResults(prev => prev.map(r => r.id === id ? { ...r, likes: newLikes } : r));
  };

  useEffect(() => {
    document.title = locale === "zh" ? "AI 电影推荐发现页 | Discover 相似电影合集 | Kim's Video" : "AI Movie Discovery Hub | Curated Film Recommendations | Kim's Video";
  }, [locale]);

  return (
    <div className={`min-h-screen graffiti-bg text-black pb-32 discover-page locale-${locale}`}>
      <header className="relative z-10 flex flex-col items-center py-4 mb-10 bg-black border-b-8 border-[#ff00ff] shadow-[0_8px_0_0_rgba(0,255,255,1)]">
        <a href="/" className="flex items-center justify-center hover:opacity-80 transition-opacity">
          <div className="bg-[#ffff00] p-2 border-4 border-black mr-4 transform -rotate-6">
            <span className="text-black transform rotate-90"><Icons.Play /></span>
          </div>
          <h1 className="text-lg sm:text-2xl font-black text-white pixel-font uppercase tracking-widest drop-shadow-[4px_4px_0_#ff00ff] whitespace-nowrap" style={{fontFamily:"'Press Start 2P','Courier New',Courier,monospace"}}>
            KIM'S <span className="text-[#00ffff]">VIDEO</span>
          </h1>
        </a>
        <p className="text-gray-500 text-xs pixel-font mt-1 tracking-wider">{t('tagline')}</p>
      </header>

      <section className="max-w-4xl mx-auto px-2 sm:px-4 pt-3 pb-4 text-center relative">
        <button onClick={toggleLocale} className="absolute left-2 sm:left-4 top-3 w-7 h-7 sm:w-8 sm:h-8 bg-[#ff00ff] border-2 border-black text-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors font-black text-[10px] sm:text-xs flex-shrink-0 z-10" style={LANG_BUTTON_STYLE}>{locale === "zh" ? "En" : "中"}</button>
        <h2 className="text-xl sm:text-2xl font-black text-white drop-shadow-[3px_3px_0_#ff00ff] pixel-font discover-title">{t('discover.title')}</h2>
        <p className="text-gray-300 text-sm max-w-xl mx-auto leading-relaxed">{t('discover.desc')}</p>
      </section>

      {/* ── Editor's Picks Carousel ── */}
      <section className="max-w-4xl mx-auto px-2 sm:px-4 mb-6">
        <h3 className="px-2 sm:px-0 text-base sm:text-lg font-black pixel-font text-[#ffff00] uppercase tracking-widest mb-3 bg-black inline-block px-4 py-1.5 border-2 border-[#ffff00] shadow-[4px_4px_0_0_#ff00ff]">{locale === "en" ? "★ Editor's Picks" : "★ 编辑精选"}</h3>
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-3 px-2 sm:px-0" style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
          {(discoverData.editorPicks || []).map((pair, i) => (
            <EditorPickCard key={i} pair={pair} posterMap={posterMap} locale={locale} getTitle={getTitle} />
          ))}
          <a href="/" className="flex-shrink-0 min-w-[140px] sm:min-w-[160px] bg-[#ffff00] border-4 border-black flex flex-col items-center justify-center gap-2 p-4 text-center hover:bg-[#ffff40] transition-colors shadow-[6px_6px_0_0_rgba(0,0,0,1)]" style={{ scrollSnapAlign: "start" }}>
            <span className="text-2xl">🎬</span>
            <span className="text-sm font-black pixel-font uppercase">{locale === "en" ? "Start" : "开始"}</span>
            <span className="text-xs text-gray-600">{locale === "en" ? " Get Picks" : " 获取推荐"}</span>
          </a>
        </div>
      </section>

      {/* ── Tab switcher ── */}
      <div className="max-w-4xl mx-auto px-4 mb-6">
        <div className="flex gap-3">
          <button onClick={() => setActiveTab("editor")} className={`px-4 py-2 text-sm font-black pixel-font uppercase border-4 border-black shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none transition-all ${activeTab === "editor" ? "bg-[#ff00ff] text-white" : "bg-white text-black hover:bg-gray-100"}`}>{locale === "en" ? "★ Category" : "★ 分类推荐"}{totalPairs > 0 && <span className="ml-1.5 bg-black text-white text-[10px] px-1.5 py-0.5">{totalPairs}</span>}</button>
          <button onClick={() => setActiveTab("community")} className={`px-4 py-2 text-sm font-black pixel-font uppercase border-4 border-black shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none transition-all ${activeTab === "community" ? "bg-[#ffff00] text-black" : "bg-white text-black hover:bg-gray-100"}`}>{locale === "en" ? "Community" : "社区发现"}{totalUserCount > 0 && <span className="ml-1.5 bg-black text-white text-[10px] px-1.5 py-0.5">{totalUserCount}</span>}</button>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="max-w-4xl mx-auto px-4">
        {activeTab === "editor" ? (
          discoverData.genres.map((genre) => {
            const color = GENRE_COLORS[genre.name] || "#ff00ff";
            const filtered = genre.pairs.filter(p => !editorPickIds.has(`${p.source.tmdbId}-${p.recommend.tmdbId}`));
            if (filtered.length === 0) return null;

            return (
              <section key={genre.name} className="mb-12">
                <h2 className="text-xl sm:text-2xl font-black mb-6 pixel-font inline-block px-4 py-2 border-4 border-black" style={{ color: "#fff", backgroundColor: color, boxShadow: "6px 6px 0 0 #000", textShadow: "2px 2px 0 rgba(0,0,0,0.3)" }}>{locale === "en" ? (discoverData.genres.find(g => g.name === genre.name)?.nameEn || genre.name) : genre.name}<span className="ml-2 text-sm opacity-75">({filtered.length})</span></h2>
                <div className="space-y-4">
                  {filtered.map((pair, idx) => {
                    const recPoster = posterMap[pair.recommend.tmdbId];
                    const detailUrl = `/?from=${pair.source.tmdbId}&r=${pair.recommend.tmdbId}&s=${encodeURIComponent(pair.source.title)}&discover=1`;

                    return (
                      <article key={idx} className="bg-white border-4 border-black overflow-hidden" style={{ boxShadow: `8px 8px 0 0 ${color}` }}>
                        <div className="bg-black text-white px-4 py-2 flex items-center gap-2 text-xs">
                          <span className="font-black pixel-font text-xs text-gray-400 uppercase">{t('discover.if_like')}</span>
                          <span className="font-black text-sm" style={{ color }}>{getBracketed(pair.source)}</span>
                          <span className="text-gray-400">({pair.source.year})</span>
                          <span className="text-gray-500 mx-1">{t('discover.arrow')}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 p-4">
                          {recPoster ? (
                            <img src={recPoster} alt={getTitle(pair.recommend)} className="w-28 h-40 object-cover border-2 border-black flex-shrink-0" loading="lazy" />
                          ) : (
                            <div className="w-28 h-40 bg-gray-800 border-2 border-black flex items-center justify-center text-xs text-gray-500 font-bold flex-shrink-0">?</div>
                          )}
                          <div className="flex-1 min-w-0 flex flex-col">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-2">
                              <h3 className="text-lg sm:text-xl font-black">{getBracketed(pair.recommend)}</h3>
                              <span className="text-gray-400 text-sm">({pair.recommend.year})</span>
                            </div>
                            <p className="text-sm text-gray-600 leading-relaxed mb-3 flex-1">{locale === "en" ? pair.reasonEn : pair.reason}</p>
                            <div className="flex gap-2 flex-wrap mt-auto">
                              <a href={detailUrl} className="inline-block px-4 py-2 text-xs font-black text-white bg-black border-2 border-black uppercase shadow-[3px_3px_0_0_#000] hover:bg-gray-800 hover:translate-y-0.5 transition-all">{t('discover.view_detail')}</a>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })
        ) : (
          <>
            {loadingResults && <p className="text-center text-gray-500 text-xs py-8">{locale === "en" ? "Loading community..." : "加载用户发现..."}</p>}
            {!loadingResults && totalUserCount === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">🎬</p>
                <p className="text-gray-400 text-sm font-bold mb-2">{locale === "en" ? "No community picks yet" : "暂无用户发现"}</p>
                <p className="text-gray-500 text-xs mb-4">{locale === "en" ? "Be the first to share!" : "成为第一个分享 AI 推荐结果的人！"}</p>
                <a href="/" className="inline-block px-6 py-2 text-xs font-black bg-[#ffff00] border-4 border-black pixel-font uppercase shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all">{locale === "en" ? "Get Your Picks " : "获取你的推荐 "}</a>
              </div>
            )}
            {!loadingResults && totalUserCount > 0 && discoverData.genres.map((genre) => {
              const color = GENRE_COLORS[genre.name] || "#ff00ff";
              const items = userByGenre[genre.name] || [];
              if (items.length === 0) return null;
              return (
                <section key={genre.name} className="mb-12">
                  <h2 className="text-xl sm:text-2xl font-black mb-6 pixel-font inline-block px-4 py-2 border-4 border-black" style={{ color: "#fff", backgroundColor: color, boxShadow: "6px 6px 0 0 #000", textShadow: "2px 2px 0 rgba(0,0,0,0.3)" }}>{locale === "en" ? (discoverData.genres.find(g => g.name === genre.name)?.nameEn || genre.name) : genre.name}<span className="ml-2 text-sm opacity-75">({items.length})</span></h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{items.map(r => <UserResultCard key={r.id} result={r} posterMap={userPosterMap} locale={locale} onLike={handleLikeUpdate} onOpenPoster={(url) => setModalThumbnail(url)} />)}</div>
                </section>
              );
            })}
          </>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-8 pb-16 text-center">
        <a href="/" className="inline-block px-8 py-3 text-sm font-black pixel-font uppercase text-white bg-black border-4 border-[#ffff00] shadow-[6px_6px_0_0_#ff00ff] hover:translate-y-1 hover:shadow-[3px_3px_0_0_#ff00ff] transition-all">{locale === "en" ? "← Get Your Own AI Picks" : "← 获取属于你的 AI 推荐"}</a>
      </div>

      {/* ── Poster Modal ── */}
      {modalThumbnail && <PosterModal thumbnail={modalThumbnail} onClose={() => setModalThumbnail(null)} />}
    </div>
  );
};

export default DiscoverPage;