import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";
import SubscribeSection from "./SubscribeSection";
import DetailOverlay from "./DetailOverlay";
import SiteFooter from "./SiteFooter";
import { setCanonical } from "../services/seo";
import { useJsonData } from "../hooks/useJsonData";
import OverviewView from "./IntelViews/OverviewView";
import MoviesView from "./IntelViews/MoviesView";
import TVView from "./IntelViews/TVView";
import MusicView from "./IntelViews/MusicView";
import SearchView from "./IntelViews/SearchView";
import { IntelDetailModal } from "./DetailModals";

const LANG_BUTTON_STYLE = {
  fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
};

const NAV_ITEMS = [
  { id: "overview", icon: "Target", color: "#ff00ff", zh: "总览", en: "Overview" },
  { id: "movies", icon: "Film", color: "#ff00ff", zh: "电影", en: "Movies" },
  { id: "tv", icon: "Tv", color: "#00ffff", zh: "剧集", en: "TV" },
  { id: "music", icon: "Music", color: "#ffff00", zh: "音乐", en: "Music" },
  { id: "search", icon: "Search", color: "#00ffff", zh: "搜索", en: "Search" },
];

function IntelligencePage() {
  const { t, locale, toggleLocale } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const match = location.pathname.match(/^\/intelligence(?:\/(\w+))?/);
  const sectionId = match?.[1] || "overview";
  const activeNav = NAV_ITEMS.some(n => n.id === sectionId) ? sectionId : "overview";
  const [detailItem, setDetailItem] = useState(null);
  const [detailType, setDetailType] = useState("movie");

  const handleViewDetail = (item, type) => {
    setDetailItem(item);
    setDetailType(type || "movie");
  };

  useEffect(() => {
    setDetailItem(null);
  }, [activeNav]);

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
          <h1 className="text-base sm:text-2xl font-black text-white pixel-font uppercase tracking-widest drop-shadow-[4px_4px_0_#ff00ff] max-sm:whitespace-normal sm:whitespace-nowrap break-words overflow-anywhere leading-tight" style={{fontFamily:"'Press Start 2P','Courier New',Courier,monospace"}}>
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
                  className={`flex items-center gap-2 px-3 py-2.5 sm:py-3 w-full text-left transition-colors border-l-4 ${active ? "bg-gray-900 border-[#ffff00] text-white" : "border-transparent text-gray-400 hover:bg-gray-900/50 hover:text-white"}`}
                >
                  <span className={`w-5 h-5 flex-shrink-0 ${active ? "text-white" : "text-gray-600"}`}><Icon className="w-5 h-5" /></span>
                  <span className="text-[10px] sm:text-xs font-black pixel-font whitespace-nowrap">{locale === "zh" ? item.zh : item.en}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main content — list stays mounted; detail renders as a full-screen
            overlay above it (site-wide standard, 2026-08-24). Closing restores
            scroll/tab/filter state with zero refetch. */}
        <main className="flex-1 px-3 sm:px-6 py-4 sm:py-6 min-w-0">
          <>
            {activeNav === "overview" && <OverviewView locale={locale} onViewDetail={(item, type) => handleViewDetail(item, type)} />}
            {activeNav === "movies" && <MoviesView locale={locale} onViewDetail={(item, type) => handleViewDetail(item, type || "movie")} />}
            {activeNav === "tv" && <TVView locale={locale} onViewDetail={(item, type) => handleViewDetail(item, type || "tv")} />}
            {activeNav === "music" && <MusicView locale={locale} onViewDetail={(item, type) => handleViewDetail(item, type || "album")} />}
            {activeNav === "search" && <SearchView locale={locale} onViewDetail={(item, type) => handleViewDetail(item, type)} />}
          </>
        </main>
        {detailItem && (
          <DetailOverlay onClose={() => setDetailItem(null)}>
            <IntelDetailModal item={detailItem} type={detailType} locale={locale} onClose={() => setDetailItem(null)} />
          </DetailOverlay>
        )}
      </div>

      <SubscribeSection locale={locale} />

      {/* Lang + Share floating group */}
      <div className="fixed bottom-[116px] sm:bottom-[128px] right-3 sm:right-4 z-40 flex flex-col gap-2">
        <button onClick={toggleLocale}
          className="w-7 h-7 sm:w-8 sm:h-8 bg-[#ff00ff] border-2 border-black text-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors font-black text-[10px] sm:text-xs shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none"
          style={LANG_BUTTON_STYLE}>
          {locale === "zh" ? "En" : "中"}
        </button>
      </div>

      <SiteFooter />
    </div>
  );
}

export default IntelligencePage;