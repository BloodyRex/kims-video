import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";
import { MovieCard, TVCard, AlbumCard, CountdownCard, RankingCard, SpotlightCard, SectionHeader, CardGrid, CardList, IntelDetailModal } from "./Cards";

const LANG_BUTTON_STYLE = {
  fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
};

const NAV_ITEMS = [
  { id: "overview", icon: "Target", color: "#ff00ff", zh: "总览", en: "Overview" },
  { id: "movies", icon: "Film", color: "#ff00ff", zh: "电影", en: "Movies" },
  { id: "tv", icon: "Tv", color: "#00ffff", zh: "剧集", en: "TV" },
  { id: "music", icon: "Music", color: "#ffff00", zh: "音乐", en: "Music" },
  { id: "coming", icon: "Calendar", color: "#ff00ff", zh: "即将上映", en: "Coming Soon" },
  { id: "trending", icon: "Trending", color: "#00ffff", zh: "热榜", en: "Trending" },
  { id: "weekly", icon: "FileText", color: "#ffff00", zh: "周报", en: "Weekly" },
  { id: "spotlight", icon: "Star", color: "#ff00ff", zh: "AI 精选", en: "AI Spotlight" },
  { id: "search", icon: "Search", color: "#00ffff", zh: "搜索", en: "Search" },
];

// ── Data fetch hook ──
function useJsonData(endpoint) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(endpoint)
      .then(r => r.json())
      .then(json => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [endpoint]);
  return { data, loading };
}

function LoadingSpinner({ locale }) {
  return (
    <div className="flex items-center justify-center py-16">
      <span className="text-gray-500 text-xs pixel-font">{locale === "zh" ? "数据加载中..." : "Loading..."}</span>
    </div>
  );
}

// ── Overview ──
function OverviewView({ locale }) {
  const { data, loading } = useJsonData("/api/overview.json");
  const { data: hiddenGemsData } = useJsonData("/api/hidden-gems.json");
  const { data: digestData } = useJsonData("/api/digest.json");
  if (loading) return <LoadingSpinner locale={locale} />;
  const stats = data?.stats || {};
  const hiddenGems = hiddenGemsData?.gems || [];
  const statCards = [
    { zh: "电影上映", en: "Movies Released", num: stats.moviesReleased ?? "--", color: "#ff00ff" },
    { zh: "剧集首播", en: "TV Premieres", num: stats.tvPremieres ?? "--", color: "#00ffff" },
    { zh: "专辑发行", en: "Albums Released", num: stats.albumsReleased ?? "--", color: "#000000" },
    { zh: "热榜变动", en: "Trending", num: stats.trending ?? "--", color: "#ff00ff" },
  ];
  return (
    <div className="space-y-8">
      <div className="bg-black border-4 border-[#ff00ff] p-6 sm:p-8 shadow-[8px_8px_0_0_rgba(0,255,255,0.5)]">
        <h2 className="text-lg sm:text-2xl font-black text-white pixel-font mb-2">
          {locale === "zh" ? "娱乐情报中心" : "Entertainment Intelligence"}
        </h2>
        <p className="text-sm text-gray-400 mb-1">
          {locale === "zh" ? "每日自动汇总全球最新影视音乐发行信息" : "Daily auto-aggregated global entertainment releases"}
        </p>
        <p className="text-xs text-gray-400 pixel-font">{locale === "zh" ? "更新于：今日" : "Updated: Today"}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((s, i) => (
          <div key={i} className="bg-white border-4 border-black p-3 text-center shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
            <div className="text-2xl sm:text-3xl font-black pixel-font" style={{ color: s.color }}>{s.num}</div>
            <div className="text-[10px] sm:text-xs text-gray-500 mt-1">{locale === "zh" ? s.zh : s.en}</div>
          </div>
        ))}
      </div>
      {(data?.editorsPicks || []).length > 0 && (
        <section>
          <SectionHeader label={locale === "zh" ? "★ 编辑精选" : "★ Editor's Picks"} count={data.editorsPicks.length} color="#ff00ff" />
          <CardGrid cols="grid-cols-1 sm:grid-cols-2">{data.editorsPicks.map((p, i) => <SpotlightCard key={i} pick={p} locale={locale} />)}</CardGrid>
        </section>
      )}
      {hiddenGems.length > 0 && (
        <section>
          <SectionHeader label={locale === "zh" ? "◆ 隐藏宝藏" : "◆ Hidden Gems"} count={hiddenGems.length} color="#00ffff" />
          <CardGrid cols="grid-cols-1 sm:grid-cols-2">{hiddenGems.map((p, i) => <SpotlightCard key={i} pick={p} locale={locale} />)}</CardGrid>
        </section>
      )}
      {(data?.comingSoon || []).length > 0 && (
        <section>
          <SectionHeader label={locale === "zh" ? "▶ 即将上映" : "▶ Coming Soon"} count={data.comingSoon.length} color="#ffff00" />
          <CardGrid cols="grid-cols-1 sm:grid-cols-2">{data.comingSoon.map((p, i) => <CountdownCard key={i} item={p} locale={locale} />)}</CardGrid>
        </section>
      )}
      {(data?.trending || []).length > 0 && (
        <section>
          <SectionHeader label={locale === "zh" ? "↑ 热榜趋势" : "↑ Trending"} count={data.trending.length} color="#ff00ff" />
          <CardList>{data.trending.map((p, i) => <RankingCard key={i} item={p} rank={p.rank || i + 1} locale={locale} />)}</CardList>
        </section>
      )}

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
    </div>
  );
}

