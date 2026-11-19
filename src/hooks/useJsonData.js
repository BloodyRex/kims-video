import { useState, useEffect } from "react";

/**
 * Unified hook for fetching JSON data with loading/error/retry states
 * @param {string} endpoint - API endpoint to fetch
 * @returns {{ data: any, loading: boolean, error: boolean, retry: function }}
 */
export function useJsonData(endpoint) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!endpoint) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(endpoint)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(json => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) { setData(null); setError(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [endpoint, attempt]);

  return { data, loading, error, retry: () => setAttempt(a => a + 1) };
}