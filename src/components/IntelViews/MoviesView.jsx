import React, { useState, useEffect } from "react";
import { useJsonData } from "../../hooks/useJsonData";
import { SectionHeader, WallStyleCard } from "../Cards";
import { useLocale } from "../../i18n";

function LoadingSpinner({ locale }) {
  return (
    <div className="flex items-center justify-center py-16">
      <span className="text-gray-500 text-xs pixel-font">{locale === "zh" ? "数据加载中..." : "Loading..."}</span>
    </div>
  );
}

function DataError({ locale, onRetry }) {
  return (
    <div className="text-center py-8">
      <p className="text-red-400 text-xs pixel-font mb-4">
        {locale === "zh" ? "数据加载失败，请稍后重试" : "Failed to load data. Please retry."}
      </p>
      <button
        onClick={onRetry}
        className="inline-block px-6 py-2 text-xs font-black bg-[#ffff00] border-4 border-black pixel-font uppercase shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all"
      >
        {locale === "zh" ? "重试" : "RETRY"}
      </button>
    </div>
  );
}

function MoviesView({ locale, onViewDetail }) {
  const { data, loading, error, retry } = useJsonData("/api/movies.json");
  const [tab, setTab] = useState("week");
  if (loading) return <LoadingSpinner locale={locale} />;
  if (error) return <DataError locale={locale} onRetry={retry} />;

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
            className={`px-3 py-1.5 text-[10px] font-black pixel-font uppercase border-2 border-black transition-colors ${tab === t.id ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"}`}
          >
            {locale === "zh" ? t.zh : t.en}
            {data?.[t.key]?.length > 0 && <span className="ml-1 opacity-60">({data[t.key].length})</span>}
          </button>
        ))}
      </div>
      {current.length === 0 ? (
        <p className="text-gray-500 text-xs text-center py-8">{locale === "zh" ? "暂无数据" : "No data yet"}</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-sm:gap-2">
          {current.map((m, i) => (
            <WallStyleCard key={`${tab}-${m.tmdbId}-${i}`} item={m} locale={locale}
              subBadge={locale === "zh" ? "电影" : "MOVIE"} subBadgeColor="#ff00ff"
              onClick={(item) => onViewDetail(item, "movie")} />
          ))}
        </div>
      )}
    </div>
  );
}

export default MoviesView;