// ── Movies ──
function MoviesView({ locale, onViewDetail }) {
  const { data, loading } = useJsonData("/api/movies.json");
  const [tab, setTab] = useState("today");
  if (loading) return <LoadingSpinner locale={locale} />;
  const tabs = [
    { id: "today", zh: "今日上映", en: "Today", key: "releasedToday" },
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
  const { data, loading } = useJsonData("/api/tv.json");
  const [tab, setTab] = useState("today");
  if (loading) return <LoadingSpinner locale={locale} />;
  const tabs = [
    { id: "today", zh: "今日首播", en: "Today", key: "premieresToday" },
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
function MusicView({ locale }) {
  const { data, loading } = useJsonData("/api/music.json");
  const [tab, setTab] = useState("latest");
  // useMemo must be called before any early return (Rules of Hooks)
  const allReleases = useMemo(() => {
    if (!data) return [];
    const today = data?.releasedToday || [];
    const week = data?.releasedThisWeek || [];
    const merged = [...today, ...week.filter(a => !today.some(t => t.mbid === a.mbid))];
    return merged.sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));
  }, [data]);
  if (loading) return <LoadingSpinner locale={locale} />;
  const tabs = [
    { id: "latest", zh: "最新发行", en: "Latest Releases", dynamic: true },
    { id: "today", zh: "今日发行", en: "Today", key: "releasedToday" },
    { id: "week", zh: "本周发行", en: "This Week", key: "releasedThisWeek" },
  ];
  const current = tab === "latest" ? allReleases : (data?.[tabs.find(t => t.id === tab)?.key] || []);
  return (
    <div className="space-y-6">
      <SectionHeader label={locale === "zh" ? "音乐情报" : "Music Intelligence"} color="#ffff00" />
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-[10px] font-black pixel-font uppercase border-2 border-black transition-colors ${tab === t.id ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"}`}>
            {locale === "zh" ? t.zh : t.en}
          </button>
        ))}
      </div>
      {current.length === 0 ? (
        <p className="text-gray-500 text-xs text-center py-8">{locale === "zh" ? "暂无数据" : "No data yet"}</p>
      ) : (
        <CardGrid cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">{current.map((a, i) => <AlbumCard key={i} album={a} locale={locale} />)}</CardGrid>
      )}
    </div>
  );
}

