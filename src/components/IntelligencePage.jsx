import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";
import { MovieCard, TVCard, AlbumCard, CountdownCard, SpotlightCard, SectionHeader, CardGrid, IntelDetailModal } from "./Cards";
import SubscribeSection from "./SubscribeSection";
import { setCanonical } from "../services/seo";

const LANG_BUTTON_STYLE = {
  fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
};

const NAV_ITEMS = [
  { id: "overview", icon: "Target", color: "#ff00ff", zh: "总览", en: "Overview" },
  { id: "weekly", icon: "Trending", color: "#00ffff", zh: "本周热榜", en: "Weekly Hot" },
  { id: "coming", icon: "Calendar", color: "#ff00ff", zh: "即将上映", en: "Coming Soon" },
  { id: "movies", icon: "Film", color: "#ff00ff", zh: "电影", en: "Movies" },
  { id: "tv", icon: "Tv", color: "#00ffff", zh: "剧集", en: "TV" },
  { id: "music", icon: "Music", color: "#ffff00", zh: "音乐", en: "Music" },
  { id: "search", icon: "Search", color: "#00ffff", zh: "搜索", en: "Search" },
];

// ── Data fetch hook ──
function useJsonData(endpoint) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(endpoint)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(json => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) { setData(null); setError(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [endpoint]);
  return { data, loading, error };
}

function DataError({ locale }) {
  return (
    <p className="text-red-400 text-xs text-center py-8 pixel-font">
      {locale === "zh" ? "数据加载失败，请稍后重试" : "Failed to load data. Please retry."}
    </p>
  );
}

function LoadingSpinner({ locale }) {
  return (
    <div className="flex items-center justify-center py-16">
      <span className="text-gray-500 text-xs pixel-font">{locale === "zh" ? "数据加载中..." : "Loading..."}</span>
    </div>
  );
}

