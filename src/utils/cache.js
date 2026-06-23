const cacheKey = (tmdbId) => `kims_recos_${tmdbId}`;

export const saveResultsToCache = (tmdbId, data) => {
  if (!tmdbId) return;
  try {
    sessionStorage.setItem(cacheKey(tmdbId), JSON.stringify(data));
  } catch (_) {}
};

export const loadResultsFromCache = (tmdbId) => {
  if (!tmdbId) return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(tmdbId));
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};
