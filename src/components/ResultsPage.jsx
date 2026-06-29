import React, { useState, useRef } from "react";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";
import { posterAlt } from "../utils/posterAlt";
import { publishToDiscover, uploadDiscoverThumbnail } from "../services/discoverApi";
import { fetchMovieByTmdbId } from "../services/api";
import SaveContent from "./SaveContent";
import domtoimage from "dom-to-image-more";

const CATEGORIES = ["科幻", "悬疑", "恐怖", "动画", "战争", "犯罪", "剧情", "奇幻"];

function mapGenreFromNames(genreNames) {
  if (!genreNames?.length) return "剧情";
  for (const name of genreNames) {
    if (CATEGORIES.includes(name)) return name;
  }
  for (const name of genreNames) {
    if (name === "惊悚") return "悬疑";
    if (name === "爱情" || name === "历史" || name === "音乐" || name === "家庭") return "剧情";
    if (name === "冒险") return "奇幻";
  }
  return "剧情";
}

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
  const { t, locale } = useLocale();
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [contributorName, setContributorName] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishDone, setPublishDone] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [showPosterGen, setShowPosterGen] = useState(false);
  const publishPosterRef = useRef(null);

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError("");
    try {
      // 1. Determine genre from primary movie's TMDB data
      let genre = "剧情";
      if (primaryMovie.tmdbId) {
        try {
          const details = await fetchMovieByTmdbId(primaryMovie.tmdbId, locale);
          if (details?.genres) {
            genre = mapGenreFromNames(details.genres);
          }
        } catch (e) { /* use default */ }
      }

      const sourceMovies = [
        { title: primaryMovie.title, titleEn: "", year: primaryMovie.year, tmdbId: primaryMovie.tmdbId },
      ];
      if (secondaryMovie?.title) {
        sourceMovies.push({
          title: secondaryMovie.title,
          titleEn: "",
          year: secondaryMovie.year,
          tmdbId: secondaryMovie.tmdbId,
        });
      }

      // 2. Publish first to get the result ID, then upload thumbnail
      const recData = recommendations.map(r => ({
        tmdbId: r.tmdbId,
        title: r.title,
        titleEn: r.originalTitle || "",
        year: r.year,
        director: r.director,
        type: r.type,
        reason: r.reason,
        matchedTags: r.matchedTags,
      }));

      const published = await publishToDiscover({
        sourceMovies,
        recommendations: recData,
        genre,
        contributorName: contributorName.trim() || "",
      });

      // 3. Generate poster using SaveContent (verified flow, same as SAVE button)
      try {
        setShowPosterGen(true);
        await new Promise(r => setTimeout(r, 100));
        await new Promise(r => {
          const check = () => {
            if (publishPosterRef.current) r();
            else setTimeout(check, 50);
          };
          check();
        });
        await new Promise(r => setTimeout(r, 200));

        const el = publishPosterRef.current;
        const imgs = el.querySelectorAll("img");
        await Promise.all(
          Array.from(imgs).map(img =>
            img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
          )
        );
        await new Promise(r => setTimeout(r, 150));

        const svgDataUrl = await domtoimage.toSvg(el, {
          width: 800,
          height: el.scrollHeight,
          style: { "background-color": "#111111" },
        });

        const imgEl = new Image();
        imgEl.src = svgDataUrl;
        await imgEl.decode();

        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = imgEl.naturalWidth * scale;
        canvas.height = imgEl.naturalHeight * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
        const pngDataUrl = canvas.toDataURL("image/png");

        setShowPosterGen(false);
        // 4. Upload thumbnail
        if (published.id) {
          await uploadDiscoverThumbnail({ id: published.id, image: pngDataUrl });
        }
      } catch (thumbErr) {
        console.error("Thumbnail upload failed", thumbErr);
        // Continue — publishing succeeded even if thumbnail fails
      }

      setPublishDone(true);
    } catch (e) {
      setPublishError(e.message || "Failed");
    } finally {
      setPublishing(false);
    }
  };

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
        <div className="flex items-center gap-2 mt-4 md:mt-0 flex-shrink-0 flex-wrap">
          <button
            onClick={onSaveImage}
            disabled={isCapturing}
            className="flex items-center text-white bg-[#ff00ff] border-4 border-black px-4 py-2 uppercase font-bold hover:bg-[#ff40ff] transition-colors pixel-font text-xs shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none disabled:opacity-50"
          >
            {isCapturing ? (
              <Icons.Loader2 className="w-4 h-4 mr-1" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
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
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            SHARE
          </button>
          <button
            onClick={() => { setShowPublishModal(true); setPublishDone(false); setPublishError(""); }}
            className="flex items-center text-black bg-[#ffff00] border-4 border-black px-4 py-2 uppercase font-bold hover:bg-[#ffff40] transition-colors pixel-font text-xs shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            {locale === "en" ? "PUBLISH" : "发布到发现页"}
          </button>
        </div>
      </div>

      {/* Publish modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowPublishModal(false)}>
          <div className="bg-white border-8 border-black shadow-[16px_16px_0_0_rgba(0,0,0,1)] p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            {publishDone ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">🎉</div>
                <h3 className="text-xl font-black pixel-font mb-2">{locale === "en" ? "Published!" : "发布成功！"}</h3>
                <p className="text-sm text-gray-600 mb-4">{locale === "en" ? "Your picks are now on the Discover page." : "你的推荐已展示在发现页面。"}</p>
                <a
                  href="/discover"
                  className="inline-block bg-[#ffff00] border-4 border-black px-6 py-2 font-black text-sm pixel-font uppercase shadow-[4px_4px_0_0_#000] hover:translate-y-0.5 transition-all"
                >
                  {locale === "en" ? "VIEW DISCOVER →" : "查看发现页 →"}
                </a>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-black pixel-font uppercase mb-4">{locale === "en" ? "Share to Discover" : "分享到发现页面"}</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {locale === "en"
                    ? "Show your recommendations on the public Discover page so others can find great movies too."
                    : "将你的推荐结果展示在公开的发现页面，让更多影迷看到。"}
                </p>
                <label className="block text-sm font-bold mb-2">
                  {locale === "en" ? "Your name (optional)" : "推荐人名称（选填）"}
                </label>
                <input
                  type="text"
                  maxLength={30}
                  placeholder={locale === "en" ? "Anonymous" : "匿名用户"}
                  value={contributorName}
                  onChange={e => setContributorName(e.target.value)}
                  className="w-full border-4 border-black px-3 py-2 text-sm font-bold mb-4 focus:outline-none focus:bg-[#ffff00]"
                />
                {publishError && (
                  <p className="text-red-600 text-xs font-bold mb-3">{publishError}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPublishModal(false)}
                    className="flex-1 border-4 border-black px-4 py-2 text-sm font-bold hover:bg-gray-100 transition-colors"
                  >
                    {locale === "en" ? "Cancel" : "取消"}
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="flex-1 bg-[#ffff00] border-4 border-black px-4 py-2 text-sm font-black pixel-font uppercase hover:bg-[#ffff40] transition-colors disabled:opacity-50 shadow-[4px_4px_0_0_#000]"
                  >
                    {publishing ? "..." : (locale === "en" ? "PUBLISH" : "发布")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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

              <div className="flex-col justify-start items-stretch z-10 w-full md:w-36 md:flex-shrink-0 flex mt-4 md:mt-0">
                {rec.poster ? (
                  <div className="relative border-4 border-black overflow-hidden shadow-[4px_4px_0_0_#000]">
                    <img
                      src={rec.poster}
                      alt={posterAlt(rec.title, rec.year, rec.originalTitle, locale)}
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

      {/* Hidden SaveContent for poster generation */}
      {showPosterGen && (
        <div ref={publishPosterRef} style={{ position: "fixed", top: "-9999px", left: 0, width: "800px", zIndex: 9999 }}>
          <SaveContent recommendations={recommendations} primaryMovie={primaryMovie} secondaryMovie={secondaryMovie} />
        </div>
      )}

export default ResultsPage;