function OverviewView({ locale, onViewDetail }) {
  const { data, loading, error } = useJsonData("/api/overview.json");
  const { data: hiddenGemsData } = useJsonData("/api/hidden-gems.json");
  const { data: digestData } = useJsonData("/api/digest.json");
  if (loading) return <LoadingSpinner locale={locale} />;
  if (error) return <DataError locale={locale} />;
  const stats = data?.stats || {};
  const hiddenGems = hiddenGemsData?.gems || [];
  const statCards = [
    { zh: "电影上映", en: "Movies Released", num: stats.moviesReleased ?? "--", color: "#ff00ff" },
    { zh: "剧集在播", en: "TV Airing", num: stats.tvAiringThisWeek ?? "--", color: "#00ffff" },
    { zh: "专辑发行", en: "Albums Released", num: stats.albumsReleased ?? "--", color: "#000000" },
    { zh: "热榜变动", en: "Trending", num: stats.trending ?? "--", color: "#ff00ff" },
  ];
  return (
    <div className="space-y-8">
      <div className="bg-black border-4 border-[#ff00ff] p-4 sm:p-5 shadow-[8px_8px_0_0_rgba(0,255,255,0.5)]">
        <h2 className="text-lg sm:text-2xl font-black text-white pixel-font mb-2">
          {locale === "zh" ? "娱乐情报中心" : "Entertainment Intelligence"}
        </h2>
        <p className="text-sm text-gray-400">
          {locale === "zh" ? "每日自动汇总全球最新影视音乐发行信息" : "Daily auto-aggregated global entertainment releases"}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((s, i) => (
          <div key={i} className="bg-white border-4 border-black p-3 text-center shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
            <div className="text-2xl sm:text-3xl font-black pixel-font" style={{ color: s.color }}>{s.num}</div>
            <div className="text-[10px] sm:text-xs text-gray-500 mt-1">{locale === "zh" ? s.zh : s.en}</div>
          </div>
        ))}
      </div>
      {/* Daily Digest */}
      {digestData?.headline && (
        <section>
          <SectionHeader label={locale === "zh" ? "☎ 每日摘要" : "☎ Daily Digest"} color="#ff00ff" />
          <div className="bg-black border-4 border-[#ffff00] p-5 shadow-[6px_6px_0_0_rgba(0,255,255,0.3)]">
            <h3 className="text-base font-black text-[#ffff00] mb-2">{locale === "en" ? (digestData.headlineEn || digestData.headline) : digestData.headline}</h3>
            <p className="text-sm text-gray-200 leading-relaxed">{locale === "en" ? (digestData.summaryEn || digestData.summary) : digestData.summary}</p>
            {digestData.topTrends?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {digestData.topTrends.map((t, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 bg-[#ff00ff] text-black font-black">#{locale === "en" ? (t.titleEn || t.title) : t.title}</span>
                ))}
              </div>
            )}
            <p className="text-[10px] text-gray-500 mt-2 pixel-font">
              {locale === "zh" ? "数据更新于 " : "Data updated "}{digestData.date || data?.updated || ""}
            </p>
          </div>
        </section>
      )}

      {(data?.editorsPicks || []).length > 0 && (
        <section>
          <SectionHeader label={locale === "zh" ? "★ 编辑精选" : "★ Editor's Picks"} count={data.editorsPicks.length} color="#ff00ff" />
          <CardGrid cols="grid-cols-1 sm:grid-cols-2">{data.editorsPicks.map((p, i) => <SpotlightCard key={i} pick={p} locale={locale} onViewDetail={onViewDetail} />)}</CardGrid>
        </section>
      )}

      {hiddenGems.length > 0 && (
        <section>
          <SectionHeader label={locale === "zh" ? "◆ 隐藏宝藏" : "◆ Hidden Gems"} count={hiddenGems.length} color="#00ffff" />
          <CardGrid cols="grid-cols-1 sm:grid-cols-2">{hiddenGems.map((p, i) => <SpotlightCard key={i} pick={p} locale={locale} onViewDetail={onViewDetail} />)}</CardGrid>
        </section>
      )}
      {(data?.comingSoon || []).length > 0 && (
        <section>
          <SectionHeader label={locale === "zh" ? "▶ 即将上映" : "▶ Coming Soon"} count={data.comingSoon.length} color="#ffff00" />
          <CardGrid cols="grid-cols-1 sm:grid-cols-2">{data.comingSoon.map((p, i) => <CountdownCard key={i} item={p} locale={locale} onViewDetail={onViewDetail} />)}</CardGrid>
        </section>
      )}
      {(data?.trending || []).length > 0 && (
        <section>
          <SectionHeader label={locale === "zh" ? "↑ 热榜趋势" : "↑ Trending"} count={data.trending.length} color="#ff00ff" />
          <CardGrid cols="grid-cols-1 sm:grid-cols-2">{data.trending.map((p, i) => <MovieCard key={i} movie={p} locale={locale} onViewDetail={(item) => onViewDetail?.(item, "movie")} />)}</CardGrid>
        </section>
      )}
    </div>
  );
}

// ── Movies ──
function MoviesView({ locale, onViewDetail }) {
  const { data, loading, error } = useJsonData("/api/movies.json");
  const [tab, setTab] = useState("week");
  if (loading) return <LoadingSpinner locale={locale} />;
  if (error) return <DataError locale={locale} />;
  const tabs = [
    { id: "week", zh: "本周上映", en: "This Week", key: "releasedThisWeek" },
    { id: "upcoming", zh: "即将上映", en: "Upcoming", key: "upcoming" },
    { id: "playing", zh: "热映中", en: "Now Playing", key: "nowPlaying" },
  ];
  const current = data?.[tabs.find(t => t.id === tab)?.key] || [];
  return (
    <div className="space-y-6">
      <SectionHeader label={locale === "zh" ? "电影情报" : "Movie Intelligence"} color="#ff00ff" />
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-[10px] font-black pixel-font uppercase border-2 border-black transition-colors ${tab === t.id ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"}`}>
            {locale === "zh" ? t.zh : t.en}
            {data?.[t.key]?.length > 0 && <span className="ml-1 opacity-60">({data[t.key].length})</span>}
          </button>
        ))}
      </div>
      {current.length === 0 ? (
        <p className="text-gray-500 text-xs text-center py-8">{locale === "zh" ? "暂无数据" : "No data yet"}</p>
      ) : (
        <CardGrid cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">{current.map((m, i) => <MovieCard key={i} movie={m} locale={locale} onViewDetail={onViewDetail} />)}</CardGrid>
      )}
    </div>
  );
}

