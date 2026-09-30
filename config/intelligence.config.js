export const INTELLIGENCE_CONFIG = {
  releaseWindowDays: 30,
  // ── Weekly continuity (Rex 2026-09-30) ──
  // 每周第一天（周一）入选的作品本周内固定保留；周二起只增量新增，不重新筛选；
  // 下周一重置。仅作用于依赖上线时间窗口的栏目（见 scripts/weekly-continuity.js
  // 的 WEEKLY_SCOPE）。enabled=false 即回退到原每日规则（当天不可逆地重新筛选）。
  // cap = 每栏目累计显示上限（安全阀）：达到上限后只舍弃"当日新增"，绝不淘汰已锁定作品。
  weeklyContinuity: {
    enabled: true,
    cap: 25,          // 全局安全阀：每栏目累计显示上限
    // 单栏目覆盖（键 = "文件名.栏目名"）。Rex 2026-09-30 折中方案：
    // 音乐每天新增约 15 条、实测周累计 48 条；电影两栏实测周累计 52-56 条 —— 用 25 会在
    // 周中触顶后冻结（当日新增全被舍弃）。故给这三栏放宽：周内持续有新增，只在周末触顶。
    // 放宽与 Cloudflare 额度无关（锁定条目不重取详情，子请求预算不变），只影响页面条数。
    caps: {
      "music.json.picks": 40,
      "movies.json.releasedThisWeek": 30,
      "movies.json.nowPlaying": 30,
    },
  },
  mbPages: 3,
  mbPageSize: 100,
  minArtistListeners: 500,
  artistCheckLimit: 80,
  albumEnrichLimit: 40,
  candidateLimitForAI: 18,
  finalCount: 20,
  chartTags: [
    "hip hop", "pop", "rock", "electronic",
    "jazz", "blues", "classical", "folk",
    "k-pop", "j-pop", "mandopop", "latin",
  ],
  // ── Regional bias for the 🌍环球音乐 category (Rex 2026-08-24) ──
  // The default MusicBrainz pass is relevance-ordered and dominated by US/EU
  // releases, so the CJK quota in the Worker had zero material (world=0 live).
  regionalBiasCountries: ["JP", "KR", "CN", "TW", "HK"],
  regionalBiasPages: 1,      // extra MB pages restricted to those countries
  regionalArtistReserve: 16, // of the 80 Last.fm artist-check slots
};
