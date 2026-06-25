import React, { useState, useEffect } from "react";
import discoverData from "../data/discover.json";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";
import { fetchMovieByTmdbId } from "../services/api";

const LANG_BUTTON_STYLE = {
  fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
};

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

const GENRE_THEMES = {
  "科幻": { zh: "时空、科技与人性探索", en: "time, technology, and human exploration" },
  "悬疑": { zh: "悬疑、记忆与身份认同", en: "suspense, memory, and identity" },
  "恐怖": { zh: "心理恐惧与氛围营造", en: "psychological dread and atmosphere" },
  "动画": { zh: "想象力与情感表达", en: "imagination and emotional expression" },
  "战争": { zh: "人性考验与历史反思", en: "human endurance and historical reflection" },
  "犯罪": { zh: "道德边界与命运纠葛", en: "moral boundaries and fate" },
  "剧情": { zh: "人性深度与社会洞察", en: "human depth and social insight" },
  "奇幻": { zh: "神话叙事与史诗冒险", en: "mythic storytelling and epic adventure" },
};

const DiscoverPage = () => {
  const { t, locale, toggleLocale } = useLocale();
  const [posterMap, setPosterMap] = useState({});

  useEffect(() => {
    document.title = locale === "zh"
      ? "AI 电影推荐发现页｜Discover 相似电影合集｜Kim's Video"
      : "AI Movie Discovery Hub｜Curated Film Recommendations｜Kim's Video";

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.content = locale === "zh"
        ? "探索基于 AI 的电影推荐组合，发现与你喜欢电影相似的科幻、剧情与悬疑作品。"
        : "Explore AI-powered movie recommendation pairs. Discover sci-fi, drama, and mystery films similar to your favorites.";
    }
  }, [locale]);

  useEffect(() => {
    const allIds = new Set();
    discoverData.genres.forEach((g) =>
      g.pairs.forEach((p) => {
        allIds.add(p.source.tmdbId);
        allIds.add(p.recommend.tmdbId);
      })
    );

    let cancelled = false;
    const fetchPosters = async () => {
      const map = {};
      await Promise.allSettled(
        [...allIds].map(async (id) => {
          const data = await fetchMovieByTmdbId(id, locale);
          if (data) {
            let info = data;
            if (typeof info === "string") {
              try { info = JSON.parse(info); } catch { info = null; }
            }
            if (info?.poster_path) map[id] = info.poster_path;
          }
        })
      );
      if (!cancelled) setPosterMap(map);
    };
    fetchPosters();
    return () => { cancelled = true; };
  }, []);

  const posterUrl = (tmdbId, size = "w92") =>
    posterMap[tmdbId]
      ? `https://image.tmdb.org/t/p/${size}${posterMap[tmdbId]}`
      : null;

  return (
    <div className="min-h-screen graffiti-bg text-black pb-32">
      {/* Header */}
      <header className="relative z-10 flex flex-col items-center py-4 bg-black border-b-8 border-[#ff00ff] shadow-[0_8px_0_0_rgba(0,255,255,1)]">
        <button
          onClick={toggleLocale}
          className="absolute top-2 left-2 sm:top-3 sm:left-3 w-7 h-7 sm:w-9 sm:h-9 bg-[#ff00ff] border-2 border-black text-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors font-black sm:text-sm z-20"
          style={LANG_BUTTON_STYLE}
        >
          {locale === "zh" ? "En" : "中"}
        </button>
        <a href="/" className="flex items-center justify-center hover:opacity-80 transition-opacity">
          <div className="bg-[#ffff00] p-2 border-4 border-black mr-4 transform -rotate-6">
            <span className="text-black transform rotate-90"><Icons.Play /></span>
          </div>
          <div className="text-xl sm:text-3xl font-black text-white pixel-font uppercase tracking-widest drop-shadow-[4px_4px_0_#ff00ff] whitespace-nowrap">
            KIM'S <span className="text-[#00ffff]">VIDEO</span>
          </div>
        </a>
        <p className="text-gray-500 text-xs pixel-font mt-1 tracking-wider">&quot;{t('tagline')}&quot;</p>
      </header>

      {/* Intro */}
      <section className="max-w-4xl mx-auto px-4 pt-12 pb-2 text-center">
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-4 drop-shadow-[3px_3px_0_#ff00ff] pixel-font">
          {t('discover.title')}
        </h2>
        <p className="text-gray-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          {t('discover.desc')}
        </p>
      </section>

      {/* SEO intro — visible semantic content for indexing */}
      <section className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-black/60 border-2 border-[#00ffff] p-6 space-y-3">
          <h1 className="text-xl sm:text-2xl font-black text-white pixel-font">
            {t('seo.hub.title')}
          </h1>
          <p className="text-gray-300 text-sm leading-relaxed">
            {t('seo.hub.intro')}
          </p>
          <p className="text-gray-300 text-sm leading-relaxed">
            {t('seo.hub.genres')}
          </p>
          <p className="text-gray-300 text-sm leading-relaxed">
            {t('seo.hub.desc')}
          </p>
        </div>
      </section>

      {/* Genre sections */}
      <div className="max-w-4xl mx-auto px-4 space-y-12 pb-12">
        {discoverData.genres.map((genre) => {
          const color = GENRE_COLORS[genre.name] || "#ff00ff";
          const theme = GENRE_THEMES[genre.name] || { zh: "主题与情感体验", en: "themes and emotional experience" };
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
                {locale === "en" ? genre.nameEn : genre.name}
              </h2>

              <div className="space-y-4">
                {genre.pairs.map((pair, idx) => {
                  const linkUrl = `/?from=${pair.source.tmdbId}&r=${pair.recommend.tmdbId}&s=${encodeURIComponent(pair.source.title)}`;
                  const genreLabel = locale === "en" ? genre.nameEn : genre.name;
                  const themeLabel = locale === "en" ? theme.en : theme.zh;
                  return (
                    <article
                      key={idx}
                      className="bg-white border-4 border-black p-5"
                      style={{ boxShadow: `8px 8px 0 0 ${color}` }}
                    >
                      {/* Source → Recommend header with posters */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
                        <span className="text-sm font-bold text-gray-500">{t('discover.if_like')}</span>
                        {posterUrl(pair.source.tmdbId) && (
                          <img
                            src={posterUrl(pair.source.tmdbId)}
                            alt={pair.source.title}
                            className="w-10 sm:w-12 border-2 border-black self-center"
                            loading="lazy"
                          />
                        )}
                        <span className="font-black text-lg" style={{ color }}>
                          {locale === "zh" ? `《${pair.source.title}》` : pair.source.title}
                        </span>
                        <span className="text-gray-400 text-sm">({pair.source.year})</span>
                        <span className="text-gray-500 mx-1 text-lg">{t('discover.arrow')}</span>
                        {posterUrl(pair.recommend.tmdbId) && (
                          <img
                            src={posterUrl(pair.recommend.tmdbId)}
                            alt={pair.recommend.title}
                            className="w-10 sm:w-12 border-2 border-black self-center"
                            loading="lazy"
                          />
                        )}
                        <span className="font-black text-lg text-black">
                          {locale === "zh" ? `《${pair.recommend.title}》` : pair.recommend.title}
                        </span>
                        <span className="text-gray-400 text-sm">({pair.recommend.year})</span>
                      </div>

                      {/* Reason */}
                      <p className="text-gray-700 text-sm leading-relaxed mb-3">
                        {locale === "en" ? pair.reasonEn : pair.reason}
                      </p>

                      {/* SEO explanation — dynamically generated per pair */}
                      <div className="border-t-2 border-dashed border-gray-300 pt-3 mt-3">
                        <p className="text-gray-500 text-xs leading-relaxed">
                          {locale === "zh"
                            ? `如果你喜欢《${pair.source.title}》（${pair.source.year}），在${genreLabel}类型中你可能也会对《${pair.recommend.title}》（${pair.recommend.year}）感兴趣。这组推荐延续了${themeLabel}等主题体验。`
                            : `If you enjoyed ${pair.source.title} (${pair.source.year}), you may also be interested in ${pair.recommend.title} (${pair.recommend.year}) in the ${genreLabel} genre. This recommendation extends themes of ${themeLabel}.`
                          }
                        </p>
                      </div>

                      {/* Link */}
                      <a
                        href={linkUrl}
                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider border-2 border-black transition-all hover:translate-y-0.5 active:translate-y-1 active:shadow-none"
                        style={{
                          backgroundColor: color,
                          color: "#000",
                          boxShadow: "4px 4px 0 0 #000",
                        }}
                      >
                        {t('discover.view_detail')}
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

      {/* SEO footer — visible content summary */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-black/60 border-2 border-[#ff00ff] p-6 space-y-3">
          <h2 className="text-lg sm:text-xl font-black text-white pixel-font">
            {t('seo.footer.title')}
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            {t('seo.footer.p1')}
          </p>
          <p className="text-gray-300 text-sm leading-relaxed">
            {t('seo.footer.p2')}
          </p>
          {/* Internal links */}
          <div className="flex gap-4 pt-2">
            <a
              href="/"
              className="text-[#00ffff] text-xs pixel-font hover:underline uppercase tracking-wider"
            >
              {t('seo.link.home')}
            </a>
            <a
              href="/discover"
              className="text-[#ff00ff] text-xs pixel-font hover:underline uppercase tracking-wider"
            >
              {t('seo.link.discover')}
            </a>
          </div>
        </div>
      </section>

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
