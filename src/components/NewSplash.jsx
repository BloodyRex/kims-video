import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLocale } from "../i18n";
import { Icons } from "./Icons";
import MyDataPanel from "./MyDataPanel";

/**
 * NewSplash — 四宫格沉浸式开屏（2026-08 新主页设计）
 * 移植自 kim_s_video_application.html 的 renderSplash。
 * AI Search 卡片进入引擎（onEnterAI），其余三张链接到现有路由。
 */
const CARDS = [
  {
    id: "ai-search",
    targetStep: "input",
    // Rex 2026-08-25: fixed bilingual pairing — big EN title + small CN subtitle,
    // identical in BOTH languages (does not switch with the language toggle)
    title: "AI Search",
    subtitleZh: "AI 推荐",
    descZh: "输入喜欢的电影，AI 为你精准推荐合口味的作品。",
    descEn: "Tell us what you love, get AI-matched picks.",
    bgImg: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80",
    h: "/entry/ai-search-h.png",
    v: "/entry/ai-search-v.png",
    badgeBg: "bg-[#ff00ff]",
    shadowColor: "#ff00ff",
    accent: "text-[#ffffff]",
    to: null, // handled by onEnterAI
  },
  {
    id: "discover",
    targetStep: "discover",
    title: "Discover",
    subtitleZh: "社区发现",
    descZh: "编辑与社区精选的电影合辑、专题盘点。",
    descEn: "Hand-picked collections and editor's choices.",
    bgImg: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80",
    h: "/entry/discover-h.png",
    v: "/entry/discover-v.png",
    badgeBg: "bg-[#00ffff]",
    shadowColor: "#ff00ff",
    accent: "text-[#ffffff]",
    to: "/discover",
  },
  {
    id: "intelligence",
    targetStep: "intelligence",
    title: "Intelligence",
    subtitleZh: "全球影音",
    descZh: "影讯、剧集、音乐与每周情报速览。",
    descEn: "Movie, TV & music news at a glance.",
    bgImg: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80",
    h: "/entry/intelligence-h.png",
    v: "/entry/intelligence-v.png",
    badgeBg: "bg-[#ffff00]",
    shadowColor: "#ffff00",
    accent: "text-[#ffffff]",
    to: "/intelligence",
  },
  {
    id: "movie-wall",
    targetStep: "wall",
    title: "Movie Wall",
    subtitleZh: "影视墙",
    descZh: "浏览你的电影收藏墙，按日期排布的影史长卷。",
    descEn: "Your film collection, arranged by release date.",
    bgImg: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=1200&q=80",
    h: "/entry/wall-h.png",
    v: "/entry/wall-v.png",
    badgeBg: "bg-[#00dd00]",
    shadowColor: "#ffff00",
    accent: "text-[#ffffff]",
    to: "/wall",
  },
];

// 电影节日历入口文案（2026-10-14）—— 与 CARDS 同一套字段：中文名 + 一句话简介。
// 原副标题「全球电影节排片日历 · 官方一手数据」是标语、不是中文名，已并入简介句。
const FESTIVAL_ENTRY = {
  title: "Festival Calendar",
  subtitleZh: "电影节日历",
  descZh: "全球电影节排片日历 · 官方一手数据。",
  descEn: "Global film festival schedules, straight from official sources.",
};

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
        className="group relative h-[280px] border-8 border-black overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-2 bg-[#111]"
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

          <div className="min-w-0 mt-4">
            {/* 固定双语搭配；break-words 让 INTELLIGENCE 在窄屏换行而非被裁切 */}
            {/* 固定双语搭配；whitespace-nowrap 与 Festival 保持一致，避免宽屏换行导致间距偏差 */}<h3 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight pixel-font text-white drop-shadow-[3px_3px_0_#ff00ff] whitespace-nowrap">
              {card.title}
            </h3>
            <h4 className={`text-sm md:text-base font-bold mb-3 text-[#00ffff]`}>
              {card.subtitleZh}
            </h4>
            <p className="text-gray-300 text-xs md:text-sm font-medium line-clamp-2 bg-black/60 p-2.5 border-l-4 border-[#ff00ff]">
              {zh ? card.descZh : card.descEn}
            </p>
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
    <div className="mx-auto py-8 min-h-[85vh] flex flex-col justify-center">
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

      {/* 电影节日历入口（2026-10-08：让用户能从首页直接进入 Festival Calendar。
          放在标题区与四宫格之间，桌面端与移动端首屏即可见；沿用既有边框 / 硬阴影 /
          像素字体，不改动既有四张卡片。徽章用 NEW 而非 SEC.05，避免打乱 SEC.01–04 编号） */}
      <Link
        to="/festivals"
        className="group mb-6 relative flex flex-col items-stretch bg-black border-4 border-[#ff00ff] h-[220px] transition-transform duration-300 hover:-translate-y-1"
        style={{ boxShadow: "12px 12px 0 0 #00ffff" }}
      >
        <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-between">
          <div className="min-w-0 mt-[20px]">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight pixel-font text-white drop-shadow-[3px_3px_0_#ff00ff] whitespace-nowrap">
              {FESTIVAL_ENTRY.title}
            </h3>
            <h4 className="text-sm md:text-base font-bold text-[#00ffff] mb-3">
              {FESTIVAL_ENTRY.subtitleZh}
            </h4>
            <p className="text-gray-300 text-xs md:text-sm font-medium line-clamp-2 bg-black/60 p-2.5 border-l-4 border-[#ff00ff]">
              {zh ? FESTIVAL_ENTRY.descZh : FESTIVAL_ENTRY.descEn}
            </p>
          </div>
        </div>
      </Link>

      {/* 四张全景满铺卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {CARDS.map((card, i) => renderCard(card, i))}
      </div>

      {/* 我的数据（2026-10-29）：默认持久化，不再走 footer 入口，直接内嵌首页最下方 */}
      <MyDataPanel />
    </div>
  );
};

export default NewSplash;
