import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useLocale } from "../i18n";
import { setCanonical } from "../services/seo";

/**
 * Entry page — full-viewport 4-card portal (AI Search / Discover / Intelligence / Wall).
 *
 * Layout: 2×2 grid filling the whole screen (desktop + mobile), no scrolling.
 * Each card shows its zh + en title overlaid on the image.
 *
 * ⚠️ TEMPORARY HOMING: this page currently lives at /recommend as a hidden test page.
 * The AI recommender engine still owns `/`. When the entry page goes live, SWAP the
 * two routes (`/` → EntryPage, `/recommend` → engine), update AI_SEARCH_TARGET
 * to "/recommend", and update ENTRY_ROUTE in App.jsx (ShareButton hide logic).
 */
const AI_SEARCH_TARGET = "/"; // engine home (swap to "/recommend" when routes swap)

const CARDS = [
  {
    id: "ai-search", to: AI_SEARCH_TARGET,
    h: "/entry/ai-search-h.png", v: "/entry/ai-search-v.png",
    zh: "AI 搜索", en: "AI SEARCH",
  },
  {
    id: "discover", to: "/discover",
    h: "/entry/discover-h.png", v: "/entry/discover-v.png",
    zh: "精选合辑", en: "DISCOVER",
  },
  {
    id: "intelligence", to: "/intelligence",
    h: "/entry/intelligence-h.png", v: "/entry/intelligence-v.png",
    zh: "情报中心", en: "INTELLIGENCE",
  },
  {
    id: "wall", to: "/wall",
    h: "/entry/wall-h.png", v: "/entry/wall-v.png",
    zh: "电影墙", en: "MOVIE WALL",
  },
];

const EntryPage = () => {
  const { locale } = useLocale();

  useEffect(() => {
    document.title = locale === "zh"
      ? "Kim's Video — 影视娱乐入口"
      : "Kim's Video — Entertainment Portal";
    setCanonical("https://bloodyrex.xyz/");
  }, [locale]);

  return (
    <div className="h-dvh w-full overflow-hidden graffiti-bg grid grid-cols-2 grid-rows-2 entry-page">
      {CARDS.map((card) => (
        <Link
          key={card.id}
          to={card.to}
          className="relative block overflow-hidden group"
        >
          {/* Landscape (desktop) */}
          <img
            src={card.h}
            alt={card.zh}
            loading="lazy"
            className="hidden md:block w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {/* Portrait (mobile) */}
          <img
            src={card.v}
            alt={card.zh}
            loading="lazy"
            className="md:hidden w-full h-full object-cover"
          />
          {/* Title overlay: zh + en */}
          <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1.5 sm:py-2.5 text-center">
            <span className="block text-white font-black text-sm sm:text-lg leading-tight drop-shadow-[2px_2px_0_rgba(0,0,0,0.8)]">
              {card.zh}
            </span>
            <span className="block text-[#00ffff] pixel-font text-[9px] sm:text-xs uppercase tracking-widest mt-0.5">
              {card.en}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default EntryPage;
