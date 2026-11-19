import React, { useState, useEffect } from "react";
import { useJsonData } from "../../hooks/useJsonData";
import { SectionHeader, WallStyleCard } from "../Cards";
import { useLocale } from "../../i18n";

const TAG_FILTERS = [
  { id: "trending", zh: "🔥 热门趋势", en: "🔥 Trending Now" },
  { id: "editor", zh: "⭐ 编辑推荐", en: "⭐ Editor's Pick" },
  { id: "hidden", zh: "💎 隐藏宝石", en: "💎 Hidden Gem" },
  { id: "world", zh: "🌍 环球音乐", en: "🌍 Around the World" },
];

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

function MusicView({ locale, onViewDetail }) {
  const { data, loading, error, retry } = useJsonData("/api/music.json");
  const [tagFilter, setTagFilter] = useState("all");
  if (loading) return <LoadingSpinner locale={locale} />;
  if (error) return <DataError locale={locale} onRetry={retry} />;

  const picks = data?.picks || [];
  const current = tagFilter === "all" ? picks : picks.filter(a => a.recommendationTagId === tagFilter);
  const zhLocale = locale === "zh";

  const musicReleaseInfo = (a) => {
    if (!zhLocale) {
      const srcEn = a.highlightEn || a.summaryEn || "";
      const m = srcEn.match(/New ([a-z\- ]+?)(?: from|·|$)/i);
      return m ? `New ${m[1].trim()}` : "New Release";
    }
    const hl = a.highlight || "";
    const m = hl.match(/([\u4e00-\u9fffA-Za-z\-]+?)发行/);
    return m ? `${m[1]}发行` : "新专辑发行";
  };

  const listenersRibbon = (a) => {
    const l = a.listeners || 0;
    if (!l) return undefined;
    return l >= 1000000 ? `${(l / 1000000).toFixed(1)}M` : l >= 1000 ? `${Math.round(l / 1000)}K` : String(l);
  };

  return (
    <div className="space-y-6">
      <SectionHeader label={locale === "zh" ? "本周精选" : "This Week's Picks"} color="#ffff00" />
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setTagFilter("all")}
          className={`px-3 py-1.5 text-[10px] font-black pixel-font uppercase border-2 border-black transition-colors ${tagFilter === "all" ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"}`}
        >
          {locale === "zh" ? "全部" : "All"}
          <span className="ml-1 opacity-60">({picks.length})</span>
        </button>
        {TAG_FILTERS.map(f => (
          <button key={f.id} onClick={() => setTagFilter(f.id)}
            className={`px-3 py-1.5 text-[10px] font-black pixel-font uppercase border-2 border-black transition-colors ${tagFilter === f.id ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"}`}
          >
            {locale === "en" ? f.en : f.zh}
            <span className="ml-1 opacity-60">({picks.filter(a => a.recommendationTagId === f.id).length})</span>
          </button>
        ))}
      </div>
      {current.length === 0 ? (
        <p className="text-gray-500 text-xs text-center py-8">{locale === "zh" ? "暂无数据" : "No data yet"}</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-sm:gap-2">
          {current.map((a, i) => (
            <WallStyleCard key={`${tagFilter}-${a.mbid || a.title}-${i}`} item={a} locale={locale}
              subBadge={zhLocale ? "音乐" : "MUSIC"} subBadgeColor="#ffff00"
              ribbon={listenersRibbon(a)} ribbonColor="#ffff00"
              metaLine={musicReleaseInfo(a)}
              onClick={(item) => onViewDetail(item, "album")} />
          ))}
        </div>
      )}
    </div>
  );
}

export default MusicView;