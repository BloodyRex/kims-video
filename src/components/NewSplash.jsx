import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLocale } from "../i18n";
import { Icons } from "./Icons";

/**
 * NewSplash — 四宫格沉浸式开屏（2026-08 新主页设计）
 * 移植自 kim_s_video_application.html 的 renderSplash。
 * AI Search 卡片进入引擎（onEnterAI），其余三张链接到现有路由。
 */
const CARDS = [
  {
    id: "ai-search",
    targetStep: "input",
    // Rex 2026-08-25: titles now bilingual (were hardcoded EN — zh users saw
    // English card titles that never switched with the language toggle)
    titleZh: "AI 搜索",
    titleEn: "AI Search",
    subtitleZh: "AI 推荐",
    subtitleEn: "AI Picks",
    descZh: "输入喜欢的电影，AI 为你精准推荐合口味的作品。",
    descEn: "Tell us what you love, get AI-matched picks.",
    bgImg: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80",
    h: "/entry/ai-search-h.png",
    v: "/entry/ai-search-v.png",
    badgeBg: "bg-[#ff00ff]",
    shadowColor: "#ff00ff",
    accent: "text-[#00ffff]",
    to: null, // handled by onEnterAI
  },
  {
    id: "discover",
    targetStep: "discover",
    titleZh: "社区发现",
    titleEn: "Discover",
    subtitleZh: "社区发现",
    subtitleEn: "Curated Picks",
    descZh: "编辑与社区精选的电影合辑、专题盘点。",
    descEn: "Hand-picked collections and editor's choices.",
    bgImg: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80",
    h: "/entry/discover-h.png",
    v: "/entry/discover-v.png",
    badgeBg: "bg-[#00ffff]",
    shadowColor: "#00ffff",
    accent: "text-[#ffff00]",
    to: "/discover",
  },
  {
    id: "intelligence",
    targetStep: "intelligence",
    titleZh: "全球影音",
    titleEn: "Intelligence",
    subtitleZh: "全球影音",
    subtitleEn: "Intel Center",
    descZh: "影讯、剧集、音乐与每周情报速览。",
    descEn: "Movie, TV & music news at a glance.",
    bgImg: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80",
    h: "/entry/intelligence-h.png",
    v: "/entry/intelligence-v.png",
    badgeBg: "bg-[#ffff00]",
    shadowColor: "#ffff00",
    accent: "text-[#ff00ff]",
    to: "/intelligence",
  },
  {
    id: "movie-wall",
    targetStep: "wall",
    titleZh: "影视墙",
    titleEn: "Movie Wall",
    subtitleZh: "影视墙",
    subtitleEn: "Movie Wall",
    descZh: "浏览你的电影收藏墙，按日期排布的影史长卷。",
    descEn: "Your film collection, arranged by release date.",
    bgImg: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=1200&q=80",
    h: "/entry/wall-h.png",
    v: "/entry/wall-v.png",
    badgeBg: "bg-[#00dd00]",
    shadowColor: "#00dd00",
    accent: "text-[#00ffff]",
    to: "/wall",
  },
];

const NewSplash = ({ onEnterAI }) => {
  const { locale, tArray } = useLocale();
  const zh = locale === "zh";
  const quotes = tArray("loading.quotes");
  const [quoteIdx, setQuoteIdx] = useState(0);

  // 轮动句子（与 AI search 加载页一致，2.5~3.5s 随机切换）
  useEffect(() => {
    if (!quotes.length) return;
    let timer;
    const next = () => {
      setQuoteIdx((prev) => {
        if (quotes.length < 2) return prev;
        let n = prev;
        while (n === prev) n = Math.floor(Math.random() * quotes.length);
        return n;
      });
      timer = setTimeout(next, 2500 + Math.random() * 1000);
    };
    timer = setTimeout(next, 2500 + Math.random() * 1000);
    return () => clearTimeout(timer);
  }, [quotes]);

  const tagline = quotes.length ? quotes[quoteIdx] : "";

  const renderCard = (card, index) => {
    const inner = (
      <div
        className="group relative h-[280px] md:h-[320px] border-8 border-black overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-2 bg-[#111]"
        style={{ boxShadow: `12px 12px 0 0 ${card.shadowColor}` }}
      >
        {/* Landscape (desktop) — 本地横屏图 */}
        <img
          src={card.h}
          alt={card.title}
          loading="lazy"
          className="hidden md:block w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {/* Portrait (mobile) — 本地竖屏图 */}
        <img
          src={card.v}
          alt={card.title}
          loading="lazy"
          className="md:hidden w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent"></div>
        <div className="absolute inset-0 border-2 border-transparent group-hover:border-[#ffff00] transition-colors pointer-events-none z-10"></div>

        <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-between z-20">
          <div className="flex justify-start items-start">
            {/* Rex 2026-08-25: "ARCHIVE ENTRY" badge removed; the SEC.NN frame
                moved here (top-left) as its replacement */}
            <span className="text-white font-mono text-xs bg-black/80 px-2 py-1 border border-white/40">
              SEC.0{index + 1}
            </span>
          </div>

          <div>
            <h3 className="text-3xl md:text-4xl font-black mb-1 uppercase tracking-tight pixel-font text-white drop-shadow-[3px_3px_0_#000]">
              {zh ? card.titleZh : card.titleEn}
            </h3>
            <h4 className={`text-sm md:text-base font-bold mb-3 ${card.accent}`}>
              {zh ? card.subtitleZh : card.subtitleEn}
            </h4>
            <p className="text-gray-300 text-xs md:text-sm font-medium line-clamp-2 bg-black/60 p-2.5 border-l-4 border-[#ff00ff]">
              {zh ? card.descZh : card.descEn}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/20">
            <span className="text-xs font-bold text-[#ffff00] uppercase tracking-wider pixel-font group-hover:translate-x-2 transition-transform inline-flex items-center">
              {zh ? "点击进入系统 >>" : "Enter System >>"}
            </span>
            <div className="w-8 h-8 bg-white text-black border-2 border-black flex items-center justify-center font-black group-hover:bg-[#ffff00] transition-colors">
              <Icons.ChevronRight className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>
    );

    if (card.to) {
      return (
        <Link key={card.id} to={card.to} className="block">
          {inner}
        </Link>
      );
    }
    return (
      <div key={card.id} onClick={onEnterAI} className="block">
        {inner}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 min-h-[85vh] flex flex-col justify-center">
      {/* 顶栏精简标题 */}
      <div className="text-center mb-12">
        <h2
          className="text-2xl md:text-4xl font-black text-white tracking-wider uppercase pixel-font mb-6"
          style={{ textShadow: "3px 3px 0 #ff00ff" }}
        >
          KIM'S <span className="text-[#00ffff]">VIDEO ARCHIVE</span>
        </h2>
        <p
          key={quoteIdx}
          className="text-gray-400 text-xs md:text-sm font-bold bg-black inline-block px-3 py-1 border border-[#00ffff] transition-opacity duration-500 animate-[fadeIn_0.5s_ease]"
        >
          {tagline || (zh ? "四扇门，通往你想要的每一部电影。" : "Four doors. Every film you want, one click away.")}
        </p>
      </div>

      {/* 四张全景满铺卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {CARDS.map((card, i) => renderCard(card, i))}
      </div>
    </div>
  );
};

export default NewSplash;