// ── TV ──
function TVView({ locale, onViewDetail }) {
  const { data, loading, error } = useJsonData("/api/tv.json");
  const [tab, setTab] = useState("week");
  if (loading) return <LoadingSpinner locale={locale} />;
  if (error) return <DataError locale={locale} />;
  const tabs = [
    { id: "week", zh: "本周首播", en: "This Week", key: "premieresThisWeek" },
    { id: "upcoming", zh: "即将播出", en: "Upcoming", key: "upcoming" },
    { id: "ongoing", zh: "热播中", en: "Ongoing", key: "ongoing" },
  ];
  const current = data?.[tabs.find(t => t.id === tab)?.key] || [];
  return (
    <div className="space-y-6">
      <SectionHeader label={locale === "zh" ? "剧集情报" : "TV Intelligence"} color="#00ffff" />
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-[10px] font-black pixel-font uppercase border-2 border-black transition-colors ${tab === t.id ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"}`}>
            {locale === "zh" ? t.zh : t.en}
            {data?.[t.key]?.length > 0 && <span className="ml-1 opacity-60">({data[t.key].length})</span>}
          </button>
        ))}
      </div>
      {current.length === 0 ? (
        <p className="text-gray-500 text-xs text-center py-8">{locale === "zh" ? "暂无数据" : "No data yet"}</p>
      ) : (
        <CardGrid cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">{current.map((s, i) => <TVCard key={i} show={s} locale={locale} onViewDetail={onViewDetail} />)}</CardGrid>
      )}
    </div>
  );
}

// ── Music ──
const TAG_FILTERS = [
  { id: "trending", zh: "🔥 热门趋势", en: "🔥 Trending Now" },
  { id: "editor", zh: "⭐ 编辑推荐", en: "⭐ Editor's Pick" },
  { id: "hidden", zh: "💎 隐藏宝石", en: "💎 Hidden Gem" },
  { id: "world", zh: "🌍 环球音乐", en: "🌍 Around the World" },
];

function MusicView({ locale, onViewDetail }) {
  const { data, loading, error } = useJsonData("/api/music.json");
  const [tagFilter, setTagFilter] = useState("trending");
  if (loading) return <LoadingSpinner locale={locale} />;
  if (error) return <DataError locale={locale} />;
  const picks = data?.picks || [];
  const current = picks.filter(a => a.recommendationTagId === tagFilter);
  return (
    <div className="space-y-6">
      <SectionHeader label={locale === "zh" ? "本周精选" : "This Week's Picks"} color="#ffff00" />
      <div className="flex gap-1.5 flex-wrap">
        {TAG_FILTERS.map(f => (
          <button key={f.id} onClick={() => setTagFilter(f.id)}
            className={`px-3 py-1.5 text-[10px] font-black pixel-font uppercase border-2 border-black transition-colors ${tagFilter === f.id ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"}`}>
            {locale === "en" ? f.en : f.zh}
            <span className="ml-1 opacity-60">({picks.filter(a => a.recommendationTagId === f.id).length})</span>
          </button>
        ))}
      </div>
      {current.length === 0 ? (
        <p className="text-gray-500 text-xs text-center py-8">{locale === "zh" ? "暂无数据" : "No data yet"}</p>
      ) : (
        <CardGrid cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">{current.map((a, i) => <AlbumCard key={a.mbid || i} album={a} locale={locale} onViewDetail={(item) => onViewDetail?.(item, "album")} />)}</CardGrid>
      )}
    </div>
  );
}

