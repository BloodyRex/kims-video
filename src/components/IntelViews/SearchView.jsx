import React, { useState, useEffect, useMemo } from "react";
import { useJsonData } from "../../hooks/useJsonData";
import { SectionHeader, CardGrid, MovieCard, TVCard, AlbumCard } from "../Cards";
import { useLocale } from "../../i18n";

function LoadingSpinner({ locale }) {
  return (
    <div className="flex items-center justify-center py-16">
      <span className="text-gray-500 text-xs pixel-font">{locale === "zh" ? "数据加载中..." : "Loading..."}</span>
    </div>
  );
}

function DataError({ locale, onRetry }) {
  return (
    <div className="text-center py-8">
      <p className="text-red-400 text-xs pixel-font mb-4">
        {locale === "zh" ? "数据加载失败，请稍后重试" : "Failed to load data. Please retry."}
      </p>
      <button
        onClick={onRetry}
        className="inline-block px-6 py-2 text-xs font-black bg-[#ffff00] border-4 border-black pixel-font uppercase shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all"
      >
        {locale === "zh" ? "重试" : "RETRY"}
      </button>
    </div>
  );
}

function SearchView({ locale, onViewDetail }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ movies: [], tv: [], albums: [] });
  const [searching, setSearching] = useState(false);

  const { data: movies, loading: moviesLoading, error: moviesError, retry } = useJsonData("/api/movies.json");
  const { data: tv, loading: tvLoading, error: tvError } = useJsonData("/api/tv.json");
  const { data: music, loading: musicLoading, error: musicError } = useJsonData("/api/music.json");
  const { data: coming, loading: comingLoading, error: comingError } = useJsonData("/api/coming.json");
  const anyLoading = moviesLoading || tvLoading || musicLoading || comingLoading;
  const allFailed = moviesError && tvError && musicError && comingError;

  const allItems = useMemo(() => {
    const items = [];
    const add = (list, type) => { if (Array.isArray(list)) list.forEach(item => items.push({ ...item, _type: type })); };
    if (movies) { add(movies.releasedToday, "movie"); add(movies.releasedThisWeek, "movie"); add(movies.upcoming, "movie"); add(movies.nowPlaying, "movie"); }
    if (tv) { add(tv.premieresThisWeek, "tv"); add(tv.upcoming, "tv"); add(tv.ongoing, "tv"); }
    if (music) { add(music.picks, "album"); }
    if (coming) {
      [...(coming.next7Days || []), ...(coming.next30Days || [])].forEach(item => items.push({ ...item, _type: item.mediaType === "tv" ? "tv" : item.mediaType === "album" || item.mediaType === "single" ? "album" : "movie" }));
    }
    const seen = new Set();
    return items.filter(item => {
      const key = item.title + (item.artist || "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [movies, tv, music]);

  useEffect(() => {
    if (!query.trim() || allItems.length === 0) { setResults({ movies: [], tv: [], albums: [] }); return; }
    setSearching(true);
    const q = query.toLowerCase();
    const filtered = allItems.filter(item => {
      const title = (item.title || "").toLowerCase();
      const artist = (item.artist || "").toLowerCase();
      const titleEn = (item.titleEn || "").toLowerCase();
      const genre = (Array.isArray(item.genre) ? item.genre.join(" ") : (item.genre || "")).toLowerCase();
      const tags = (item.tags || []).join(" ").toLowerCase();
      return title.includes(q) || artist.includes(q) || titleEn.includes(q) || genre.includes(q) || tags.includes(q);
    });
    setResults({
      movies: filtered.filter(i => i._type === "movie"),
      tv: filtered.filter(i => i._type === "tv"),
      albums: filtered.filter(i => i._type === "album"),
    });
    setSearching(false);
  }, [query, allItems]);

  const totalCount = results.movies.length + results.tv.length + results.albums.length;

  return (
    <div className="space-y-6">
      <SectionHeader label={locale === "zh" ? "搜索" : "Search"} color="#00ffff" />
      {allFailed ? (
        <DataError locale={locale} onRetry={retry} />
      ) : anyLoading ? (
        <LoadingSpinner locale={locale} />
      ) : (
        <>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              if (e.target.composing) return;
              setQuery(e.target.value);
            }}
            onCompositionStart={(e) => { e.target.composing = true; }}
            onCompositionEnd={(e) => { e.target.composing = false; }}
            placeholder={locale === "zh" ? "搜索电影、剧集、专辑..." : "Search movies, TV, albums..."}
            className="w-full px-4 py-3 border-4 border-black text-sm font-bold bg-white focus:outline-none focus:border-[#00ffff] shadow-[4px_4px_0_0_rgba(0,0,0,1)]"
          />
          {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">...</span>}
        </div>
        {query.trim() && (
          <p className="text-[10px] text-gray-500 pixel-font">
            {locale === "zh" ? "共找到 " : "Found "}{totalCount}{locale === "zh" ? " 个结果" : " results"}
          </p>
        )}
        {results.movies.length > 0 && (
          <section>
            <SectionHeader label={locale === "zh" ? "电影" : "Movies"} count={results.movies.length} color="#ff00ff" />
            <CardGrid cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">{results.movies.slice(0, 12).map((m, i) => <MovieCard key={i} movie={m} locale={locale} onViewDetail={(item) => onViewDetail?.(item, "movie")} />)}</CardGrid>
          </section>
        )}
        {results.tv.length > 0 && (
          <section>
            <SectionHeader label={locale === "zh" ? "剧集" : "TV"} count={results.tv.length} color="#00ffff" />
            <CardGrid cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">{results.tv.slice(0, 12).map((s, i) => <TVCard key={i} show={s} locale={locale} onViewDetail={(item) => onViewDetail?.(item, "tv")} />)}</CardGrid>
          </section>
        )}
        {results.albums.length > 0 && (
          <section>
            <SectionHeader label={locale === "zh" ? "专辑" : "Albums"} count={results.albums.length} color="#ffff00" />
            <CardGrid cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">{results.albums.slice(0, 12).map((a, i) => <AlbumCard key={i} album={a} locale={locale} onViewDetail={(item) => onViewDetail?.(item, "album")} />)}</CardGrid>
          </section>
        )}
        {query.trim() && !searching && totalCount === 0 && (
          <p className="text-gray-500 text-sm text-center py-12">
            {locale === "zh" ? "没有找到匹配结果" : "No results found"}
          </p>
        )}
        </>
      )}
    </div>
  );
}

export default SearchView;