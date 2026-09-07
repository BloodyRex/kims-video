import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icons } from "./components/Icons";
import Loading from "./components/Loading";
import InputPage from "./components/InputPage";
import QAPage from "./components/QAPage";
import ResultsPage from "./components/ResultsPage";
import MovieDetail from "./components/MovieDetail";
import SaveContent from "./components/SaveContent";
import SplashPage from "./components/SplashPage";
import DiscoverPage from "./components/DiscoverPage";
import IntelligencePage from "./components/IntelligencePage";
import WallPage from "./components/WallPage";
import EntryPage from "./components/EntryPage";
import NewHomePage from "./components/NewHomePage";
import AdminPage from "./components/AdminPage";
import domtoimage from "dom-to-image-more";
import { fetchMovieByTmdbId } from "./services/api";
import { loadResultsFromCache } from "./utils/cache";
import { updateUrl } from "./utils/url";
import { updateSeo, updateStructuredData, resetSeo, injectStructuredData } from "./services/seo";
import { useMovieEngine } from "./logic/useMovieEngine";
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigationType } from "react-router-dom";
import { LocaleProvider, useLocale } from "./i18n";
import ShareButton from "./components/ShareButton";

// Entry portal route — the classic engine home lives here now (new home owns "/")
const ENTRY_ROUTE = "/recommend";

