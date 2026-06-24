import { useState, useRef, useCallback } from "react";
import { generateAIContent, verifyMovieTmdbId, repairRecommendationFields } from "../services/api";
import { parseJSON } from "../utils/parseJSON";
import { saveResultsToCache, loadResultsFromCache } from "../utils/cache";
import { updateUrl } from "../utils/url";
import { injectStructuredData, resetSeo } from "../services/seo";
import {
  buildSearchPrompt,
  searchSchema,
  buildQuestionPrompt,
  questionSchema,
  buildRecommendationPrompt,
  recommendationSchema,
  buildFillPrompt,
  fillSchema,
  buildReplacePrompt,
  replaceSchema,
} from "../services/prompts";

export function useMovieEngine() {
  const [step, setStep] = useState("input");
  const [primaryMovie, setPrimaryMovie] = useState({ title: "", year: "" });
  const [secondaryMovie, setSecondaryMovie] = useState({ title: "", year: "" });

  const [primarySuggestions, setPrimarySuggestions] = useState([]);
  const [secondarySuggestions, setSecondarySuggestions] = useState([]);
  const [isSearchingPrimary, setIsSearchingPrimary] = useState(false);
  const [isSearchingSecondary, setIsSearchingSecondary] = useState(false);
  const [showPrimaryDropdown, setShowPrimaryDropdown] = useState(false);
  const [showSecondaryDropdown, setShowSecondaryDropdown] = useState(false);

  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);

  const [recommendations, setRecommendations] = useState([]);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");

  const [replacingIndexes, setReplacingIndexes] = useState({});
  const [everShownTitles, setEverShownTitles] = useState([]);

  const searchIdRef = useRef(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showSaveLayout, setShowSaveLayout] = useState(false);

  const [sourceTmdbId, setSourceTmdbId] = useState(null);
  const [detailMovieId, setDetailMovieId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const currentYear = new Date().getFullYear();

  const normalizeQuestion = useCallback((q) => ({
    ...q,
    text: q.text || q.question || "",
  }));

  const searchMovie = useCallback(async (query, type) => {
    const isPrimary = type === "primary";
    const setSuggestions = isPrimary ? setPrimarySuggestions : setSecondarySuggestions;
    const setIsSearching = isPrimary ? setIsSearchingPrimary : setIsSearchingSecondary;
    const setShowDropdown = isPrimary ? setShowPrimaryDropdown : setShowSecondaryDropdown;

    const id = ++searchIdRef.current;

    if (!query || query.trim().length === 0) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setIsSearching(true);
    setShowDropdown(true);

    try {
      const responseText = await generateAIContent(
        buildSearchPrompt(query),
        "你是一个影视数据库查询API，根据关键词联想匹配的真实影视作品名称，以JSON数组返回。",
        searchSchema
      );

      if (id !== searchIdRef.current) return;

      const parsedData = parseJSON(responseText);
      const list = Array.isArray(parsedData) ? parsedData.filter((item) => item.title) : [];
      setSuggestions(list);
    } catch (error) {
      if (id !== searchIdRef.current) return;
      console.error("Search failed", error);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  });

  const selectMovie = (movie, type) => {
    if (type === "primary") {
      setPrimaryMovie({ title: movie.title, year: movie.year, tmdbId: movie.tmdbId || null });
      setShowPrimaryDropdown(false);
    } else {
      setSecondaryMovie({ title: movie.title, year: movie.year, tmdbId: movie.tmdbId || null });
      setShowSecondaryDropdown(false);
    }
    verifyMovieTmdbId(movie.title, movie.year).then((result) => {
      if (result?.tmdbId) {
        if (type === "primary") {
          setPrimaryMovie((prev) => ({ ...prev, tmdbId: result.tmdbId }));
        } else {
          setSecondaryMovie((prev) => ({ ...prev, tmdbId: result.tmdbId }));
        }
      }
    });
  };

  const handleGenerateQuestions = async () => {
    if (!primaryMovie.title || !primaryMovie.year) {
      setError("主参考影视作品的名称和首映年份为必填项！");
      return;
    }
    if (primaryMovie.year < 1895 || primaryMovie.year > currentYear) {
      setError("请输入有效的年份。");
      return;
    }

    setError("");
    setStep("loading_questions");
    setLoadingMessage('"电影不死，它们只是在等待被寻找。"');

    try {
      const responseText = await generateAIContent(
        buildQuestionPrompt(primaryMovie, secondaryMovie),
        "你是一个专业的影视剧集推荐专家。",
        questionSchema
      );
      const parsedData = parseJSON(responseText);
      if (Array.isArray(parsedData)) {
        setQuestions(parsedData.slice(0, 8).map(normalizeQuestion));
        setStep("qa");
      } else if (parsedData.questions && parsedData.questions.length >= 3) {
        const count = parsedData.questionCount || parsedData.questions.length;
        setQuestions(parsedData.questions.slice(0, count).map(normalizeQuestion));
        setStep("qa");
      } else {
        throw new Error("生成的问题数量不足或格式错误");
      }
    } catch (err) {
      setError("生成问答失败，请重试。" + err.message);
      setStep("input");
    }
  };

  const handleAnswer = async (answerText) => {
    const currentQuestion = questions[currentQIndex];
    const newAnswers = [
      ...userAnswers,
      { question: currentQuestion.text, answer: answerText, feature: currentQuestion.feature },
    ];
    setUserAnswers(newAnswers);

    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
    } else {
      await generateRecommendations(newAnswers);
    }
  };

  const generateRecommendations = async (finalAnswers) => {
    setStep("loading_results");
    setLoadingMessage("正在检索稀有胶片库...");

    const answersText = finalAnswers.map((a) =>
      `\n特征维度: ${a.feature}\n\n用户选择:\n${a.answer}\n`
    ).join("\n");

    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
        try {
          const responseText = await generateAIContent(
            buildRecommendationPrompt(primaryMovie, secondaryMovie, answersText),
            "你是一个极具洞察力的专业影视推荐达人。",
            recommendationSchema
          );
          const parsedData = parseJSON(responseText);
          const list = parsedData?.recommendations || [];
          if (!Array.isArray(list) || list.length === 0) throw new Error("未能生成有效的推荐列表");

          let recs = await Promise.all(list.map((r) => repairRecommendationFields(r, generateAIContent)));

          const userMovieTitles = [primaryMovie.title, secondaryMovie.title].filter(Boolean);
          const userTmdbIds = [primaryMovie.tmdbId, secondaryMovie.tmdbId].filter(Boolean);
          let finalRecs = recs.filter((r) => {
            if (userMovieTitles.includes(r.title)) return false;
            if (r.tmdbId && userTmdbIds.includes(r.tmdbId)) return false;
            return true;
          });

          const everShownSet = new Set();
          for (const t of userMovieTitles) everShownSet.add(t);
          for (const id of userTmdbIds) everShownSet.add(`tmdb:${id}`);
          for (const r of recs) {
            everShownSet.add(r.title);
            if (r.tmdbId) everShownSet.add(`tmdb:${r.tmdbId}`);
          }
          const everShown = [...everShownSet];

          if (finalRecs.length < 5) {
            for (let i = finalRecs.length; i < 5; i++) {
              const excludeStr = everShown.map((t) => `《${t}》`).join("、");
              try {
                const fillResult = await generateAIContent(
                  buildFillPrompt(excludeStr, i),
                  "你是一个严格的影视数据库查询API。只输出JSON，不解释。不编造。",
                  fillSchema
                );
                const fillData = parseJSON(fillResult);
                const fillMovie = fillData?.recommendations?.[0];
                if (fillMovie && fillMovie.title) {
                  const repaired = await repairRecommendationFields(
                    { ...fillMovie, poster: fillMovie.poster || null, tmdbId: fillMovie.tmdbId || null },
                    generateAIContent
                  );
                  finalRecs.push(repaired);
                  everShown.push(fillMovie.title);
                  if (fillMovie.tmdbId) everShown.push(`tmdb:${fillMovie.tmdbId}`);
                }
              } catch (_) {}
            }
          }

          setRecommendations(finalRecs);
          setEverShownTitles(everShown);
          setStep("results");

          gtag?.("event", "generate_recommendation", {
            source_title: primaryMovie.title,
            source_year: primaryMovie.year,
            rec_count: finalRecs.length,
          });

          if (finalRecs.length > 0) {
            const sourceId = primaryMovie?.tmdbId
              ? Number(primaryMovie.tmdbId)
              : sourceTmdbId || (finalRecs[0]?.tmdbId ? Number(finalRecs[0].tmdbId) : null);
            if (sourceId) {
              if (!sourceTmdbId) setSourceTmdbId(sourceId);
              const urlSourceIds = [sourceId, secondaryMovie?.tmdbId ? Number(secondaryMovie.tmdbId) : null].filter(Boolean);
              updateUrl(urlSourceIds);
              saveResultsToCache(sourceId, { primaryMovie, recommendations: finalRecs });
            }
            injectStructuredData(primaryMovie);
          }

          break;
        } catch (innerErr) {
          if (attempt === 1) throw innerErr;
        }
      }
    } catch (err) {
      setError("生成推荐失败，请重试。" + err.message);
      setStep("qa");
      setCurrentQIndex(questions.length - 1);
      setUserAnswers(userAnswers.slice(0, -1));
    }
  };

  const replaceOneRecommendation = async (index) => {
    if (replacingIndexes[index]) return;
    setReplacingIndexes((prev) => ({ ...prev, [index]: true }));

    const isNiche = index >= 2 && index <= 3;
    const isControversial = index === 4;
    const excludeSet = new Set([
      ...everShownTitles,
      primaryMovie.title,
      ...(secondaryMovie?.title ? [secondaryMovie.title] : []),
      ...(primaryMovie.tmdbId ? [`tmdb:${primaryMovie.tmdbId}`] : []),
      ...(secondaryMovie?.tmdbId ? [`tmdb:${secondaryMovie.tmdbId}`] : []),
    ]);

    const answersText = userAnswers.map((a) =>
      `\n特征维度: ${a.feature}\n\n用户选择:\n${a.answer}\n`
    ).join("\n");

    let safeRec = null;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const excludeList = [...excludeSet].map((t) => `《${t}》`).join("、");
          const result = await generateAIContent(
            buildReplacePrompt(primaryMovie, secondaryMovie, answersText, excludeList, isNiche, isControversial),
            "你是一个严格的影视数据库查询API。只输出JSON，不解释。不编造。",
            replaceSchema
          );
          const parsedData = parseJSON(result);
          const rawRec = parsedData?.recommendations?.[0];

          if (!rawRec || !rawRec.title) {
            if (attempt < 2) continue;
            break;
          }

          if (excludeSet.has(rawRec.title) || (rawRec.tmdbId && excludeSet.has(`tmdb:${rawRec.tmdbId}`))) {
            excludeSet.add(rawRec.title);
            if (rawRec.tmdbId) excludeSet.add(`tmdb:${rawRec.tmdbId}`);
            if (attempt < 2) continue;
            break;
          }

          safeRec = {
            title: rawRec.title,
            originalTitle: rawRec.originalTitle || "",
            year: String(rawRec.year || ""),
            director: rawRec.director || "",
            type: rawRec.type || "",
            reason: rawRec.reason || rawRec.description || "",
            matchedTags: rawRec.matchedTags || [],
            doubanKeyword: rawRec.doubanKeyword || rawRec.title,
            poster: rawRec.poster || null,
            tmdbId: rawRec.tmdbId || null,
          };
          break;
        } catch (innerErr) {
          if (attempt < 2) continue;
          throw innerErr;
        }
      }
    } catch (err) {
      console.error("replaceOneRecommendation failed", err);
    }

    if (safeRec) {
      setRecommendations((prev) => {
        const updated = [...prev];
        updated[index] = safeRec;
        return updated;
      });
      setEverShownTitles((prev) => [...prev, safeRec.title, ...(safeRec.tmdbId ? [`tmdb:${safeRec.tmdbId}`] : [])]);
    }

    setReplacingIndexes((prev) => ({ ...prev, [index]: false }));
  };

  const resetApp = () => {
    resetSeo();
    setStep("input");
    setPrimaryMovie({ title: "", year: "" });
    setSecondaryMovie({ title: "", year: "" });
    setQuestions([]);
    setCurrentQIndex(0);
    setUserAnswers([]);
    setRecommendations([]);
    setReplacingIndexes({});
    setEverShownTitles([]);
    setError("");
    setSourceTmdbId(null);
    setDetailMovieId(null);
    setDetailData(null);
    updateUrl(null);
  };

  const handleSaveImage = () => {
    setShowSaveLayout(true);
    setIsCapturing(true);
  };

  const handleViewDetail = (recTmdbId) => {
    if (!recTmdbId) return;
    setDetailMovieId(String(recTmdbId));
    setDetailData(null);
    const sourceTmdbIds = [
      sourceTmdbId ? Number(sourceTmdbId) : null,
      secondaryMovie?.tmdbId ? Number(secondaryMovie.tmdbId) : null,
    ].filter(Boolean);
    updateUrl(sourceTmdbIds, recTmdbId);
    setStep("detail");
  };

  const handleShare = async () => {
    const currentUrl = window.location.href;
    const shareData = {
      title: "Kim's Video",
      text: `AI为我推荐了电影！基于《${primaryMovie.title}》${secondaryMovie.title ? `和《${secondaryMovie.title}》` : ""}，来看看你的品味基因检测报告 →`,
      url: currentUrl,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (_) {}
    } else {
      try {
        await navigator.clipboard.writeText(currentUrl);
        alert("链接已复制到剪贴板，分享给朋友吧！");
      } catch (_) {
        prompt("复制以下链接分享：", "https://bloodyrex.xyz");
      }
    }
  };

  const handleBackToResults = () => {
    resetSeo();
    const curParams = new URLSearchParams(window.location.search);
    const fromParam = curParams.get("from");
    const resultSourceIds = (fromParam?.split(",").filter(Boolean).map(Number) || []);

    const urlIds = resultSourceIds.length > 0 ? resultSourceIds : [sourceTmdbId].filter(Boolean);
    if (urlIds.length > 0) {
      updateUrl(urlIds);
    } else {
      updateUrl(null);
    }

    setDetailMovieId(null);
    setDetailData(null);
    setStep("results");
  };

  const handleDetailShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      gtag?.("event", "share_movie", {
        url: window.location.href,
        movie_id: detailMovieId,
      });
      alert("链接已复制到剪贴板，分享给朋友吧！");
    } catch (_) {
      prompt("复制以下链接分享：", window.location.href);
    }
  };

  return {
    // State
    step, setStep,
    primaryMovie, setPrimaryMovie,
    secondaryMovie, setSecondaryMovie,
    primarySuggestions, setPrimarySuggestions,
    secondarySuggestions, setSecondarySuggestions,
    isSearchingPrimary, isSearchingSecondary,
    showPrimaryDropdown, setShowPrimaryDropdown,
    showSecondaryDropdown, setShowSecondaryDropdown,
    questions, setQuestions,
    currentQIndex, setCurrentQIndex,
    userAnswers, setUserAnswers,
    recommendations, setRecommendations,
    loadingMessage, setLoadingMessage,
    error, setError,
    replacingIndexes,
    isCapturing,
    showSaveLayout, setShowSaveLayout,
    everShownTitles, setEverShownTitles,
    sourceTmdbId, setSourceTmdbId,
    detailMovieId, setDetailMovieId,
    detailData, setDetailData,
    detailLoading, setDetailLoading,
    currentYear,

    // Handlers
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
  };
}
