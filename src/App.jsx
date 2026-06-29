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
import AdminPage from "./components/AdminPage";
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

  // URL param routing
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

  // Browser back/forward
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

  // Init SEO
  useEffect(() => {
    resetSeo(locale);
  }, [locale]);

  // Screenshot capture effect
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

  // Sub-page data load
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

  // Sub-page SEO update
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

  // Discover page
  // Admin page route
  const [showAdmin] = useState(() => window.location.pathname.startsWith("/admin"));

  const [showDiscover] = useState(() => {
    if (window.location.pathname.startsWith("/discover") || window.location.pathname.startsWith("/genre")) return true;
    try {
      const redirect = sessionStorage.getItem("redirect");
      if (redirect && (redirect.startsWith("/discover") || redirect.startsWith("/genre"))) {
        sessionStorage.removeItem("redirect");
        return true;
      }
    } catch {}
    return false;
  });

  if (showAdmin) {
    return <AdminPage />;
  }

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
      </header>

      <main className="relative z-10 container mx-auto px-4 md:py-8">
        {step === "input" && (
          <>
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
            {/* Discover teaser banner */}
            <div className="max-w-2xl mx-auto mt-6 mb-4">
              <a
                href="/discover"
                className="block bg-[#ffff00] border-4 border-black px-4 py-3 shadow-[6px_6px_0_0_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-[3px_3px_0_0_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all text-center group"
              >
                <span className="text-black font-black pixel-font uppercase tracking-wider text-sm flex items-center justify-center gap-2">
                  <span className="text-base">{'\u{1F3AC}'}</span>
                  {t('input.browse_discover')}
                  <Icons.ChevronRight className="group-hover:translate-x-1 transition-transform ml-1" />
                </span>
              </a>
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

      <footer className="fixed bottom-0 w-full z-10 text-center py-3 bg-black border-t-4 border-[#ffff00] text-white text-xs pixel-font uppercase tracking-widest">
        <p>
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="hover:text-[#00ffff] transition-colors">
            Data from TMDB
          </a>
          <span className="text-gray-600 mx-2">|</span>
          <a href="/discover" className="hover:text-[#ffff00] transition-colors">Discover</a>
          <span className="text-gray-600 mx-2">|</span>
          <a href="mailto:rexhr@yahoo.com" className="hover:text-[#ffff00] transition-colors">BLOODYREX</a>
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