function ScrollManager() {
  // #2/#3/#5: PUSH/REPLACE(链接、标签切换)滚回顶部; POP(浏览器返回)按 pathname
  // 从 sessionStorage 恢复原位。scrollRestoration=manual 避免浏览器默认恢复与 React
  // 重渲染竞争(实测桌面 back 恢复随机)。写恢复位时跳过元素定位动画。
  const loc = useLocation();
  const navType = useNavigationType();
  const pendingKey = useRef(null);
  const restoring = useRef(false);

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    // 槽 key 用 pathname: 整页直达/书签/刷新的 location.key 恒为 "default",
    // 各页面会互相覆盖同一共享槽; pathname 粒度各页独立, 刷新后仍可恢复。
    const key = loc.pathname || "/";
    let raf = 0;
    let done = false;
    // 跳转/加载瞬间丢弃滚动写入, 直到下方 useEffect 设好新 key,
    // 防止 scrollTo(0) 的收尾 scroll 事件把 0 写进槽位。
    pendingKey.current = null;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", abort);
      window.removeEventListener("touchstart", abort);
      restoring.current = false;
    };
    // 用户主动滚动则放弃重试, 不和用户抢滚动条
    const abort = () => {
      done = true;
      cancelAnimationFrame(raf);
      restoring.current = false;
    };
    window.addEventListener("wheel", abort, { passive: true });
    window.addEventListener("touchstart", abort, { passive: true });
    if (navType === "POP") {
      const raw = sessionStorage.getItem("kv:scroll:" + key);
      const y = Number(raw);
      const target = Number.isFinite(y) ? y : 0;
      restoring.current = true;
      const deadline = performance.now() + 2000;
      // 返回时异步内容尚未撑起页面, 首帧 scrollTo 被钳制; 高度够后逐帧补到位
      const attempt = () => {
        if (done) return;
        window.scrollTo({ top: target, behavior: "instant" });
        if (Math.abs(window.scrollY - target) < 2) {
          finish();
          return;
        }
        if (performance.now() > deadline) {
          finish();
          return;
        }
        raf = requestAnimationFrame(attempt);
      };
      attempt();
    } else {
      finish();
      sessionStorage.removeItem("kv:scroll:" + key);
      const el = loc.hash ? document.getElementById(loc.hash.slice(1)) : null;
      if (el) el.scrollIntoView();
      else window.scrollTo({ top: 0, behavior: "instant" });
    }
    // 导航切换时兜底清理: abort 路径不走 finish(), 不补 cleanup 会泄漏到后续
    // 导航, 旧闭包的 abort 会提前关掉新一轮恢复的 restoring 开关
    return () => {
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", abort);
      window.removeEventListener("touchstart", abort);
    };
  }, [loc.key, navType]);

  // 记录当前 pathname 的滚动位置; 跳转瞬间 pendingKey 为 null(见上), 不写槽;
  // 恢复期产生的钳制滚动不回写, 保住原恢复位。
  useEffect(() => {
    pendingKey.current = loc.pathname || "/";
    const save = () => {
      if (restoring.current) return;
      const k = pendingKey.current;
      if (k) sessionStorage.setItem("kv:scroll:" + k, String(window.scrollY));
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [loc.key]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <LocaleProvider>
        <Routes>
          <Route path="/" element={<NewHomePage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/discover/genre/:slug" element={<DiscoverPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/intelligence" element={<IntelligencePage />} />
          <Route path="/intelligence/movies" element={<IntelligencePage />} />
          <Route path="/intelligence/tv" element={<IntelligencePage />} />
          <Route path="/intelligence/music" element={<IntelligencePage />} />
          <Route path="/intelligence/coming" element={<IntelligencePage />} />
          <Route path="/intelligence/weekly" element={<IntelligencePage />} />
          <Route path="/intelligence/search" element={<IntelligencePage />} />
          <Route path="/wall" element={<WallPage />} />
          {/* Legacy engine home (pre-new-home design) — kept at /recommend */}
          <Route path="/recommend" element={<AppContent />} />
          {/* Hidden test page: new 4-card entry portal */}
          <Route path="/entry" element={<EntryPage />} />
        </Routes>
        <ShareButtonWrapper />
      </LocaleProvider>
    </BrowserRouter>
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

  const { t, locale } = useLocale();

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
          setRecommendations(cached.recommendations || []);
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
          setRecommendations(cached.recommendations || []);
        }
        setStep("detail");
      } else if (sourceId) {
        setSourceTmdbId(sourceId);
        setDetailMovieId(null);
        setDetailData(null);
        const cached = loadResultsFromCache(sourceId);
        if (cached) {
          setPrimaryMovie(cached.primaryMovie);
          setRecommendations(cached.recommendations || []);
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

  return (
    <div className={`min-h-screen text-black selection:bg-[#ffff00] selection:text-black overflow-x-hidden pb-20 locale-${locale}`}>
      {showIntro ? (
        <SplashPage onStart={handleIntroStart} />
      ) : (
        <>
      <header className="relative z-10 flex flex-col items-center py-4 mb-10 bg-black border-b-8 border-[#ff00ff] shadow-[0_8px_0_0_rgba(0,255,255,1)]">
        <Link to="/" className="flex items-center justify-center hover:opacity-80 transition-opacity">
          <div className="bg-[#ffff00] p-2 border-4 border-black mr-4 transform -rotate-6">
            <span className="text-black transform rotate-90"><Icons.Play /></span>
          </div>
          <h1 className="text-lg sm:text-2xl font-black text-white pixel-font uppercase tracking-widest drop-shadow-[4px_4px_0_#ff00ff] whitespace-nowrap">
            KIM'S <span className="text-[#00ffff]">VIDEO</span>
          </h1>
        </Link>
        <p className="text-gray-500 text-[10px] max-sm:text-[9px] pixel-font mt-1 tracking-wider">{t('tagline')}</p>
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
              locale={locale}
            />
            {/* Entry buttons */}
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

      <LangButtonWrapper />

      <footer className={`fixed bottom-0 w-full z-10 text-center py-3 bg-black border-t-4 border-[#ffff00] text-white ${locale === "zh" ? "text-sm max-sm:text-xs font-bold tracking-wider" : "pixel-font text-[10px] max-sm:text-[9px] uppercase tracking-widest"}`}>
        <p>
          <Link to="/discover" className="hover:text-[#ffff00] transition-colors">{t('footer.discover')}</Link>
          <span className="text-gray-600 mx-2">|</span>
          <Link to="/intelligence" className="hover:text-[#00ffff] transition-colors">{t('footer.intel')}</Link>
          <span className="text-gray-600 mx-2">|</span>
          <Link to="/wall" className="hover:text-[#ff00ff] transition-colors">{t('footer.wall')}</Link>
          <span className="text-gray-600 mx-2">|</span>
          <a href="mailto:rexhr@yahoo.com" className="hover:text-[#ffff00] transition-colors">{t('footer.contact')}</a>
          <span className="text-gray-800 mx-1">·</span>
          <Link to="/admin" className="text-gray-800 hover:text-[#ffff00] transition-colors text-[8px] opacity-20 hover:opacity-100">·</Link>
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

function ShareButtonWrapper() {
  const { locale } = useLocale();
  const { pathname } = useLocation();
  // No floating buttons on the entry portal(s) — clean full-bleed card pages.
  // /entry = 4-card test portal; /recommend = legacy engine home.
  if (pathname === ENTRY_ROUTE || pathname === "/entry") return null;
  return <ShareButton locale={locale} />;
}

const LANG_BUTTON_STYLE_APP = {
  fontFamily: "'Press Start 2P','Courier New',Courier,monospace",
};

function LangButtonWrapper() {
  const { locale, toggleLocale } = useLocale();
  return (
    <div className="fixed bottom-[116px] sm:bottom-[128px] right-3 sm:right-4 z-40">
      <button onClick={toggleLocale}
        className="w-7 h-7 sm:w-8 sm:h-8 bg-[#ff00ff] border-2 border-black text-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors font-black text-[10px] sm:text-xs shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none"
        style={LANG_BUTTON_STYLE_APP}>
        {locale === "zh" ? "En" : "中"}
      </button>
    </div>
  );
}

export default App;