// ── Coming Soon ──
function ComingView({ locale, onViewDetail }) {
  const { data: moviesAll, loading: mL, error: mE } = useJsonData("/api/movies.json");
  const { data: tvAll, loading: tL, error: tE } = useJsonData("/api/tv.json");
  const { data: musicAll, loading: aL, error: aE } = useJsonData("/api/music.json");
  const loading = mL || tL || aL;
  const error = mE || tE || aE;
  const [typeTab, setTypeTab] = useState("movies");
  if (loading) return <LoadingSpinner locale={locale} />;
  if (error) return <DataError locale={locale} />;
  const moviesUpcoming = (moviesAll?.upcoming || []).map(i => ({ ...i, mediaType: "movie" }));
  const tvUpcoming = (tvAll?.upcoming || []).map(i => ({ ...i, mediaType: "tv" }));
  const musicUpcoming = (musicAll?.picks || []).map(i => ({ ...i, mediaType: "album" }));
  const byType = { movies: moviesUpcoming, tv: tvUpcoming, music: musicUpcoming };
  const types = [
    { id: "movies", zh: "电影", en: "Movies" },
    { id: "tv", zh: "剧集", en: "TV" },
    { id: "music", zh: "音乐", en: "Music" },
  ];
  const current = byType[typeTab] || [];
  return (
    <div className="space-y-6">
      <SectionHeader label={locale === "zh" ? "即将上映" : "Coming Soon"} color="#ff00ff" />
      <div className="flex gap-2 flex-wrap">
        {types.map(t => (
          <button key={t.id} onClick={() => setTypeTab(t.id)}
            className={`px-3 py-1.5 text-[10px] font-black pixel-font uppercase border-2 border-black transition-colors ${typeTab === t.id ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"}`}>
            {locale === "zh" ? t.zh : t.en}
            <span className="ml-1 opacity-60">({Math.min(byType[t.id].length, 20)})</span>
          </button>
        ))}
      </div>
      {current.length === 0 ? (
        <p className="text-gray-500 text-xs text-center py-8">{locale === "zh" ? "暂无数据" : "No data yet"}</p>
      ) : (
        <CardGrid cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {current.slice(0, 20).map((item, i) =>
            typeTab === "movies" ? <MovieCard key={i} movie={item} locale={locale} onViewDetail={onViewDetail} />
            : typeTab === "tv" ? <TVCard key={i} show={item} locale={locale} onViewDetail={onViewDetail} />
            : <AlbumCard key={i} album={item} locale={locale} onViewDetail={(album) => onViewDetail?.(album, "album")} />
          )}
        </CardGrid>
      )}
    </div>
  );
}

// ── Weekly Hot List (replaces old Trending/Weekly) ──
function WeeklyView({ locale, onViewDetail }) {
  const { data, loading, error } = useJsonData("/api/weekly.json");
  const { data: musicData } = useJsonData("/api/music.json");
  const [typeTab, setTypeTab] = useState("movies");
  // Music: trending + editor picks from music.json, sorted by heat
  const musicPicks = useMemo(() => {
    return (musicData?.picks || [])
      .filter(a => a.recommendationTagId === "trending" || a.recommendationTagId === "editor")
      .sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0))
      .map((item, i) => ({ ...item, rank: i + 1, trend: "new" }));
  }, [musicData]);
  if (loading) return <LoadingSpinner locale={locale} />;
  if (error) return <DataError locale={locale} />;
  const types = [
    { id: "movies", zh: "电影", en: "Movies" },
    { id: "tv", zh: "剧集", en: "TV" },
    { id: "music", zh: "音乐", en: "Music" },
  ];
  const current = typeTab === "music" ? musicPicks : (data?.[typeTab] || []);
  return (
    <div className="space-y-6">
      <SectionHeader label={locale === "zh" ? "本周热榜" : "Weekly Hot"} count={current.length} color="#ffff00" />
      <div className="flex gap-2 flex-wrap">
        {types.map(t => (
          <button key={t.id} onClick={() => setTypeTab(t.id)}
            className={`px-3 py-1.5 text-[10px] font-black pixel-font uppercase border-2 transition-colors ${typeTab === t.id ? "bg-[#ffff00] text-black border-[#ffff00]" : "bg-white text-black border-black hover:bg-gray-100"}`}>
            {locale === "zh" ? t.zh : t.en}
            <span className="ml-1 opacity-60">({t.id === "music" ? musicPicks.length : (data?.[t.id]?.length || 0)})</span>
          </button>
        ))}
      </div>
      {current.length === 0 ? (
        <p className="text-gray-500 text-xs text-center py-8">{locale === "zh" ? "暂无数据" : "No data yet"}</p>
      ) : (
        <CardGrid cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {current.slice(0, 20).map((item, i) => {
            const rank = item.rank || i + 1;
            return typeTab === "movies" ? <MovieCard key={i} movie={item} locale={locale} onViewDetail={onViewDetail} />
              : typeTab === "tv" ? <TVCard key={i} show={item} locale={locale} onViewDetail={onViewDetail} />
              : <AlbumCard key={i} album={item} locale={locale} onViewDetail={(album) => onViewDetail?.(album, "album")} />;
          })}
        </CardGrid>
      )}
    </div>
  );
}

