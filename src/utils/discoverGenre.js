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

/** 8 个标准类型（中文）→ 像素场景风格 key */
const CATEGORY_TO_STYLE = {
  科幻: "sci-fi",
  悬疑: "mystery",
  恐怖: "horror",
  动画: "animation",
  战争: "war",
  犯罪: "crime",
  剧情: "drama",
  奇幻: "fantasy",
};

/** 中/英/风格 key 三向词表，供像素场景偏好分析命中 */
export const GENRE_KEYWORDS = {
  "sci-fi": ["科幻", "sci-fi", "scifi", "science fiction", "太空", "space", "宇宙"],
  mystery: ["悬疑", "mystery", "惊悚", "thriller", "推理", "侦探", "detective"],
  horror: ["恐怖", "horror", "鬼", "怪物", "monster", "丧尸"],
  animation: ["动画", "animation", "animated", "动漫", "anime", "卡通"],
  war: ["战争", "war", "军事", "military", "战场", "battle"],
  crime: ["犯罪", "crime", "黑帮", "gangster", "警匪", "heist"],
  drama: ["剧情", "drama", "爱情", "romance", "家庭", "family"],
  fantasy: ["奇幻", "fantasy", "冒险", "adventure", "魔法", "magic", "史诗"],
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

/** 中文类型名 → 像素场景风格 key（未命中返回 null） */
export function categoryToStyle(category) {
  return CATEGORY_TO_STYLE[String(category || "").trim()] || null;
}