import React, { useState, useEffect, useMemo } from "react";
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

function OverviewView({ locale, onViewDetail }) {
  const { data, loading, error, retry } = useJsonData("/api/overview.json");
  const { data: musicData } = useJsonData("/api/music.json");
  const { data: digestData } = useJsonData("/api/digest.json");
  
  const musicSix = useMemo(() => {
    return [...(musicData?.picks || [])]
      .sort((a, b) => (b.listeners || 0) - (a.listeners || 0))
      .slice(0, 6);
  }, [musicData]);

  if (loading) return <LoadingSpinner locale={locale} />;
  if (error) return <DataError locale={locale} onRetry={retry} />;
  const zhLocale = locale === "zh";

  const editorMovies = data?.editorsPicks || [];
  const hotTv = data?.weeklyHotTv || [];
  const comingMovies = data?.comingSoon || [];
  const comingTv = data?.comingSoonTv || [];

  const wallGrid = "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-sm:gap-2";

  const countdownRibbon = (days) => {
    if (typeof days !== "number") return undefined;
    if (days === 0) return zhLocale ? "今天" : "TODAY";
    if (days === 1) return zhLocale ? "明天" : "1D";
    return zhLocale ? `${Math.min(days, 99)} 天后` : `${Math.min(days, 99)}D`;
  };

  const detailTypeOf = (pickCategory) => (pickCategory === "tvhot" ? "tv" : "movie");

  return (
    <div className="space-y-8">
      {(digestData?.headline || digestData?.topTrends?.length > 0) && (
        <section>
          <SectionHeader label={locale === "zh" ? "☎ 每日摘要" : "☎ Daily Digest"} color="#ff00ff" />
          <div className="bg-black border-4 border-[#ffff00] p-5 shadow-[6px_6px_0_0_rgba(0,255,255,0.3)]">
            {digestData.headline ? (
              <>
                <h3 className="text-base font-black text-[#ffff00] mb-2">{locale === "en" ? (digestData.headlineEn || digestData.headline) : digestData.headline}</h3>
                <p className="text-sm text-gray-200 leading-relaxed">{locale === "en" ? (digestData.summaryEn || digestData.summary) : digestData.summary}</p>
              </>
            ) : (
              <p className="text-sm text-gray-400 leading-relaxed mb-2">
                {locale === "zh" ? "AI 总结生成中，先看看今日热点：" : "AI summary is being generated — top trends today:"}
              </p>
            )}
            {digestData.topTrends?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {digestData.topTrends.map((tr, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 bg-[#ff00ff] text-black font-black">#{locale === "en" ? (tr.titleEn || tr.title) : tr.title}</span>
                ))}
              </div>
            )}
            <p className="text-[10px] text-gray-500 mt-2 pixel-font">
              {locale === "zh" ? "数据更新于 " : "Data updated "}{digestData.date || data?.updated || ""}
            </p>
          </div>
        </section>
      )}

      {(editorMovies.length > 0 || hotTv.length > 0 || musicSix.length > 0) && (
        <section>
          <SectionHeader label={locale === "zh" ? "★ 编辑精选" : "★ Editor's Picks"} count={editorMovies.length + hotTv.length + musicSix.length} color="#ff00ff" />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-sm:gap-2">
            {editorMovies.map((p, i) => (
              <WallStyleCard key={`m-${p.tmdbId}-${i}`} item={p} locale={locale}
                subBadge={zhLocale ? "电影" : "MOVIE"} subBadgeColor="#ff00ff"
                onClick={(item) => onViewDetail(item, "movie")} />
            ))}
            {hotTv.map((s, i) => (
              <WallStyleCard key={`tv-${s.tmdbId}-${i}`} item={s} locale={locale}
                subBadge={zhLocale ? "剧集" : "TV"} subBadgeColor="#00ffff"
                onClick={(item) => onViewDetail(item, "tv")} />
            ))}
            {musicSix.map((a, i) => (
              <WallStyleCard key={`mu-${a.mbid || a.title}-${i}`} item={a} locale={locale}
                subBadge={zhLocale ? "音乐" : "MUSIC"} subBadgeColor="#ffff00"
                onClick={(item) => onViewDetail(item, "album")} />
            ))}
          </div>
        </section>
      )}

      {(comingMovies.length > 0 || comingTv.length > 0) && (
        <section>
          <SectionHeader label={locale === "zh" ? "▶ 即将上映" : "▶ Coming Soon"} count={comingMovies.length + comingTv.length} color="#ffff00" />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-sm:gap-2">
            {comingMovies.map((m, i) => (
              <WallStyleCard key={`cm-${m.tmdbId}-${i}`} item={m} locale={locale}
                ribbon={(m.daysUntil === 0 ? (zhLocale ? "今天" : "TODAY") : m.daysUntil === 1 ? (zhLocale ? "明天" : "1D") : zhLocale ? `${m.daysUntil} 天后` : `${m.daysUntil}D`)} ribbonColor="#ff00ff"
                subBadge={zhLocale ? "电影" : "MOVIE"} subBadgeColor="#ff00ff"
                onClick={(item) => onViewDetail(item, "movie")} />
            ))}
            {comingTv.map((s, i) => (
              <WallStyleCard key={`ct-${s.tmdbId}-${i}`} item={s} locale={locale}
                ribbon={(s.daysUntil === 0 ? (zhLocale ? "今天" : "TODAY") : s.daysUntil === 1 ? (zhLocale ? "明天" : "1D") : zhLocale ? `${s.daysUntil} 天后` : `${s.daysUntil}D`)} ribbonColor="#00ffff"
                subBadge={zhLocale ? "剧集" : "TV"} subBadgeColor="#00ffff"
                onClick={(item) => onViewDetail(item, "tv")} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default OverviewView;