// ── Search ──
function SearchView({ locale, onViewDetail }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ movies: [], tv: [], music: [], albums: [] });
  const [searching, setSearching] = useState(false);

  // Load all data once
  const { data: movies } = useJsonData("/api/movies.json");
  const { data: tv } = useJsonData("/api/tv.json");
  const { data: music } = useJsonData("/api/music.json");
  const { data: coming } = useJsonData("/api/coming.json");
  const { data: weekly } = useJsonData("/api/weekly.json");

  const allItems = useMemo(() => {
    const items = [];
    const add = (list, type) => { if (Array.isArray(list)) list.forEach(item => items.push({ ...item, _type: type })); };
    // Flatten movies
    if (movies) { add(movies.releasedToday, "movie"); add(movies.releasedThisWeek, "movie"); add(movies.upcoming, "movie"); add(movies.nowPlaying, "movie"); }
    if (tv) { add(tv.premieresThisWeek, "tv"); add(tv.upcoming, "tv"); add(tv.ongoing, "tv"); }
    if (music) { add(music.picks, "album"); }
    // Flatten coming soon
    if (coming) {
      [...(coming.next7Days || []), ...(coming.next30Days || [])].forEach(item => items.push({ ...item, _type: item.mediaType === "tv" ? "tv" : item.mediaType === "album" || item.mediaType === "single" ? "album" : "movie" }));
    }
    // Flatten weekly hot (movies + tv only; music uses music.json picks)
    if (weekly) {
      add(weekly.movies, "movie");
      add(weekly.tv, "tv");
    }
    // Deduplicate by title
    const seen = new Set();
    return items.filter(item => {
      const key = item.title + (item.artist || "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [movies, tv, music]);

  useEffect(() => {
    if (!query.trim() || allItems.length === 0) { setResults({ movies: [], tv: [], music: [], albums: [] }); return; }
    setSearching(true);
    const q = query.toLowerCase();
    const filtered = allItems.filter(item => {
      const title = (item.title || "").toLowerCase();
      const artist = (item.artist || "").toLowerCase();
      const titleEn = (item.titleEn || "").toLowerCase();
      const genre = (Array.isArray(item.genre) ? item.genre.join(" ") : (item.genre || "")).toLowerCase();
      const tags = (item.tags || []).join(" ").toLowerCase();
      return title.includes(q) || artist.includes(q) || titleEn.includes(q) || genre.includes(q) || tags.includes(q);
    });
    setResults({
      movies: filtered.filter(i => i._type === "movie"),
      tv: filtered.filter(i => i._type === "tv"),
      albums: filtered.filter(i => i._type === "album"),
    });
    setSearching(false);
  }, [query, allItems]);

  const totalCount = results.movies.length + results.tv.length + results.albums.length;

  return (
    <div className="space-y-6">
      <SectionHeader label={locale === "zh" ? "搜索" : "Search"} color="#00ffff" />
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={locale === "zh" ? "搜索电影、剧集、专辑..." : "Search movies, TV, albums..."}
          className="w-full px-4 py-3 border-4 border-black text-sm font-bold bg-white focus:outline-none focus:border-[#00ffff] shadow-[4px_4px_0_0_rgba(0,0,0,1)]"
        />
        {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">...</span>}
      </div>
      {query.trim() && (
        <p className="text-[10px] text-gray-500 pixel-font">
          {locale === "zh" ? "共找到 " : "Found "}{totalCount}{locale === "zh" ? " 个结果" : " results"}
        </p>
      )}
      {results.movies.length > 0 && (
        <section>
          <SectionHeader label={locale === "zh" ? "电影" : "Movies"} count={results.movies.length} color="#ff00ff" />
          <CardGrid cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">{results.movies.slice(0, 12).map((m, i) => <MovieCard key={i} movie={m} locale={locale} onViewDetail={(item) => onViewDetail?.(item, "movie")} />)}</CardGrid>
        </section>
      )}
      {results.tv.length > 0 && (
        <section>
          <SectionHeader label={locale === "zh" ? "剧集" : "TV"} count={results.tv.length} color="#00ffff" />
          <CardGrid cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">{results.tv.slice(0, 12).map((s, i) => <TVCard key={i} show={s} locale={locale} onViewDetail={(item) => onViewDetail?.(item, "tv")} />)}</CardGrid>
        </section>
      )}
      {results.albums.length > 0 && (
        <section>
          <SectionHeader label={locale === "zh" ? "专辑" : "Albums"} count={results.albums.length} color="#ffff00" />
          <CardGrid cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">{results.albums.slice(0, 12).map((a, i) => <AlbumCard key={i} album={a} locale={locale} />)}</CardGrid>
        </section>
      )}
      {query.trim() && !searching && totalCount === 0 && (
        <p className="text-gray-500 text-sm text-center py-12">
          {locale === "zh" ? "没有找到匹配结果" : "No results found"}
        </p>
      )}
    </div>
  );
}

// ── Main IntelligencePage ──
function IntelligencePage() {
  const { t, locale, toggleLocale } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const match = location.pathname.match(/^\/intelligence(?:\/(\w+))?/);
  const activeNav = match?.[1] || "overview";
  const [detailItem, setDetailItem] = useState(null);
  const [detailType, setDetailType] = useState("movie");

  const handleViewDetail = (item, type) => {
    setDetailItem(item);
    setDetailType(type || "movie");
  };

  useEffect(() => {
    document.title = locale === "zh"
      ? "娱乐情报 | Intelligence | Kim's Video"
      : "Entertainment Intelligence | Kim's Video";
    setCanonical("https://bloodyrex.xyz/intelligence");
  }, [locale]);

  const IconComp = (name) => Icons[name] || Icons.Target;

  return (
    <div className={`min-h-screen graffiti-bg text-black pb-32 intelligence-page locale-${locale}`}>
      {/* Header */}
      <header className="relative z-10 flex flex-col items-center py-4 mb-0 bg-black border-b-8 border-[#ff00ff] shadow-[0_8px_0_0_rgba(0,255,255,1)]">
        <Link to="/" className="flex items-center justify-center hover:opacity-80 transition-opacity">
          <div className="bg-[#ffff00] p-2 border-4 border-black mr-4 transform -rotate-6">
            <span className="text-black transform rotate-90"><Icons.Play /></span>
          </div>
          <h1 className="text-lg sm:text-2xl font-black text-white pixel-font uppercase tracking-widest drop-shadow-[4px_4px_0_#ff00ff] whitespace-nowrap" style={{fontFamily:"'Press Start 2P','Courier New',Courier,monospace"}}>
            KIM'S <span className="text-[#00ffff]">VIDEO</span>
          </h1>
        </Link>
        <p className="text-gray-500 text-[10px] max-sm:text-[9px] pixel-font mt-1 tracking-wider">{t('tagline')}</p>
      </header>

      {/* Top bar */}
      <div className="max-w-6xl mx-auto px-4 pt-3 pb-1 flex items-center justify-end">
      </div>

      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-0">
        {/* Sidebar - always visible, scrollable on mobile */}
        <aside className="sticky top-0 z-20 bg-black/90 sm:bg-black/60 sm:static sm:w-48 sm:min-h-[calc(100vh-200px)] sm:block sm:border-r-4 sm:border-[#ff00ff]">
          <nav className="flex sm:flex-col overflow-x-auto sm:overflow-x-visible px-4 py-2 sm:p-0 gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = IconComp(item.icon);
              const active = activeNav === item.id;
              return (
                <button key={item.id} onClick={() => { navigate(item.id === "overview" ? "/intelligence" : `/intelligence/${item.id}`); }}
                  className={`flex items-center gap-2 px-3 py-2.5 sm:py-3 w-full text-left transition-colors border-l-4 ${active ? "bg-gray-900 border-[#ffff00] text-white" : "border-transparent text-gray-400 hover:bg-gray-900/50 hover:text-white"}`}>
                  <span className={`w-5 h-5 flex-shrink-0 ${active ? "text-white" : "text-gray-600"}`}><Icon className="w-5 h-5" /></span>
                  <span className="text-[10px] sm:text-xs font-black pixel-font whitespace-nowrap">{locale === "zh" ? item.zh : item.en}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 sm:p-6 min-w-0">
          {activeNav === "overview" && <OverviewView locale={locale} onViewDetail={(item) => handleViewDetail(item, "movie")} />}
          {activeNav === "movies" && <MoviesView locale={locale} onViewDetail={(item) => handleViewDetail(item, "movie")} />}
          {activeNav === "tv" && <TVView locale={locale} onViewDetail={(item) => handleViewDetail(item, "tv")} />}
          {activeNav === "music" && <MusicView locale={locale} onViewDetail={(item) => handleViewDetail(item, "music")} />}
          {activeNav === "coming" && <ComingView locale={locale} onViewDetail={(item, type) => handleViewDetail(item, type)} />}
          {activeNav === "weekly" && <WeeklyView locale={locale} onViewDetail={(item, type) => handleViewDetail(item, type)} />}
          {activeNav === "search" && <SearchView locale={locale} onViewDetail={(item, type) => handleViewDetail(item, type)} />}
        </main>
      </div>

      <SubscribeSection locale={locale} />

      {/* Lang + Share floating group */}
      <div className="relative mt-4 mb-2 flex justify-end px-4 gap-2">
        <button onClick={toggleLocale}
          className="w-7 h-7 sm:w-8 sm:h-8 bg-[#ff00ff] border-2 border-black text-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors font-black text-[10px] sm:text-xs shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none"
          style={LANG_BUTTON_STYLE}>
          {locale === "zh" ? "En" : "中"}
        </button>
      </div>

      {/* Footer */}
      <footer className={`fixed bottom-0 w-full z-10 text-center py-3 bg-black border-t-4 border-[#ffff00] text-white ${locale === "zh" ? "text-sm max-sm:text-xs font-bold tracking-wider" : "pixel-font text-[10px] max-sm:text-[9px] uppercase tracking-widest"}`}>
        <p>
          <Link to="/discover" className="hover:text-[#ffff00] transition-colors">{t('footer.discover')}</Link>
          <span className="text-gray-600 mx-2">|</span>
          <Link to="/" className="hover:text-[#00ffff] transition-colors">{t('footer.home')}</Link>
          <span className="text-gray-600 mx-2">|</span>
          <a href="mailto:rexhr@yahoo.com" className="hover:text-[#ffff00] transition-colors">{t('footer.contact')}</a>
          <span className="text-gray-800 mx-1">·</span>
          <Link to="/admin" className="text-gray-800 hover:text-[#ffff00] transition-colors text-[8px] opacity-20 hover:opacity-100">·</Link>
        </p>
      </footer>
      {/* Detail Modal */}
      {detailItem && (
        <IntelDetailModal item={detailItem} type={detailType} locale={locale} onClose={() => setDetailItem(null)} />
      )}
    </div>
  );
}

export default IntelligencePage;
