import { useState, useEffect, useRef, useMemo } from "react";
import { fetchMovieByTmdbId } from "../services/api";
import { fetchDiscoverResults, likeDiscoverResult } from "../services/discoverApi";
import { GENRE_ZH } from "../components/Cards";

const COMMON_GENRES = [
  "Action", "Sci-Fi", "Comedy", "Romance",
  "Horror", "Drama", "Animation", "Thriller", "Documentary",
];

const PAGE_SIZE = 24;

export function useDiscoverData(discoverData, { locale }) {
  const zh = locale === "zh";

  // Pre-compute normalized genre map once — avoids repeated GENRE_ZH lookups in filters
  const normGenreMap = useMemo(() => {
    const map = {};
    Object.keys(GENRE_ZH).forEach(k => { map[k] = GENRE_ZH[k]; });
    return map;
  }, []);
  const normGenre = (g) => normGenreMap[g] || g;
  const COMMON_ZH = useMemo(() => COMMON_GENRES.map(normGenre), [normGenre]);

  const [posterMap, setPosterMap] = useState({});
  const [metaMap, setMetaMap] = useState({});
  const [dailyPicks, setDailyPicks] = useState([]);
  const [userResults, setUserResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [sourceMode, setSourceMode] = useState("community");
  const [genreFilter, setGenreFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const [modalThumbnail, setModalThumbnail] = useState(null);
  const [detailPair, setDetailPair] = useState(null);
  const [detailPick, setDetailPick] = useState(null);
  const scrollRef = useRef(null);

  const getTitle = (movie) => locale === "en" ? (movie.titleEn || movie.title) : movie.title;

  useEffect(() => {
    document.title = zh ? "发现 | AI 电影推荐社区 | Kim's Video" : "Discover | AI Movie Recommendations | Kim's Video";
  }, [locale, zh]);

  // Posters + meta for the curated library (localStorage cache, 24h TTL)
  useEffect(() => {
    const allIds = new Set();
    discoverData.genres.forEach(g => g.pairs.forEach(p => { allIds.add(p.source.tmdbId); allIds.add(p.recommend.tmdbId); }));
    let cancelled = false;
    (async () => {
      try {
        const cached = localStorage.getItem("kims_discover_posters");
        const ts = localStorage.getItem("kims_discover_posters_ts");
        if (cached && ts && (Date.now() - parseInt(ts)) < 86400000) {
          const parsed = JSON.parse(cached);
          if (!cancelled) setPosterMap(parsed);
        }
      } catch {}
      const map = {};
      const meta = {};
      const ids = [...allIds];
      for (let i = 0; i < ids.length; i += 5) {
        const batch = ids.slice(i, i + 5);
        await Promise.allSettled(batch.map(async id => {
          const data = await fetchMovieByTmdbId(id, "zh");
          if (!data || cancelled) return;
          if (data.poster) map[id] = data.poster;
          meta[id] = {
            rating: data.vote_average || data.rating || 0,
            genres: Array.isArray(data.genres) ? data.genres.map(g => g.name || g) : [],
            releaseDate: data.release_date || data.releaseDate || "",
            originalTitle: data.original_title || data.originalTitle || "",
            year: (data.release_date || data.releaseDate || "").slice(0, 4) || data.year || "",
          };
        }));
      }
      if (!cancelled) {
        setPosterMap(prev => ({ ...prev, ...map }));
        setMetaMap(meta);
        try { localStorage.setItem("kims_discover_posters", JSON.stringify(map)); localStorage.setItem("kims_discover_posters_ts", String(Date.now())); } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [discoverData, locale, fetchMovieByTmdbId]);

  // Day's editor picks (fixed 6, ★/💎/🔥) — same data as Intelligence 总览.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let d = await fetch("/api/discover-daily.json").then(r => (r.ok ? r.json() : null));
        if (!d) d = await fetch("/api/overview.json").then(r => (r.ok ? r.json() : null));
        if (!cancelled) setDailyPicks(d?.picks || d?.editorsPicks || []);
      } catch {
        if (!cancelled) setDailyPicks([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Community results
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingResults(true);
      try { const data = await fetchDiscoverResults({ sort: "popular", limit: 30 }); if (!cancelled) setUserResults(data.results || []); } catch { if (!cancelled) setUserResults([]); }
      if (!cancelled) setLoadingResults(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const userRecTmdbIds = useMemo(() => {
    const ids = [];
    userResults.forEach(r => r.recommendations?.forEach(rec => { if (rec.tmdbId) ids.push(rec.tmdbId); }));
    return ids;
  }, [userResults]);

  const [userPosterMap, setUserPosterMap] = useState({});
  useEffect(() => {
    const unique = [...new Set(userRecTmdbIds)];
    if (!unique.length) return;
    let cancelled = false;
    (async () => {
      let cache = {};
      try {
        const c = localStorage.getItem("kims_discover_user_posters");
        const ts = localStorage.getItem("kims_discover_user_posters_ts");
        if (c && ts && (Date.now() - parseInt(ts)) < 86400000) cache = JSON.parse(c) || {};
      } catch {}
      const fresh = {};
      const result = {};
      unique.forEach(id => { if (cache[String(id)]) result[id] = cache[String(id)]; });
      const miss = unique.filter(id => !cache[String(id)]);
      if (!cancelled) setUserPosterMap(prev => ({ ...prev, ...result }));
      for (let i = 0; i < miss.length; i += 5) {
        const batch = miss.slice(i, i + 5);
        await Promise.allSettled(batch.map(async id => {
          const data = await fetchMovieByTmdbId(id, "zh");
          if (data?.poster && !cancelled) { result[id] = data.poster; fresh[id] = data.poster; }
        }));
        if (!cancelled) setUserPosterMap(prev => ({ ...prev, ...result }));
      }
      if (!cancelled && Object.keys(fresh).length) {
        try {
          localStorage.setItem("kims_discover_user_posters", JSON.stringify({ ...cache, ...fresh }));
          localStorage.setItem("kims_discover_user_posters_ts", String(Date.now()));
        } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [JSON.stringify([...new Set(userRecTmdbIds)].sort())]);

  // Filtering
  const allPairs = useMemo(() => discoverData.genres.flatMap(g => g.pairs), [discoverData]);

  const filteredPairs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allPairs.filter((p) => {
      const genres = (metaMap[p.recommend.tmdbId]?.genres || []).map(normGenre);
      if (genreFilter === "other") {
        if (genres.some(g => COMMON_ZH.includes(g))) return false;
      } else if (genreFilter !== "all") {
        const fz = normGenre(genreFilter);
        if (!genres.some(g => g === fz)) return false;
      }
      if (q) {
        const hit =
          (p.recommend.title || "").toLowerCase().includes(q) ||
          (p.recommend.titleEn || "").toLowerCase().includes(q) ||
          (p.source.title || "").toLowerCase().includes(q) ||
          (p.source.titleEn || "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [allPairs, metaMap, genreFilter, searchQuery]);

  const filteredUserResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return userResults.filter((r) => {
      if (genreFilter !== "all") {
        const fz = normGenre(genreFilter);
        if ((r.genre || "剧情") !== fz) return false;
      }
      if (q) {
        const hay = [
          r.contributorName || "",
          ...(r.recommendations || []).map(rec => rec.title || ""),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [userResults, genreFilter, searchQuery]);

  useEffect(() => { setPage(1); }, [genreFilter, searchQuery, sourceMode]);

  const totalPages = Math.max(1, Math.ceil(
    (sourceMode === "editor" ? filteredPairs.length : filteredUserResults.length) / PAGE_SIZE
  ));
  const safePage = Math.min(page, totalPages);
  const pageItems = sourceMode === "editor"
    ? filteredPairs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : filteredUserResults.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const itemCount = sourceMode === "editor" ? filteredPairs.length : filteredUserResults.length;

  const buildPages = (current, total) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const set = new Set([1, total, current - 1, current, current + 1]);
    return [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  };

  const handleLike = async (resultId) => {
    try {
      const r = await likeDiscoverResult(resultId);
      setUserResults(prev => prev.map(x => x.id === resultId ? { ...x, likes: r.likes } : x));
    } catch (e) { console.error("Like failed:", e); }
  };

  return {
    // state
    zh,
    locale,
    posterMap,
    metaMap,
    dailyPicks,
    userResults,
    userPosterMap,
    loadingResults,
    sourceMode,
    setSourceMode,
    genreFilter,
    setGenreFilter,
    searchQuery,
    setSearchQuery,
    page,
    setPage,
    totalPages,
    safePage,
    pageItems,
    itemCount,
    filteredPairs,
    filteredUserResults,
    modalThumbnail,
    setModalThumbnail,
    detailPair,
    setDetailPair,
    detailPick,
    setDetailPick,
    scrollRef,
    // methods
    buildPages,
    totalPages,
    safePage,
    pageItems,
    itemCount,
    handleLike,
    // refs
    scrollRef,
  };
}