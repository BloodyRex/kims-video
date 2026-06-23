import { API_BASE_URL } from "../services/config";

export const posterProxy = (url) => {
  if (!url || !url.startsWith("https://image.tmdb.org/")) return url;
  return `${API_BASE_URL}poster-proxy?url=${encodeURIComponent(url)}`;
};

export const updateUrl = (sourceIds, detailId) => {
  const ids = Array.isArray(sourceIds)
    ? sourceIds.filter(Boolean)
    : sourceIds
    ? [Number(sourceIds)]
    : [];
  const fromParam = ids.join(",");
  if (fromParam && detailId) {
    window.history.pushState(
      { sourceIds: ids, detailId },
      "",
      `?from=${fromParam}&r=${detailId}`
    );
  } else if (fromParam) {
    window.history.pushState({ sourceIds: ids }, "", `?from=${fromParam}`);
  } else {
    window.history.pushState({}, "", "/");
  }
};
