import { useState, useEffect, useRef } from "react";
import { fetchMovieByTmdbId } from "../services/api";

/**
 * Unified hook for loading movie/TV/album detail data.
 * Handles caching, cancellation, loading states, and request deduplication.
 * 
 * @param {string|number|null} tmdbId - TMDB ID to fetch
 * @param {string} locale - "zh" or "en"
 * @param {string} type - "movie" | "tv" | "album" (for logging)
 * @returns {{ data: object|null, loading: boolean, error: boolean }}
 */
export function useMovieDetail(tmdbId, locale, type = "movie") {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Request deduplication cache (per session)
  const cacheRef = useRef({});
  const pendingRef = useRef({});

  useEffect(() => {
    if (!tmdbId) {
      setData(null);
      setLoading(false);
      setError(false);
      return;
    }

    const cacheKey = `${tmdbId}:${locale}`;
    
    // Return cached data immediately if available
    if (cacheRef.current[cacheKey]) {
      setData(cacheRef.current[cacheKey]);
      setLoading(false);
      setError(false);
      return;
    }

    // If request already in progress, wait for it
    if (pendingRef.current[cacheKey]) {
      pendingRef.current[cacheKey].then(result => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      }).catch(() => {
        if (!cancelled) {
          setData(null);
          setLoading(false);
          setError(true);
        }
      });
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    // Create promise for deduplication
    const promise = fetchMovieByTmdbId(tmdbId, locale)
      .then((result) => {
        const finalResult = result || null;
        if (!cancelled) {
          cacheRef.current[cacheKey] = finalResult;
          setData(finalResult);
          setLoading(false);
        }
        delete pendingRef.current[cacheKey];
        return finalResult;
      })
      .catch((err) => {
        if (!cancelled) {
          setData(null);
          setLoading(false);
          setError(true);
        }
        delete pendingRef.current[cacheKey];
        throw err;
      });

    pendingRef.current[cacheKey] = promise;

    return () => { cancelled = true; };
  }, [tmdbId, locale]);

  return { data, loading, error };
}