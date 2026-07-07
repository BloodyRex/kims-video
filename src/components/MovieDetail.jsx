import React from "react";
import { Icons } from "./Icons";
import Loading from "./Loading";
import { useLocale } from "../i18n";
import { posterAlt } from "../utils/posterAlt";

const MovieDetail = ({
  detailData,
  detailLoading,
  detailMovieId,
  primaryMovie,
  recommendations,
  sourceTmdbId,
  onBackToResults,
  onShare,
  onReset,
}) => {
  const { t, locale } = useLocale();
  if (detailLoading && !detailData) {
    return <Loading loadingMessage="" step="" />;
  }

  if (!detailData) {
    return (
      <div className="max-w-5xl mx-auto text-center py-20 text-white text-xl font-bold">
        {t('detail.load_error')}
      </div>
    );
  }

  const genres =
    detailData.genres?.length > 0 ? detailData.genres.join(" / ") : "";
  const currentRec = recommendations.find(
    (r) => Number(r.tmdbId) === Number(detailMovieId)
  );
  const matchedTags = currentRec?.matchedTags;
  const sourceDisplay = primaryMovie.title
    ? t('detail.source_prefix', { title: primaryMovie.title, year: primaryMovie.year || "" })
    : "";

  return (
    <div className="max-w-4xl mx-auto space-y-6 max-sm:px-3">
      {/* 推荐来源 */}
      {sourceDisplay && (
        <div className="bg-black border-4 max-sm:border-2 border-[#00ffff] p-4 max-sm:p-3 shadow-[8px_8px_0_0_#ff00ff] max-sm:shadow-[4px_4px_0_0_#ff00ff]">
          <p className="text-[#00ffff] pixel-font text-sm flex items-center">
            <span className="mr-2">🎬</span> {sourceDisplay}
          </p>
        </div>
      )}

      {/* 电影资料卡片 */}
      <div className="bg-white border-8 max-sm:border-4 border-black p-6 max-sm:p-4 md:p-8 shadow-[16px_16px_0_0_#ffff00] max-sm:shadow-[8px_8px_0_0_#ffff00] flex flex-col md:flex-row gap-6 max-sm:gap-4">
        {/* 海报 */}
        <div className="w-full md:w-48 flex-shrink-0">
          {detailData.poster ? (
            <div className="border-4 border-black overflow-hidden shadow-[4px_4px_0_0_#000]">
              <img
                src={detailData.poster}
                alt={posterAlt(detailData.title, detailData.year, detailData.originalTitle, locale)}
                className="w-full h-auto object-cover"
              />
            </div>
          ) : (
            <div className="border-4 border-black bg-gray-800 text-white flex items-center justify-center h-64 text-xs pixel-font shadow-[4px_4px_0_0_#000]">
              {t('detail.no_poster')}
            </div>
          )}
        </div>

        {/* 信息区 */}
        <div className="flex-1">
          {/* 标题行 */}
          <div className="flex flex-wrap items-baseline gap-3 mb-4 bg-black p-3 border-2 border-[#00ffff]">
            <h2 className="text-3xl font-black text-white">
              {detailData.title}
            </h2>
            {detailData.originalTitle && (
              <span className="text-[#00ffff] italic font-bold">
                {detailData.originalTitle}
              </span>
            )}
            <span className="bg-[#ff00ff] text-white px-2 py-1 font-black pixel-font text-xs border-2 border-white ml-auto">
              {detailData.year} | {detailData.type}
            </span>
          </div>

          {/* 标签行 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {detailData.vote_average && (
              <span className="bg-[#ffff00] text-black px-2 py-1 font-black text-xs border-2 border-black pixel-font">
                ⭐ {detailData.vote_average}
              </span>
            )}
            {genres && (
              <span className="bg-black text-white px-2 py-1 font-black text-xs border-2 border-[#ff00ff] pixel-font">
                {genres}
              </span>
            )}
            {detailData.runtime && (
              <span className="bg-black text-white px-2 py-1 font-black text-xs border-2 border-[#00ffff] pixel-font">
                {t('detail.runtime', { minutes: detailData.runtime })}
              </span>
            )}
            {detailData.director && (
              <span className="bg-white text-black px-2 py-1 font-black text-xs border-2 border-black uppercase">
                {t('detail.director', { director: detailData.director })}
              </span>
            )}
          </div>

          {/* 品味匹配 */}
          {matchedTags && matchedTags.length > 0 && (
            <div className="bg-black border-2 border-[#ff00ff] p-3 mb-4 shadow-[4px_4px_0_0_#ff00ff]">
              <span className="text-[#ffff00] pixel-font text-xs font-black tracking-wider block mb-1">
                {t('detail.taste_match')}
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {matchedTags.slice(0, 4).map((tag, i) => (
                  <span key={i} className="text-[#00ffff] pixel-font text-sm font-bold">
                    <span className="text-[#ff00ff] mx-1">·</span>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 剧情简介 */}
          {detailData.overview && (
            <div className="bg-[#f0f0f0] border-4 border-black p-4 mb-4">
              <p className="text-black font-bold leading-relaxed">
                {detailData.overview}
              </p>
            </div>
          )}

          {/* 演员表 */}
          {detailData.cast && detailData.cast.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-1">
                {detailData.cast.map((actor, i) => (
                  <span
                    key={i}
                    className="bg-black text-white px-2 py-0.5 text-xs font-bold border border-gray-600"
                  >
                    🎭 {actor}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* TMDB 外部链接 */}
          <a
            href={`https://www.themoviedb.org/movie/${detailMovieId || ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 bg-[#00dd00] hover:bg-[#00ff00] text-black border-4 border-black text-xs font-black uppercase transition-colors shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none pixel-font"
          >
            {t('detail.view_tmdb')}
          </a>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="flex justify-center gap-4 pt-4 flex-wrap">
        <button
          onClick={onBackToResults}
          className="flex items-center text-white bg-black border-4 border-[#00ffff] px-6 py-3 uppercase font-bold hover:bg-[#00ffff] hover:text-black transition-colors pixel-font text-sm shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none"
        >
          {t('detail.back')}
        </button>
        <button
          onClick={onShare}
          className="flex items-center text-white bg-[#ff00ff] border-4 border-black px-6 py-3 uppercase font-bold hover:bg-[#ff40ff] transition-colors pixel-font text-sm shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none"
        >
          {t('detail.share')}
        </button>
        <button
          onClick={onReset}
          className="flex items-center text-white bg-black border-4 border-[#ff00ff] px-6 py-3 uppercase font-bold hover:bg-[#ff00ff] transition-colors pixel-font text-sm shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none"
        >
          <Icons.RefreshCw className="mr-2" /> {t('detail.reboot')}
        </button>
      </div>
    </div>
  );
};

export default MovieDetail;
