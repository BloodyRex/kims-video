import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icons } from "./Icons";
import Loading from "./Loading";
import QAPage from "./QAPage";
import ResultsPage from "./ResultsPage";
import MovieDetail from "./MovieDetail";
import SaveContent from "./SaveContent";
import NewSplash from "./NewSplash";
import NewInputPage from "./NewInputPage";
import SplashPage from "./SplashPage";
import SubscribeSection from "./SubscribeSection";
import domtoimage from "dom-to-image-more";
import { fetchMovieByTmdbId } from "../services/api";
import { loadResultsFromCache } from "../utils/cache";
import { updateUrl } from "../utils/url";
import { updateSeo, updateStructuredData, resetSeo } from "../services/seo";
import { useMovieEngine } from "../logic/useMovieEngine";
import { useLocale } from "../i18n";

/**
 * NewHomePage — 新主页（2026-08 设计）：四宫格开屏 → AI 搜索 → 问答 → 推荐。
 * 复用 useMovieEngine 全部逻辑；Discover/Intelligence/Wall 走现有路由。
 */
const NewHomePage = () => {
  const { t, locale, toggleLocale } = useLocale();
  const saveContainerRef = useRef(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const {
    step, setStep,
    primaryMovie, setPrimaryMovie,
    secondaryMovie, setSecondaryMovie,
    primarySuggestions, setPrimarySuggestions,
    secondarySuggestions, setSecondarySuggestions,
    isSearchingPrimary, isSearchingSecondary,
    showPrimaryDropdown, setShowPrimaryDropdown,
    showSecondaryDropdown, setShowSecondaryDropdown,
    questions, currentQIndex,
    recommendations, setRecommendations,
    error, setError,
    replacingIndexes, isCapturing,
    showSaveLayout, setShowSaveLayout,
    sourceTmdbId, setSourceTmdbId,
    detailMovieId, setDetailMovieId,
    detailData, setDetailData,
    detailLoading, setDetailLoading,
    currentYear,

    searchMovie,
    selectMovie,
    handleGenerateQuestions,
    handleAnswer,
    replaceOneRecommendation,
    resetApp,
    handleSaveImage,
    handleViewDetail,
    handleShare,
    handleBackToResults,
    handleDetailShare,
    setIsCapturing,
  } = useMovieEngine();

  // 初始步骤：四宫格开屏（覆盖 engine 默认的 "input"）；
  // 带 ?search=1 时直达 AI search 输入页（footer"AI 推荐"链接目标）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("search") === "1") {
      setStep("input");
    } else {
      setStep("splash");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (primaryMovie.title && showPrimaryDropdown) {
        searchMovie(primaryMovie.title, "primary");
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [primaryMovie.title, showPrimaryDropdown]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (secondaryMovie.title && showSecondaryDropdown) {
        searchMovie(secondaryMovie.title, "secondary");
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [secondaryMovie.title, showSecondaryDropdown]);

  // URL param routing (deep links from /discover or shared results)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sourceRaw = params.get("from");
    const detailId = params.get("r");
    const sourceTitle = params.get("s");
    const detailSourceTmdbIds = sourceRaw?.split(",").filter(Boolean).map(Number) || [];
    const sourceId = detailSourceTmdbIds[0];

    if (!sourceRaw && !detailId) return;

    if (detailId) {
      if (sourceId) setSourceTmdbId(sourceId);
      setDetailMovieId(detailId);
      if (sourceId) {
        const cached = loadResultsFromCache(sourceId);
        if (cached) {
          setPrimaryMovie(cached.primaryMovie);
          setRecommendations(cached.recommendations || []);
        }
      }
      setStep("detail");
      return;
    }

    // from=... without detail: jump straight to input with the source title pre-filled
    if (sourceTitle) {
      const yearMatch = sourceTitle.match(/(\d{4})$/);
      setPrimaryMovie({
        title: yearMatch ? sourceTitle.slice(0, -5) : sourceTitle,
        year: yearMatch ? yearMatch[1] : "",
      });
    }
    setStep("input");
  }, [setSourceTmdbId, setDetailMovieId, setPrimaryMovie, setRecommendations, setStep]);

  // Init SEO
  useEffect(() => {
    resetSeo(locale);
  }, [locale]);

  // Screenshot capture effect (same as old AppContent)
  useEffect(() => {
    if (!showSaveLayout || !saveContainerRef.current) return;

    (async () => {
      try {
        const el = saveContainerRef.current;
        if (!el) return;
        const imgs = el.querySelectorAll("img");
        await Promise.all(
          Array.from(imgs).map((img) =>
            img.complete ? Promise.resolve() : new Promise((r) => {
              // 5s cap per image — a stalled poster must not hang the save flow
              const done = () => { img.onload = null; img.onerror = null; r(); };
              const timer = setTimeout(done, 5000);
              img.onload = () => { clearTimeout(timer); done(); };
              img.onerror = () => { clearTimeout(timer); done(); };
            })
          )
        );
        await new Promise((r) => setTimeout(r, 150));

        const svgDataUrl = await domtoimage.toSvg(el, {
          width: 800,
          height: el.scrollHeight,
          style: { "background-color": "#111111" },
          disableEmbedFonts: true,
          httpTimeout: 10000,
        });

        const img = new Image();
        img.src = svgDataUrl;
        await img.decode();

        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth * scale;
        canvas.height = img.naturalHeight * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `kims-video-${primaryMovie.title}-recommendations.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        gtag?.("event", "save_poster", { source_title: primaryMovie.title });
      } catch (err) {
        console.error("Save image failed", err);
        setError("保存图片失败: " + err.message);
      } finally {
        setShowSaveLayout(false);
        setIsCapturing(false);
      }
    })();
  }, [showSaveLayout, primaryMovie.title, setShowSaveLayout, setIsCapturing, setError]);

  // Detail data load
  useEffect(() => {
    if (step !== "detail" || !detailMovieId) return;
    setDetailLoading(true);
    let cancelled = false;
    (async () => {
      const data = await fetchMovieByTmdbId(detailMovieId, locale);
      if (cancelled) return;
      setDetailData(data || null);
      setDetailLoading(false);
      if (data?.title) {
        gtag?.("event", "view_movie_detail", { movie_title: data.title, movie_id: detailMovieId });
      }
    })();
    return () => { cancelled = true; };
  }, [step, detailMovieId, setDetailLoading, setDetailData, locale]);

  const goToSplash = () => setStep("splash");

  return (
    <div className={`min-h-screen text-black selection:bg-[#ffff00] selection:text-black overflow-x-hidden pb-20 locale-${locale} graffiti-bg`}>
      {/* Header (hidden on splash — full-bleed cards) */}
      {step !== "splash" && (
        <header className="relative z-10 flex flex-col items-center py-4 mb-6 bg-black border-b-8 border-[#ff00ff] shadow-[0_8px_0_0_rgba(0,255,255,1)]">
          <div className="flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity" onClick={goToSplash}>
            <div className="bg-[#ffff00] p-2 border-4 border-black mr-4 transform -rotate-6">
              <span className="text-black transform rotate-90"><Icons.Play /></span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black text-white pixel-font uppercase tracking-widest drop-shadow-[4px_4px_0_#ff00ff] whitespace-nowrap">
              KIM'S <span className="text-[#00ffff]">VIDEO</span>
            </h1>
          </div>
          <p className="text-gray-500 text-xs pixel-font mt-1 tracking-wider">{t("tagline")}</p>
        </header>
      )}

      <main className="relative z-10 container mx-auto px-4 md:py-4">
        {step === "splash" && (
          <NewSplash
            onEnterAI={() => {
              setError("");
              setStep("input");
            }}
          />
        )}

        {step === "input" && (
          <>
            <NewInputPage
              primaryMovie={primaryMovie}
              setPrimaryMovie={setPrimaryMovie}
              secondaryMovie={secondaryMovie}
              setSecondaryMovie={setSecondaryMovie}
              primarySuggestions={primarySuggestions}
              secondarySuggestions={secondarySuggestions}
              isSearchingPrimary={isSearchingPrimary}
              isSearchingSecondary={isSearchingSecondary}
              showPrimaryDropdown={showPrimaryDropdown}
              setShowPrimaryDropdown={setShowPrimaryDropdown}
              showSecondaryDropdown={showSecondaryDropdown}
              setShowSecondaryDropdown={setShowSecondaryDropdown}
              error={error}
              onGenerateQuestions={handleGenerateQuestions}
              onSelectMovie={selectMovie}
              onShowInfo={() => setShowInfoModal(true)}
              currentYear={currentYear}
              locale={locale}
            />
            {/* Entry buttons — 3 sub-page shortcuts (还原旧版底部按钮) */}
            <div className="max-w-2xl mx-auto mt-6 mb-4 flex flex-col sm:flex-row gap-3 max-sm:mx-3">
              <Link
                to="/discover"
                className="flex-1 block border-4 border-black px-4 py-3 shadow-[6px_6px_0_0_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-[3px_3px_0_0_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all text-center group relative overflow-hidden bg-gradient-to-r from-[#ff00ff] via-[#ffff00] to-[#00ffff] flow-gradient"
              >
                <span className={`font-black pixel-font uppercase tracking-wider flex items-center justify-center gap-2 text-black relative z-10 ${locale === "en" ? "text-xs" : "text-sm"}`}>
                  <span className="text-base">🎬</span>
                  {locale === "zh" ? "社区发现" : "CURATED PICKS"}
                </span>
              </Link>
              <Link
                to="/intelligence"
                className="flex-1 block border-4 border-black px-4 py-3 shadow-[6px_6px_0_0_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-[3px_3px_0_0_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all text-center group relative overflow-hidden bg-gradient-to-r from-[#ff00ff] via-[#ffff00] to-[#00ffff] flow-gradient"
              >
                <span className={`font-black pixel-font uppercase tracking-wider flex items-center justify-center gap-2 text-black relative z-10 ${locale === "en" ? "text-xs" : "text-sm"}`}>
                  <span className="text-base">📊</span>
                  {locale === "zh" ? "全球影音" : "INTELLIGENCE"}
                </span>
              </Link>
              <Link
                to="/wall"
                className="flex-1 block border-4 border-black px-4 py-3 shadow-[6px_6px_0_0_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-[3px_3px_0_0_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all text-center group relative overflow-hidden bg-gradient-to-r from-[#ff00ff] via-[#ffff00] to-[#00ffff] flow-gradient"
              >
                <span className={`font-black pixel-font uppercase tracking-wider flex items-center justify-center gap-2 text-black relative z-10 ${locale === "en" ? "text-xs" : "text-sm"}`}>
                  <span className="text-base">🧱</span>
                  {locale === "zh" ? "影视墙" : "MOVIE WALL"}
                </span>
              </Link>
            </div>
          </>
        )}

        {step === "loading_questions" && <Loading step={step} />}
        {step === "qa" && <QAPage questions={questions} currentQIndex={currentQIndex} onAnswer={handleAnswer} />}
        {step === "loading_results" && <Loading step={step} />}
        {step === "results" && (
          <ResultsPage
            recommendations={recommendations}
            primaryMovie={primaryMovie}
            secondaryMovie={secondaryMovie}
            replacingIndexes={replacingIndexes}
            isCapturing={isCapturing}
            onSaveImage={handleSaveImage}
            onShare={handleShare}
            onReplaceOne={replaceOneRecommendation}
            onViewDetail={handleViewDetail}
            onReset={resetApp}
          />
        )}
        {step === "detail" && (
          <MovieDetail
            detailData={detailData}
            detailLoading={detailLoading}
            detailMovieId={detailMovieId}
            primaryMovie={primaryMovie}
            recommendations={recommendations}
            sourceTmdbId={sourceTmdbId}
            onBackToResults={handleBackToResults}
            onShare={handleDetailShare}
            onReset={resetApp}
          />
        )}
      </main>

      {/* Daily digest subscribe — same block as the other pages (Rex 2026-08-25);
          hidden on splash (full-bleed grid) */}
      {step !== "splash" && <SubscribeSection locale={locale} />}

      {/* 语言切换按钮（与其他子页面一致） */}
      <div className="fixed bottom-[116px] sm:bottom-[128px] right-3 sm:right-4 z-40">
        <button
          onClick={toggleLocale}
          className="w-7 h-7 sm:w-8 sm:h-8 bg-[#ff00ff] border-2 border-black text-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors font-black text-[10px] sm:text-xs shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none"
          style={{ fontFamily: "'Press Start 2P','Courier New',Courier,monospace" }}
        >
          {locale === "zh" ? "En" : "中"}
        </button>
      </div>

      {/* Footer (hidden on splash) */}
      {step !== "splash" && (
        <footer className={`fixed bottom-0 w-full z-10 text-center py-3 bg-black border-t-4 border-[#ffff00] text-white ${locale === "zh" ? "text-sm max-sm:text-xs font-bold tracking-wider" : "pixel-font text-[10px] max-sm:text-[9px] uppercase tracking-widest"}`}>
          <p>
            <Link to="/discover" className="hover:text-[#ffff00] transition-colors">{t("footer.discover")}</Link>
            <span className="text-gray-600 mx-2">|</span>
            <Link to="/intelligence" className="hover:text-[#00ffff] transition-colors">{t("footer.intel")}</Link>
            <span className="text-gray-600 mx-2">|</span>
            <Link to="/wall" className="hover:text-[#ff00ff] transition-colors">{t("footer.wall")}</Link>
            <span className="text-gray-600 mx-2">|</span>
            <a href="mailto:rexhr@yahoo.com" className="hover:text-[#ffff00] transition-colors">{t("footer.contact")}</a>
          </p>
        </footer>
      )}

      {showSaveLayout && (
        <div ref={saveContainerRef} style={{ position: "fixed", top: "-9999px", left: 0, width: "800px", zIndex: 9999 }}>
          <SaveContent recommendations={recommendations} primaryMovie={primaryMovie} secondaryMovie={secondaryMovie} />
        </div>
      )}

      {showInfoModal && (
        <SplashPage isModal onClose={() => setShowInfoModal(false)} />
      )}
    </div>
  );
};

export default NewHomePage;