// ── Coming Soon ──
function ComingView({ locale }) {
  const { data, loading } = useJsonData("/api/coming.json");
  const [tab, setTab] = useState("7days");
  if (loading) return <LoadingSpinner locale={locale} />;
  const tabs = [
    { id: "7days", zh: "7 天内", en: "7 Days", key: "next7Days" },
    { id: "30days", zh: "30 天内", en: "30 Days", key: "next30Days" },
    { id: "anticipated", zh: "最受期待", en: "Most Anticipated", key: "mostAnticipated" },
  ];
  const current = data?.[tabs.find(t => t.id === tab)?.key] || [];
  return (
    <div className="space-y-6">
      <SectionHeader label={locale === "zh" ? "即将上映" : "Coming Soon"} color="#ff00ff" />
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-[10px] font-black pixel-font uppercase border-2 border-black transition-colors ${tab === t.id ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"}`}>
            {locale === "zh" ? t.zh : t.en}
          </button>
        ))}
      </div>
      {current.length === 0 ? (
        <p className="text-gray-500 text-xs text-center py-8">{locale === "zh" ? "暂无数据" : "No data yet"}</p>
      ) : (
        <CardList>{current.map((item, i) => <CountdownCard key={i} item={item} locale={locale} />)}</CardList>
      )}
    </div>
  );
}

