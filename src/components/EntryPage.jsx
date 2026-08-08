import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useLocale } from "../i18n";
import { setCanonical } from "../services/seo";

const LANG_BUTTON_STYLE = {
  fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
};

/**
 * Entry page — minimal 4-card portal (AI Search / Discover / Intelligence / Wall).
 *
 * ⚠️ TEMPORARY HOMING: this page currently lives at /recommend as a hidden test page.
 * The AI recommender engine still owns `/`. When the entry page goes live, SWAP the
 * two routes (`/` → EntryPage, `/recommend` → engine) and update AI_SEARCH_TARGET
 * to "/recommend".
 */
const AI_SEARCH_TARGET = "/"; // engine home (swap to "/recommend" when routes swap)

const CARDS = [
  { id: "ai-search", to: AI_SEARCH_TARGET, h: "/entry/ai-search-h.png", v: "/entry/ai-search-v.png" },
  { id: "discover", to: "/discover", h: "/entry/discover-h.png", v: "/entry/discover-v.png" },
  { id: "intelligence", to: "/intelligence", h: "/entry/intelligence-h.png", v: "/entry/intelligence-v.png" },
  { id: "wall", to: "/wall", h: "/entry/wall-h.png", v: "/entry/wall-v.png" },
];

const EntryPage = () => {
  const { locale, toggleLocale } = useLocale();

  useEffect(() => {
    document.title = locale === "zh"
      ? "Kim's Video — 影视娱乐入口"
      : "Kim's Video — Entertainment Portal";
    setCanonical("https://bloodyrex.xyz/");
  }, [locale]);

  return (
    <div className={`min-h-screen graffiti-bg text-black py-8 entry-page locale-${locale}`}>
      {/* 4-card grid: 2×2 landscape on desktop, stacked portrait on mobile */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {CARDS.map((card) => (
          <Link
            key={card.id}
            to={card.to}
            className="block bg-white border-4 border-black overflow-hidden shadow-[8px_8px_0_0_#000] hover:-translate-y-1 hover:shadow-[10px_10px_0_0_#ff00ff] active:translate-y-0.5 active:shadow-[4px_4px_0_0_#000] transition-all"
          >
            {/* Landscape (desktop) */}
            <img src={card.h} alt={card.id} loading="lazy" className="hidden md:block w-full h-auto" />
            {/* Portrait (mobile) */}
            <img src={card.v} alt={card.id} loading="lazy" className="md:hidden w-full h-auto" />
          </Link>
        ))}
      </div>

      {/* Lang floating button — same position as other pages */}
      <div className="fixed bottom-[116px] sm:bottom-[128px] right-3 sm:right-4 z-40">
        <button
          onClick={toggleLocale}
          className="w-7 h-7 sm:w-8 sm:h-8 bg-[#ff00ff] border-2 border-black text-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors font-black text-[10px] sm:text-xs shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none"
          style={LANG_BUTTON_STYLE}
        >
          {locale === "zh" ? "En" : "中"}
        </button>
      </div>
    </div>
  );
};

export default EntryPage;
