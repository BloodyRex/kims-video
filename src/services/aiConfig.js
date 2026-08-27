import { API_BASE_URL } from "./config";

// Admin-adjustable AI recommendation ratio (subset of /admin/config exposed publicly).
// The worker returns the `ai` knob block; we cache it in-memory for the session and
// merge over the local defaults so a fetch failure never breaks the search.
let cached = null;
let cachedAt = 0;
const TTL = 60 * 60 * 1000; // 1h

export async function getAiConfig() {
  const now = Date.now();
  if (cached && now - cachedAt < TTL) return cached;
  const fallback = {
    ratio: { total: 5, popular: 2, hidden: 2, controversial: 1 },
    desc: {
      popular: "高评分、高知名度的大众热门",
      hidden: "高品质冷门/小众/独立影片",
      controversial: "评价存在争议、口碑两极分化的影片",
    },
  };
  try {
    const r = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/intelligence/ai-config`, { method: "GET" });
    if (!r.ok) return fallback;
    const data = await r.json();
    // Merge missing fields onto fallback so partial configs stay valid.
    cached = {
      ratio: { ...fallback.ratio, ...(data?.ai?.ratio || {}) },
      desc: { ...fallback.desc, ...(data?.ai?.desc || {}) },
    };
    cachedAt = now;
    return cached;
  } catch {
    return fallback;
  }
}