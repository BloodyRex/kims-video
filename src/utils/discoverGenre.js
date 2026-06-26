// TMDB genre ID → Chinese category mapping
const GENRE_MAP = {
  878: "科幻",
  9648: "悬疑",
  53: "悬疑",
  27: "恐怖",
  16: "动画",
  10752: "战争",
  80: "犯罪",
  18: "剧情",
  10749: "剧情",
  36: "剧情",
  10402: "剧情",
  14: "奇幻",
  12: "奇幻",
};

/**
 * Classify a list of TMDB genre IDs into one of 8 Chinese categories.
 * Falls back to "剧情" if no match.
 */
export function classifyGenre(genreIds) {
  if (!Array.isArray(genreIds)) return "剧情";
  for (const id of genreIds) {
    const cat = GENRE_MAP[id];
    if (cat) return cat;
  }
  return "剧情";
}