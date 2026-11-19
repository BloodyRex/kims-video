/**
 * Poster URL proxy helper
 * TMDB/CDN images may be blocked in some regions (CN mainland),
 * so we route through our Cloudflare Worker proxy.
 */
export function posterUrl(path) {
  if (!path) return "";
  if (path.startsWith("https://image.tmdb.org/") || path.startsWith("https://coverartarchive.org/")) {
    return "https://api.bloodyrex.xyz/poster-proxy?url=" + encodeURIComponent(path);
  }
  return path;
}

/**
 * Legacy alias for backward compatibility
 */
export function thumb(path) {
  if (!path) return "";
  if (path.startsWith("https://image.tmdb.org/")) {
    return path.replace("/w500/", "/w92/");
  }
  return path;
}