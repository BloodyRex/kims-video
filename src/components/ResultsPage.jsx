import React from "react";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";

const ResultsPage = ({
  recommendations,
  primaryMovie,
  secondaryMovie,
  replacingIndexes,
  isCapturing,
  onSaveImage,
  onShare,
  onReplaceOne,
  onViewDetail,
  onReset,
}) => {
  const { t } = useLocale();

  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="max-w-5xl mx-auto text-center py-20 text-white text-xl font-bold">
        {t('results.no_results')}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-end mb-10 bg-white border-8 border-black p-6 shadow-[12px_12px_0_0_#ff00ff]">
        <div>
          <h2
            className="text-xl sm:text-3xl font-black text-black pixel-font uppercase mb-2 tracking-widest"
            style={{ textShadow: "3px 3px 0 #ff00ff" }}
          >
            TARGETS ACQUIRED
          </h2>
          <p className="text-black font-bold bg-[#00ffff] inline-block px-2 border-2 border-black">
            {t('results.genome_match', {
              primary: primaryMovie.title,
              secondary: secondaryMovie.title
                ? ` x 《${secondaryMovie.title}》`
                : ""
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-4 md:mt-0 flex-shrink-0">
          <button
            onClick={onSaveImage}
            disabled={isCapturing}
            className="flex items-center text-white bg-[#ff00ff] border-4 border-black px-4 py-2 uppercase font-bold hover:bg-[#ff40ff] transition-colors pixel-font text-xs shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none disabled:opacity-50"
          >
            {isCapturing ? (
              <Icons.Loader2 className="w-4 h-4 mr-1" />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
            SAVE
          </button>
          <button
            onClick={onShare}
            className="flex items-center text-white bg-[#00ffff] border-4 border-black px-4 py-2 uppercase font-bold hover:bg-[#40ffff] transition-colors pixel-font text-xs shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            SHARE
          </button>
        </div>
      </div>

      <div id="results-content" className="grid grid-cols-1 gap-8">
        {recommendations.map((rec, idx) => {
          const isReplacing = !!replacingIndexes[idx];
          const isNiche = idx >= 2 && idx <= 3;
          const isControversial = idx === 4;

          return (
            <div
              key={`${rec.title}-${rec.year}-${idx}`}
              className={`bg-white border-8 border-black p-6 md:p-8 shadow-[16px_16px_0_0_#ffff00] flex flex-col md:flex-row gap-6 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 ${
                isReplacing ? "scale-95 opacity-50" : ""
              }`}
            >
              {/* 大号背景编号 */}
              <div className="absolute -right-4 -top-10 text-[180px] font-black text-[#ff00ff] opacity-20 select-none z-0 pixel-font">
                0{idx + 1}
              </div>

              <div className="flex-1 z-10">
                <div className="flex flex-wrap items-baseline gap-3 mb-4 bg-black p-3 border-2 border-[#00ffff] text-white">
                  <h3 className="text-3xl font-black">{rec.title}</h3>
                  {rec.originalTitle && (
                    <span className="text-[#00ffff] italic font-bold">
                      {rec.originalTitle}
                    </span>
                  )}

                  <span className="bg-[#ffff00] text-black px-2 py-0.5 text-xs font-bold border-2 border-black">
                    {isControversial
                      ? t('results.badge_controversial')
                      : isNiche
                      ? t('results.badge_niche')
                      : t('results.badge_hot')}
                  </span>

                  {rec.director && (
                    <span className="bg-white text-black px-2 py-0.5 text-xs font-bold border-2 border-black uppercase">
                      {t('results.director', { director: rec.director })}
                    </span>
                  )}
                  <span className="bg-[#ff00ff] text-white px-2 py-1 ml-auto md:ml-0 font-black pixel-font border-2 border-white">
                    {rec.year} | {rec.type}
                  </span>
                </div>

                <div className="bg-[#f0f0f0] border-4 border-black p-5 relative">
                  <div className="absolute -left-2 -top-2 bg-[#ffff00] border-2 border-black px-2 py-1 flex items-center text-sm font-black transform -rotate-3">
                    <span className="mr-1 text-black">
                      <Icons.Star />
                    </span>{" "}
                    {t('results.diagnosis')}
                  </div>
                  <p className="text-black font-bold leading-relaxed mt-4">
                    {rec.reason}
                  </p>
                </div>

                {/* 操作按钮组 */}
                <div className="flex flex-row gap-2 mt-4">
                  <button
                    onClick={() => onViewDetail(rec.tmdbId)}
                    disabled={!rec.tmdbId}
                    className={`flex-1 px-3 py-3 bg-[#00dd00] hover:bg-[#00ff00] text-black border-4 border-black text-xs font-black uppercase transition-colors flex items-center justify-center shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none pixel-font ${
                      !rec.tmdbId ? "opacity-40 pointer-events-none" : ""
                    }`}
                  >
                    <span className="mr-1">
                      <Icons.Search />
                    </span>
                    {t('results.full_info')}
                  </button>

                  <button
                    onClick={() => onReplaceOne(idx)}
                    disabled={isReplacing}
                    className="flex-1 px-4 py-3 bg-[#ffff00] hover:bg-[#ffff40] text-black border-4 border-black text-sm font-black uppercase transition-colors flex items-center justify-center shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none disabled:opacity-50 pixel-font"
                  >
                    {isReplacing ? (
                      <>
                        <Icons.Loader2 className="w-4 h-4 mr-2" />
                        {t('results.searching_dots')}
                      </>
                    ) : (
                      <>
                        <Icons.RefreshCw className="w-4 h-4 mr-2" />
                        {t('results.replace_btn')}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 海报区 */}
              <div className="flex-col justify-start items-stretch z-10 w-full md:w-36 md:flex-shrink-0 flex mt-4 md:mt-0">
                {/* TMDB 电影海报 */}
                {rec.poster ? (
                  <div className="relative border-4 border-black overflow-hidden shadow-[4px_4px_0_0_#000]">
                    <img
                      src={rec.poster}
                      alt={`${rec.title} 海报`}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                ) : (
                  <div className="border-4 border-black bg-gray-800 text-white flex items-center justify-center h-40 text-xs pixel-font shadow-[4px_4px_0_0_#000]">
                    NO POSTER
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部 REBOOT */}
      <div className="flex justify-center pt-4">
        <button
          onClick={onReset}
          className="flex items-center text-white bg-black border-4 border-[#ff00ff] px-8 py-3 uppercase font-bold hover:bg-[#ff00ff] transition-colors pixel-font text-sm shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none"
        >
          <Icons.RefreshCw className="mr-2" /> {t('results.reboot')}
        </button>
      </div>
    </div>
  );
};

export default ResultsPage;
