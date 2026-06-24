import React from "react";
import discoverData from "../data/discover.json";
import { Icons } from "./Icons";

const GENRE_COLORS = {
  "科幻": "#ff00ff",
  "悬疑": "#00ffff",
  "恐怖": "#ff00ff",
  "动画": "#ffff00",
  "战争": "#ff00ff",
  "犯罪": "#00ffff",
  "剧情": "#ffff00",
  "奇幻": "#ff00ff",
};

const DiscoverPage = () => {
  return (
    <div className="min-h-screen graffiti-bg text-black pb-20">
      {/* Header */}
      <header className="relative z-10 flex flex-col items-center py-4 bg-black border-b-8 border-[#ff00ff] shadow-[0_8px_0_0_rgba(0,255,255,1)]">
        <a href="/" className="flex items-center justify-center hover:opacity-80 transition-opacity">
          <div className="bg-[#ffff00] p-2 border-4 border-black mr-4 transform -rotate-6">
            <span className="text-black transform rotate-90"><Icons.Play /></span>
          </div>
          <h1 className="text-xl sm:text-3xl font-black text-white pixel-font uppercase tracking-widest drop-shadow-[4px_4px_0_#ff00ff] whitespace-nowrap">
            KIM'S <span className="text-[#00ffff]">VIDEO</span>
          </h1>
        </a>
        <p className="text-gray-500 text-xs pixel-font mt-1 tracking-wider">&quot;Art is above the law.&quot;</p>
      </header>

      {/* Intro */}
      <section className="max-w-4xl mx-auto px-4 pt-12 pb-4 text-center">
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-4 drop-shadow-[3px_3px_0_#ff00ff] pixel-font">
          DISCOVER
        </h2>
        <p className="text-gray-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          每一部你热爱的电影，都通往另一场未知的冒险。浏览这些精选推荐对，点击即可查看完整影片资料与 AI 品味分析。
        </p>
      </section>

      {/* Genre sections */}
      <div className="max-w-4xl mx-auto px-4 space-y-12 pb-12">
        {discoverData.genres.map((genre) => {
          const color = GENRE_COLORS[genre.name] || "#ff00ff";
          return (
            <section key={genre.name}>
              <h2
                className="text-xl sm:text-2xl font-black mb-6 pixel-font inline-block px-4 py-2 border-4 border-black"
                style={{
                  color: "#fff",
                  backgroundColor: color,
                  boxShadow: `6px 6px 0 0 #000`,
                  textShadow: "2px 2px 0 rgba(0,0,0,0.3)",
                }}
              >
                {genre.name}
              </h2>

              <div className="space-y-4">
                {genre.pairs.map((pair, idx) => {
                  const linkUrl = `/?from=${pair.source.tmdbId}&r=${pair.recommend.tmdbId}`;
                  return (
                    <article
                      key={idx}
                      className="bg-white border-4 border-black p-5"
                      style={{ boxShadow: `8px 8px 0 0 ${color}` }}
                    >
                      {/* Source → Recommend header */}
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-3">
                        <span className="text-sm font-bold text-gray-500">如果你喜欢</span>
                        <span className="font-black text-lg" style={{ color }}>
                          《{pair.source.title}》
                        </span>
                        <span className="text-gray-400 text-sm">({pair.source.year})</span>
                        <span className="text-gray-500 mx-1 text-lg">→</span>
                        <span className="font-black text-lg text-black">
                          《{pair.recommend.title}》
                        </span>
                        <span className="text-gray-400 text-sm">({pair.recommend.year})</span>
                      </div>

                      {/* Reason */}
                      <p className="text-gray-700 text-sm leading-relaxed mb-3">
                        {pair.reason}
                      </p>

                      {/* Link */}
                      <a
                        href={linkUrl}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider border-2 border-black transition-all hover:translate-y-0.5 active:translate-y-1 active:shadow-none"
                        style={{
                          backgroundColor: color,
                          color: "#000",
                          boxShadow: "4px 4px 0 0 #000",
                        }}
                      >
                        查看详情
                        <Icons.ChevronRight className="w-3 h-3" />
                      </a>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 w-full z-10 text-center py-3 bg-black border-t-4 border-[#ffff00] text-white text-xs pixel-font uppercase tracking-widest">
        <p>
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="hover:text-[#00ffff] transition-colors">
            Data and poster from TMDB
          </a> | BLOODYREX (C) 2026
        </p>
      </footer>
    </div>
  );
};

export default DiscoverPage;
