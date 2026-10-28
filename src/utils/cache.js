import personalStore from "./personalStore";

const cacheKey = (tmdbId) => `kims_recos_${tmdbId}`;

/**
 * 写穿：sessionStorage（会话内同步命中）+ IndexedDB（跨重启持久化）。
 * IDB 写入异步且永不抛错——任何失败都不阻塞推荐主流程。
 */
export const saveResultsToCache = (tmdbId, data) => {
  if (!tmdbId) return;
  try {
    sessionStorage.setItem(cacheKey(tmdbId), JSON.stringify(data));
  } catch (_) {}
  personalStore.saveReco({ sourceId: tmdbId, payload: data }).catch(() => {});
};

/**
 * 读取：sessionStorage 命中优先；否则回退到 IDB 内存镜像
 * （镜像由 main.jsx 的 warmUp() 在启动时预热，保持同步签名）。
 */
export const loadResultsFromCache = (tmdbId) => {
  if (!tmdbId) return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(tmdbId));
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  try {
    return personalStore.peekReco(tmdbId) || null;
  } catch (_) {
    return null;
  }
};