// ── Trending ──
function TrendingView({ locale }) {
  const { data, loading } = useJsonData("/api/trending.json");
  const [periodTab, setPeriodTab] = useState("today");
  const [typeTab, setTypeTab] = useState("movies");
  if (loading) return <LoadingSpinner locale={locale} />;
  const periods = [
    { id: "today", zh: "今日", en: "Today" },
    { id: "week", zh: "本周", en: "Week" },
  ];
  const types = [
    { id: "movies", zh: "电影", en: "Movies" },
    { id: "tv", zh: "剧集", en: "TV" },
    { id: "music", zh: "音乐", en: "Music" },
  ];
  const current = data?.[periodTab]?.[typeTab] || [];
  return (
    <div className="space-y-6">
      <SectionHeader label={locale === "zh" ? "热榜趋势" : "Trending Rankings"} count={current.length} color="#00ffff" />
      <div className="flex gap-2 flex-wrap">
        {periods.map(p => (
          <button key={p.id} onClick={() => setPeriodTab(p.id)}
            className={`px-3 py-1.5 text-[10px] font-black pixel-font uppercase border-2 border-black transition-colors ${periodTab === p.id ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"}`}>
            {locale === "zh" ? p.zh : p.en}
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {types.map(t => (
          <button key={t.id} onClick={() => setTypeTab(t.id)}
            className={`px-3 py-1.5 text-[10px] font-black pixel-font uppercase border-2 transition-colors ${typeTab === t.id ? "bg-[#00ffff] text-black border-[#00ffff]" : "bg-white text-black border-black hover:bg-gray-100"}`}>
            {locale === "zh" ? t.zh : t.en}
          </button>
        ))}
      </div>
      {current.length === 0 ? (
        <p className="text-gray-500 text-xs text-center py-8">{locale === "zh" ? "暂无数据" : "No data yet"}</p>
      ) : (
        <CardList>{current.map((item, i) => <RankingCard key={i} item={item} rank={item.rank || i + 1} locale={locale} />)}</CardList>
      )}
    </div>
  );
}

// ── Weekly Snapshot Dashboard ──
function WeeklyView({ locale }) {
  const { data: weeklyData, loading } = useJsonData("/api/weekly.json");
  const { data: editorData } = useJsonData("/api/editor.json");
  const { data: hiddenGemsData } = useJsonData("/api/hidden-gems.json");
  if (loading) return <LoadingSpinner locale={locale} />;
  if (!weeklyData) return <p className="text-gray-500 text-xs text-center py-8">{locale === "zh" ? "暂无数据" : "No data yet"}</p>;

  const stats = weeklyData.stats || {};
  const trendingHighlights = weeklyData.trendingHighlights || [];
  const editorsPicks = editorData?.picks?.editorsPick || [];
  const hiddenGems = hiddenGemsData?.gems || [];

  const statCards = [
    { zh: "电影上映", en: "Movies Released", num: stats.moviesReleased ?? "--", color: "#ff00ff" },
    { zh: "剧集首播", en: "TV Premieres", num: stats.tvPremieres ?? "--", color: "#00ffff" },
    { zh: "专辑发行", en: "Albums Released", num: stats.albumsReleased ?? "--", color: "#000000" },
  ];

  return (
    <div className="space-y-8">
      {/* Week Header */}
      <div className="bg-black border-4 border-[#ffff00] p-6 sm:p-8 shadow-[8px_8px_0_0_rgba(0,255,255,0.5)]">
        <h2 className="text-lg sm:text-2xl font-black text-white pixel-font mb-2">
          {locale === "zh" ? "每周快照" : "Weekly Snapshot"}
        </h2>
        <p className="text-sm text-[#ffff00] font-black">
          {weeklyData.week}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {weeklyData.date}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {statCards.map((s, i) => (
          <div key={i} className="bg-white border-4 border-black p-4 text-center shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
            <div className="text-2xl sm:text-3xl font-black pixel-font" style={{ color: s.color }}>{s.num}</div>
            <div className="text-[10px] sm:text-xs text-gray-500 mt-1">{locale === "zh" ? s.zh : s.en}</div>
          </div>
        ))}
      </div>

      {/* Editor's Picks */}
      {editorsPicks.length > 0 && (
        <section>
          <SectionHeader label={locale === "zh" ? "★ 编辑精选" : "★ Editor's Picks"} count={editorsPicks.length} color="#ff00ff" />
          <CardGrid cols="grid-cols-1 sm:grid-cols-2">{editorsPicks.map((p, i) => <SpotlightCard key={i} pick={p} locale={locale} />)}</CardGrid>
        </section>
      )}

      {/* Hidden Gems */}
      {hiddenGems.length > 0 && (
        <section>
          <SectionHeader label={locale === "zh" ? "◆ 隐藏宝藏" : "◆ Hidden Gems"} count={hiddenGems.length} color="#00ffff" />
          <CardGrid cols="grid-cols-1 sm:grid-cols-2">{hiddenGems.map((p, i) => <SpotlightCard key={i} pick={p} locale={locale} />)}</CardGrid>
        </section>
      )}

      {/* Trending Highlights */}
      {trendingHighlights.length > 0 && (
        <section>
          <SectionHeader label={locale === "zh" ? "↑ 本周趋势" : "↑ Trending Highlights"} count={trendingHighlights.length} color="#ff00ff" />
          <CardList>{trendingHighlights.map((item, i) => (
            <RankingCard key={i} item={item} rank={item.rank || i + 1} locale={locale} />
          ))}</CardList>
        </section>
      )}

      {/* One Minute Summary */}
      {weeklyData.oneMinuteSummary && (
        <section>
          <SectionHeader label={locale === "zh" ? "☕ 一分钟摘要" : "☕ One Minute Summary"} color="#ffff00" />
          <div className="bg-black border-4 border-[#ff00ff] p-5 shadow-[6px_6px_0_0_rgba(0,255,255,0.3)]">
            <p className="text-sm text-gray-200 leading-relaxed">{locale === "en" ? (weeklyData.oneMinuteSummaryEn || weeklyData.oneMinuteSummary) : weeklyData.oneMinuteSummary}</p>
            <p className="text-[10px] text-gray-500 mt-3 pixel-font">
              {locale === "zh" ? "更新于 " : "Updated "}{weeklyData.updated || ""}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

// ── AI Spotlight ──
function SpotlightView({ locale }) {
  const { data, loading } = useJsonData("/api/editor.json");
  if (loading) return <LoadingSpinner locale={locale} />;
  const picks = data?.picks || {};
  const categories = Object.keys(picks).filter(k => picks[k]?.length > 0);
  if (categories.length === 0) return <p className="text-gray-500 text-xs text-center py-8">{locale === "zh" ? "暂无 AI 精选数据" : "No AI picks yet"}</p>;

  const catColors = {
    editorsPick: "#ff00ff", hiddenGem: "#00ffff", mostAnticipated: "#ffff00",
    familyChoice: "#ff8800", sciFi: "#00ff88", horror: "#ff0044", documentary: "#8888ff",
  };
  const catLabels = {
    editorsPick: { zh: "编辑精选", en: "Editor's Pick" },
    hiddenGem: { zh: "隐藏宝藏", en: "Hidden Gem" },
    mostAnticipated: { zh: "最受期待", en: "Most Anticipated" },
    familyChoice: { zh: "家庭之选", en: "Family Choice" },
    sciFi: { zh: "科幻之选", en: "Sci-Fi Pick" },
    horror: { zh: "恐怖之选", en: "Horror Pick" },
    documentary: { zh: "纪录之选", en: "Documentary Pick" },
  };
  return (
    <div className="space-y-10">
      <SectionHeader label={locale === "zh" ? "AI 精选" : "AI Spotlight"} color="#ff00ff" />
      {categories.map(cat => (
        <section key={cat}>
          <SectionHeader label={locale === "zh" ? catLabels[cat]?.zh : catLabels[cat]?.en} count={picks[cat].length} color={catColors[cat] || "#ff00ff"} />
          <CardGrid cols="grid-cols-1 sm:grid-cols-2">{picks[cat].map((p, i) => <SpotlightCard key={i} pick={{ ...p, category: cat }} locale={locale} />)}</CardGrid>
        </section>
      ))}
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

  const allItems = useMemo(() => {
    const items = [];
    const add = (list, type) => { if (Array.isArray(list)) list.forEach(item => items.push({ ...item, _type: type })); };
    // Flatten movies
    if (movies) { add(movies.releasedToday, "movie"); add(movies.releasedThisWeek, "movie"); add(movies.upcoming, "movie"); add(movies.nowPlaying, "movie"); }
    if (tv) { add(tv.premieresToday, "tv"); add(tv.premieresThisWeek, "tv"); add(tv.upcoming, "tv"); add(tv.ongoing, "tv"); }
    if (music) { add(music.releasedToday, "album"); add(music.releasedThisWeek, "album"); }
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
        <p className="text-gray-500 text-xs pixel-font mt-1 tracking-wider">{t('tagline')}</p>
      </header>

      {/* Top bar */}
      <div className="max-w-6xl mx-auto px-4 pt-3 pb-1 flex items-center justify-end">
        <div className="flex items-center gap-2">
          <button onClick={toggleLocale} className="w-7 h-7 sm:w-8 sm:h-8 bg-[#ff00ff] border-2 border-black text-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors font-black text-[10px] sm:text-xs flex-shrink-0" style={LANG_BUTTON_STYLE}>
            {locale === "zh" ? "En" : "中"}
          </button>
          <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="sm:hidden w-8 h-8 bg-black border-2 border-[#ffff00] text-[#ffff00] flex items-center justify-center font-black text-sm">
            {mobileNavOpen ? "X" : "☰"}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-0">
        {/* Sidebar */}
        <aside className={`sm:w-48 sm:min-h-[calc(100vh-200px)] sm:block sm:border-r-4 sm:border-[#ff00ff] sm:bg-black/60 ${mobileNavOpen ? "block" : "hidden"}`}>
          <nav className="flex sm:flex-col overflow-x-auto sm:overflow-x-visible p-2 sm:p-0 gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = IconComp(item.icon);
              const active = activeNav === item.id;
              return (
                <button key={item.id} onClick={() => { navigate(item.id === "overview" ? "/intelligence" : `/intelligence/${item.id}`); setMobileNavOpen(false); }}
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
          {activeNav === "overview" && <OverviewView locale={locale} />}
          {activeNav === "movies" && <MoviesView locale={locale} onViewDetail={(item) => handleViewDetail(item, "movie")} />}
          {activeNav === "tv" && <TVView locale={locale} onViewDetail={(item) => handleViewDetail(item, "tv")} />}
          {activeNav === "music" && <MusicView locale={locale} />}
          {activeNav === "coming" && <ComingView locale={locale} />}
          {activeNav === "trending" && <TrendingView locale={locale} />}
          {activeNav === "weekly" && <WeeklyView locale={locale} />}
          {activeNav === "spotlight" && <SpotlightView locale={locale} />}
          {activeNav === "search" && <SearchView locale={locale} onViewDetail={(item, type) => handleViewDetail(item, type)} />}
        </main>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 w-full z-10 text-center py-3 bg-black border-t-4 border-[#ffff00] text-white text-xs pixel-font uppercase tracking-widest">
        <p>
          <Link to="/discover" className="hover:text-[#ffff00] transition-colors">Discover</Link>
          <span className="text-gray-600 mx-2">|</span>
          <Link to="/" className="hover:text-[#00ffff] transition-colors">Home</Link>
          <span className="text-gray-600 mx-2">|</span>
          <a href="mailto:rexhr@yahoo.com" className="hover:text-[#ffff00] transition-colors">Contact</a>
          <span className="text-gray-600 mx-2">|</span>
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
