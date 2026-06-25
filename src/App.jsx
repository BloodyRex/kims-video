import React, { useEffect, useRef, useState } from "react";
import { Icons } from "./components/Icons";
import Loading from "./components/Loading";
import InputPage from "./components/InputPage";
import QAPage from "./components/QAPage";
import ResultsPage from "./components/ResultsPage";
import MovieDetail from "./components/MovieDetail";
import SaveContent from "./components/SaveContent";
import SplashPage from "./components/SplashPage";
import DiscoverPage from "./components/DiscoverPage";
import domtoimage from "dom-to-image-more";
import { fetchMovieByTmdbId } from "./services/api";
import { loadResultsFromCache } from "./utils/cache";
import { updateUrl } from "./utils/url";
import { updateSeo, updateStructuredData, resetSeo, injectStructuredData } from "./services/seo";
import { useMovieEngine } from "./logic/useMovieEngine";
import { LocaleProvider, useLocale } from "./i18n";

function App() {
  return (
    <LocaleProvider>
      <AppContent />
    </LocaleProvider>
  );
}

function AppContent() {
  const saveContainerRef = useRef(null);

  const [showIntro, setShowIntro] = useState(() => {
    const hasFromParam = new URLSearchParams(window.location.search).has("from");
    if (hasFromParam) return false;
    return !localStorage.getItem("kims_video_intro_seen");
  });
  const [showInfoModal, setShowInfoModal] = useState(false);

  const { t, locale, toggleLocale } = useLocale();

  const handleIntroStart = () => {
    localStorage.setItem("kims_video_intro_seen", "1");
    setShowIntro(false);
  };

  const {
    step, setStep,
    primaryMovie, setPrimaryMovie,
    secondaryMovie, setSecondaryMovie,
    primarySuggestions, secondarySuggestions,
    isSearchingPrimary, isSearchingSecondary,
    showPrimaryDropdown, setShowPrimaryDropdown,
    showSecondaryDropdown, setShowSecondaryDropdown,
    questions, currentQIndex,
    recommendations,
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

  // ── 搜索 debounce ────────────────────────────
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

  // ── URL 参数路由 ────────────────────────────
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
        } else if (sourceTitle) {
          setPrimaryMovie({ title: sourceTitle, year: "" });
        }
      }
      setStep("detail");
      return;
    }

    if (sourceId) {
      setSourceTmdbId(sourceId);
      const cached = loadResultsFromCache(sourceId);
      if (cached) {
        setPrimaryMovie(cached.primaryMovie);
        setStep("results");
        injectStructuredData(cached.primaryMovie);
      }
    }
  }, []);

  // ── 浏览器前进/后退 ──────────────────────────
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const sourceRaw = params.get("from");
      const detailId = params.get("r");
      const detailSourceTmdbIds = sourceRaw?.split(",").filter(Boolean).map(Number) || [];
      const sourceId = detailSourceTmdbIds[0];

      if (detailId && sourceId) {
        setSourceTmdbId(sourceId);
        setDetailMovieId(detailId);
        setDetailData(null);
        const cached = loadResultsFromCache(sourceId);
        if (cached) {
          setPrimaryMovie(cached.primaryMovie);
        }
        setStep("detail");
      } else if (sourceId) {
        setSourceTmdbId(sourceId);
        setDetailMovieId(null);
        setDetailData(null);
        const cached = loadResultsFromCache(sourceId);
        if (cached) {
          setPrimaryMovie(cached.primaryMovie);
          resetSeo(locale);
          setStep("results");
          injectStructuredData(cached.primaryMovie);
        }
      } else {
        setStep("input");
        setSourceTmdbId(null);
        setDetailMovieId(null);
        setDetailData(null);
        setPrimaryMovie({ title: "", year: "" });
        resetSeo(locale);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // ── 初始化 SEO（根据当前语言）──────────────
  useEffect(() => {
    resetSeo(locale);
  }, [locale]);

  // ── 截图捕获 effect ──────────────────────────
  useEffect(() => {
    if (!showSaveLayout || !saveContainerRef.current) return;

    (async () => {
      try {
        const el = saveContainerRef.current;
        if (!el) return;
        const imgs = el.querySelectorAll("img");
        await Promise.all(
          Array.from(imgs).map((img) =>
            img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; })
          )
        );
        await new Promise((r) => setTimeout(r, 150));

        const svgDataUrl = await domtoimage.toSvg(el, {
          width: 800,
          height: el.scrollHeight,
          style: {
            "background-color": "#111111",
          },
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
        gtag?.("event", "save_poster", {
          source_title: primaryMovie.title,
        });
      } catch (err) {
        console.error("Save image failed", err);
        setError("保存图片失败: " + err.message);
      } finally {
        setShowSaveLayout(false);
        setIsCapturing(false);
      }
    })();
  }, [showSaveLayout, primaryMovie.title, setShowSaveLayout, setIsCapturing, setError]);

  // ── 子页面数据加载 ──────────────────────────
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
        gtag?.("event", "view_movie_detail", {
          movie_title: data.title,
          movie_id: detailMovieId,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [step, detailMovieId, setDetailLoading, setDetailData]);

  // ── 子页面 SEO 更新 ─────────────────────────
  useEffect(() => {
    if (step === "detail" && detailData && primaryMovie?.title && sourceTmdbId && detailMovieId) {
      const sourceMovies = [
        { title: primaryMovie.title, year: primaryMovie.year, tmdbId: sourceTmdbId },
        ...(secondaryMovie?.tmdbId
          ? [{ title: secondaryMovie.title, year: secondaryMovie.year, tmdbId: secondaryMovie.tmdbId }]
          : []),
      ];
      const currentRec = (recommendations || []).find((r) => String(r.tmdbId) === String(detailMovieId));
      const matchedTags = currentRec?.matchedTags || [];
      updateSeo(sourceMovies, { ...detailData, tmdbId: detailMovieId }, locale);
      updateStructuredData(sourceMovies, { ...detailData, tmdbId: detailMovieId }, matchedTags, locale);
    }
  }, [step, detailData, primaryMovie?.title, primaryMovie?.year, primaryMovie?.tmdbId, secondaryMovie?.tmdbId, sourceTmdbId, detailMovieId, recommendations, locale]);

  // ── Discover 页面（独立路由，SEO 友好）─────
  const [showDiscover] = useState(() => {
    if (window.location.pathname === "/discover") return true;
    try {
      const redirect = sessionStorage.getItem("redirect");
      if (redirect === "/discover" || redirect === "/discover/") {
        sessionStorage.removeItem("redirect");
        return true;
      }
    } catch {}
    return false;
  });

  if (showDiscover) {
    return <DiscoverPage />;
  }

  return (
    <div className={`min-h-screen text-black selection:bg-[#ffff00] selection:text-black overflow-x-hidden pb-20 locale-${locale}`}>
      {showIntro ? (
        <SplashPage onStart={handleIntroStart} />
      ) : (
        <>
      <header className="relative z-10 flex flex-col items-center py-4 mb-10 bg-black border-b-8 border-[#ff00ff] shadow-[0_8px_0_0_rgba(0,255,255,1)]">
        <div className="flex items-center justify-center">
          <div className="bg-[#ffff00] p-2 border-4 border-black mr-4 transform -rotate-6">
            <span className="text-black transform rotate-90"><Icons.Play /></span>
          </div>
          <h1 className="text-xl sm:text-3xl font-black text-white pixel-font uppercase tracking-widest drop-shadow-[4px_4px_0_#ff00ff] whitespace-nowrap">
            KIM'S <span className="text-[#00ffff]">VIDEO</span>
          </h1>
        </div>
        <p className="text-gray-500 text-xs pixel-font mt-1 tracking-wider">{t('tagline')}</p>
        {new URLSearchParams(window.location.search).get("discover") === "1" && (
          <a
            href="/discover"
            className="absolute top-2 right-2 sm:top-3 sm:right-3 px-2 py-1 bg-[#00ffff] border-2 border-black text-black text-[10px] font-black pixel-font hover:bg-black hover:text-[#00ffff] transition-colors z-20"
          >
            ← DISCOVER
          </a>
        )}
      </header>

      <main className="relative z-10 container mx-auto px-4 md:py-8">
        {step === "input" && (
          <InputPage
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
            currentYear={currentYear}
            onShowInfo={() => setShowInfoModal(true)}
            toggleLocale={toggleLocale}
            locale={locale}
          />
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

      <footer className="fixed bottom-0 w-full z-10 text-center py-3 bg-black border-t-4 border-[#ffff00] text-white text-xs pixel-font uppercase tracking-widest">
        <p>
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="hover:text-[#00ffff] transition-colors">
            Data and poster from TMDB
          </a> | BLOODYREX (C) 2026
        </p>
      </footer>
      </>
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
}

export default App;
