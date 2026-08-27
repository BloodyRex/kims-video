import { useState, useEffect } from "react";
import { adminFetchConfig, adminSaveConfig } from "../services/adminApi";

// ── Field catalog ──────────────────────────────────────────────────────────
// Every editable knob. `path` maps into the worker config JSON; `code` is the
// human-facing code name shown on the row; label/desc power the zh/en text and
// the ⓘ-style tooltip. `type` is number | checkbox | csv (comma-list of ints).
const GROUPS = [
  {
    title: "电影 · 收录来源", titleEn: "Movie · Sources",
    fields: [
      { path: ["movie", "sources", "nowPlayingUS", "enabled"], code: "movie.sources.nowPlayingUS.enabled", label: "美国在映", labelEn: "US now playing", type: "checkbox", desc: "是否从 TMDB now_playing?region=US 收录" },
      { path: ["movie", "sources", "nowPlayingUS", "pages"], code: "movie.sources.nowPlayingUS.pages", label: "美国在映页数", labelEn: "US now playing pages", type: "number", min: 1, max: 6, step: 1, desc: "每页约20部，多页=更多候选但消耗子请求（每页≈2子请求）" },
      { path: ["movie", "sources", "nowPlayingCN", "enabled"], code: "movie.sources.nowPlayingCN.enabled", label: "中国内地院线", labelEn: "CN theatrical", type: "checkbox", desc: "收录国内上映但未进美区的影片（如牛来）" },
      { path: ["movie", "sources", "nowPlayingCN", "pages"], code: "movie.sources.nowPlayingCN.pages", label: "中国内地页数", labelEn: "CN theatrical pages", type: "number", min: 1, max: 6, step: 1, desc: "region=CN 的抓取页数" },
      { path: ["movie", "sources", "recently90d", "enabled"], code: "movie.sources.recently90d.enabled", label: "过去90天新片", labelEn: "Past-90d discover", type: "checkbox", desc: "discover/movie 过去90天，补非美小片" },
      { path: ["movie", "sources", "recently90d", "pages"], code: "movie.sources.recently90d.pages", label: "过去90天页数", labelEn: "Past-90d pages", type: "number", min: 1, max: 6, step: 1, desc: "过去90天池抓取页数" },
      { path: ["movie", "sources", "upcoming90d", "enabled"], code: "movie.sources.upcoming90d.enabled", label: "未来90天新片", labelEn: "Upcoming 90d", type: "checkbox", desc: "discover/movie 未来90天，构成“即将上映”池" },
      { path: ["movie", "sources", "upcoming90d", "pages"], code: "movie.sources.upcoming90d.pages", label: "未来90天页数", labelEn: "Upcoming pages", type: "number", min: 1, max: 6, step: 1, desc: "即将上映池抓取页数" },
      { path: ["movie", "weekBack"], code: "movie.weekBack", label: "「本周」窗口(天)", labelEn: "Week window (days)", type: "number", min: 1, max: 30, step: 1, desc: "近 N 天起的上映算进 releasedThisWeek（CN日二次分桶）" },
    ],
  },
  {
    title: "电影 · 正在热映复合门槛", titleEn: "Movie · NowPlaying gate",
    fields: [
      { path: ["movie", "gateNow", "wRating"], code: "movie.gateNow.wRating", label: "评分权重", labelEn: "rating weight", type: "number", min: 0, max: 1, step: 0.05, desc: "复合分 score = wRating×评分 + wPop×pop10" },
      { path: ["movie", "gateNow", "wPop"], code: "movie.gateNow.wPop", label: "热度权重", labelEn: "popularity weight", type: "number", min: 0, max: 1, step: 0.05, desc: "复合分中热度的权重" },
      { path: ["movie", "gateNow", "floor"], code: "movie.gateNow.floor", label: "入选阈值", labelEn: "floor (min score)", type: "number", min: 0, max: 10, step: 0.1, desc: "只有 score ≥ floor 的影片才进入「正在热映」" },
      { path: ["movie", "gateNow", "popScale"], code: "movie.gateNow.popScale", label: "热度缩放", labelEn: "pop scale", type: "number", min: 1, max: 100, step: 1, desc: "pop10 = popularity / popScale（popularity 归一化到 0-10）" },
      { path: ["movie", "gateNow", "popCap10"], code: "movie.gateNow.popCap10", label: "热度封顶", labelEn: "pop cap", type: "number", min: 1, max: 20, step: 1, desc: "pop10 = min(popCap10, popularity/popScale)" },
      { path: ["movie", "gateNow", "cnFloorPopularity"], code: "movie.gateNow.cnFloorPopularity", label: "国产热度底线", labelEn: "CN pop floor", type: "number", min: 0, max: 100, step: 1, desc: "国产片放宽：只要热度≥此值（不受复合门槛限制）" },
      { path: ["movie", "gateNow", "cnFloorRating"], code: "movie.gateNow.cnFloorRating", label: "国产评分底线", labelEn: "CN rating floor", type: "number", min: 0, max: 10, step: 0.5, desc: "国产片放宽：评分（若有）≥ 此值" },
    ],
    formula: "gate",
  },
  {
    title: "电影 · 地区保底 + 排名权重", titleEn: "Movie · Reserve + scoring",
    formula: "scoreMovie",
    fields: [
      { path: ["movie", "reserve", "zh"], code: "movie.reserve.zh", label: "华语保底", labelEn: "zh quota", type: "number", min: 0, max: 15, step: 1, desc: "最终列表中华语片至少占的席位" },
      { path: ["movie", "reserve", "ja"], code: "movie.reserve.ja", label: "日本保底", labelEn: "ja quota", type: "number", min: 0, max: 15, step: 1, desc: "日本片保底名额" },
      { path: ["movie", "reserve", "ko"], code: "movie.reserve.ko", label: "韩国保底", labelEn: "ko quota", type: "number", min: 0, max: 15, step: 1, desc: "韩国片保底名额" },
      { path: ["movie", "score", "w_pop"], code: "movie.score.w_pop", label: "热度权重 w_pop", labelEn: "pop weight", type: "number", min: 0, max: 1, step: 0.05, desc: "排名分 S_pop 的权重（热度，批内归一化）" },
      { path: ["movie", "score", "w_date"], code: "movie.score.w_date", label: "日期权重 w_date", labelEn: "date weight", type: "number", min: 0, max: 1, step: 0.05, desc: "新近度 S_date 的权重（半衰期衰减）" },
      { path: ["movie", "score", "w_qual"], code: "movie.score.w_qual", label: "质量权重 w_qual", labelEn: "quality weight", type: "number", min: 0, max: 1, step: 0.05, desc: "口碑 S_qual（评分）的权重" },
      { path: ["movie", "score", "hlFuture"], code: "movie.score.hlFuture", label: "未来半衰期(天)", labelEn: "future half-life", type: "number", min: 1, max: 90, step: 1, desc: "未来上映的日期衰减半衰期" },
      { path: ["movie", "score", "hlPast"], code: "movie.score.hlPast", label: "过去半衰期(天)", labelEn: "past half-life", type: "number", min: 1, max: 90, step: 1, desc: "已上映的日期衰减半衰期" },
    ],
  },
  {
    title: "剧集 · 收录来源", titleEn: "TV · Sources",
    fields: [
      { path: ["tv", "sources", "onTheAir", "enabled"], code: "tv.sources.onTheAir.enabled", label: "排播中(TMDB)", labelEn: "on-the-air", type: "checkbox", desc: "TMDB on_the_air：未来7天有新集的剧" },
      { path: ["tv", "sources", "onTheAir", "pages"], code: "tv.sources.onTheAir.pages", label: "排播中页数", labelEn: "on-the-air pages", type: "number", min: 1, max: 6, step: 1, desc: "on_the_air 抓取页数" },
      { path: ["tv", "sources", "discoverUpcoming", "enabled"], code: "tv.sources.discoverUpcoming.enabled", label: "未来90天首播(TMDB)", labelEn: "discover upcoming", type: "checkbox", desc: "TMDB discover 未来90天首播的剧" },
      { path: ["tv", "sources", "discoverUpcoming", "pages"], code: "tv.sources.discoverUpcoming.pages", label: "首播页数", labelEn: "upcoming pages", type: "number", min: 1, max: 6, step: 1, desc: "discover/tv 未来90天抓取页数" },
      { path: ["tv", "sources", "tvmazePremiere", "enabled"], code: "tv.sources.tvmazePremiere.enabled", label: "TVMAZE首播(0-3天)", labelEn: "tvmaze premieres", type: "checkbox", desc: "TVMAZE 未来0-3天的首播（真实首播日）" },
      { path: ["tv", "sources", "tvmazePremiere", "offsets"], code: "tv.sources.tvmazePremiere.offsets", label: "TVMAZE首播偏移", labelEn: "premiere offsets", type: "csv", desc: "逗号分隔的天偏移值，如 0,1,2,3" },
      { path: ["tv", "sources", "tvmazeUpcoming", "enabled"], code: "tv.sources.tvmazeUpcoming.enabled", label: "TVMAZE近期(+7/+14)", labelEn: "tvmaze upcoming", type: "checkbox", desc: "TVMAZE 未来+7/+14天扫抽的首播样本" },
      { path: ["tv", "sources", "tvmazeUpcoming", "offsets"], code: "tv.sources.tvmazeUpcoming.offsets", label: "TVMAZE近期偏移", labelEn: "upcoming offsets", type: "csv", desc: "逗号分隔的天偏移值，如 7,14" },
      { path: ["tv", "sources", "trendingWeek", "enabled"], code: "tv.sources.trendingWeek.enabled", label: "本周最热(TMDB)", labelEn: "weekly trending", type: "checkbox", desc: "本周最热剧（翻页）——覆盖「整季放出/刚完结」剧" },
      { path: ["tv", "sources", "trendingWeek", "pages"], code: "tv.sources.trendingWeek.pages", label: "本周最热页数", labelEn: "trending pages", type: "number", min: 1, max: 6, step: 1, desc: "trending/tv/week 翻几页（每页20部）" },
    ],
  },
  {
    title: "剧集 · 准入 + 地区保底 + 排名权重", titleEn: "TV · Admissions + Reserve + scoring",
    formula: "scoreTv",
    fields: [
      { path: ["tv", "yearCutoff"], code: "tv.yearCutoff", label: "首播年份门槛", labelEn: "min first-air year", type: "number", min: 1950, max: 2030, step: 1, desc: "超长连载剧首播年份 ≥ 此值（数值比较）" },
      { path: ["tv", "popFloor"], code: "tv.popFloor", label: "最低热度", labelEn: "min popularity", type: "number", min: 0, max: 200, step: 1, desc: "ongoing 热播剧的最低 popularity" },
      { path: ["tv", "ongoingTier1"], code: "tv.ongoingTier1", label: "近30天活跃名额", labelEn: "tier-1 quota", type: "number", min: 1, max: 15, step: 1, desc: "近30天有新集/近180天首播的剧优先入选的名额" },
      { path: ["tv", "ongoingTier2"], code: "tv.ongoingTier2", label: "其余剧名额", labelEn: "tier-2 quota", type: "number", min: 0, max: 15, step: 1, desc: "其余 2010+ 剧集合计补充名额" },
      { path: ["tv", "reserve", "cn"], code: "tv.reserve.cn", label: "大陆保底", labelEn: "cn quota", type: "number", min: 0, max: 15, step: 1, desc: "大陆剧保底席位" },
      { path: ["tv", "reserve", "hmt"], code: "tv.reserve.hmt", label: "港台保底", labelEn: "hmt quota", type: "number", min: 0, max: 15, step: 1, desc: "港台剧保底席位" },
      { path: ["tv", "reserve", "jp"], code: "tv.reserve.jp", label: "日本保底", labelEn: "jp quota", type: "number", min: 0, max: 15, step: 1, desc: "日本剧保底席位" },
      { path: ["tv", "reserve", "kr"], code: "tv.reserve.kr", label: "韩国保底", labelEn: "kr quota", type: "number", min: 0, max: 15, step: 1, desc: "韩国剧保底席位" },
      { path: ["tv", "score", "w_pop"], code: "tv.score.w_pop", label: "热度权重 w_pop", labelEn: "pop weight", type: "number", min: 0, max: 1, step: 0.05, desc: "TV 排名分 S_pop 权重" },
      { path: ["tv", "score", "w_date"], code: "tv.score.w_date", label: "日期权重 w_date", labelEn: "date weight", type: "number", min: 0, max: 1, step: 0.05, desc: "TV 新近度权重（长线剧用最近季播出日）" },
      { path: ["tv", "score", "w_qual"], code: "tv.score.w_qual", label: "质量权重 w_qual", labelEn: "quality weight", type: "number", min: 0, max: 1, step: 0.05, desc: "TV 口碑权重" },
      { path: ["tv", "score", "hlFuture"], code: "tv.score.hlFuture", label: "未来半衰期(天)", labelEn: "future half-life", type: "number", min: 1, max: 90, step: 1, desc: "TV 未来日期衰减半衰期" },
      { path: ["tv", "score", "hlPast"], code: "tv.score.hlPast", label: "过去半衰期(天)", labelEn: "past half-life", type: "number", min: 1, max: 90, step: 1, desc: "TV 已播日期衰减半衰期" },
    ],
  },
  {
    title: "AI 推荐 · 5部分类配比", titleEn: "AI search · 5-slot ratio",
    fields: [
      { path: ["ai", "recRatio", "total"], code: "ai.recRatio.total", label: "推荐总数", labelEn: "total", type: "number", min: 1, max: 10, step: 1, desc: "AI 搜索一次返回的推荐条目总数（默认5）" },
      { path: ["ai", "recRatio", "popular"], code: "ai.recRatio.popular", label: "大众热门数量", labelEn: "popular", type: "number", min: 0, max: 10, step: 1, desc: "排前面的高名气热门条数" },
      { path: ["ai", "recRatio", "hidden"], code: "ai.recRatio.hidden", label: "冷门小众数量", labelEn: "hidden", type: "number", min: 0, max: 10, step: 1, desc: "中间位置的高品质冷门条数" },
      { path: ["ai", "recRatio", "controversial"], code: "ai.recRatio.controversial", label: "争议条目数量", labelEn: "controversial", type: "number", min: 0, max: 10, step: 1, desc: "最后一位的争议影片条数" },
    ],
  },
];

// helpers to read/set nested paths
const getPath = (o, p) => p.reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, p, v) => {
  const out = { ...o };
  let cur = out;
  for (let i = 0; i < p.length - 1; i++) {
    cur[p[i]] = { ...(cur[p[i]] || {}) };
    cur = cur[p[i]];
  }
  cur[p[p.length - 1]] = v;
  return out;
};

const toNum = (v) => (v === "" ? null : Number(v));

// Live formula renderers — produce a readable math string with the CURRENT
// numbers substituted, plus a short plain-language reading.
function FormulaBox({ kind, cfg, locale }) {
  const num = (p, dflt) => { const v = getPath(cfg, p); const n = Number(v); return isFinite(n) ? n : dflt; };
  const fmt = (n) => (Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
  let lines = [];
  if (kind === "gate") {
    const wR = fmt(num(["movie","gateNow","wRating"],0.7));
    const wP = fmt(num(["movie","gateNow","wPop"],0.3));
    const floor = fmt(num(["movie","gateNow","floor"],6));
    const scale = num(["movie","gateNow","popScale"],10);
    const cap = num(["movie","gateNow","popCap10"],10);
    const cnPop = num(["movie","gateNow","cnFloorPopularity"],8);
    const cnRate = num(["movie","gateNow","cnFloorRating"],2);
    lines = [
      { zh: `门槛分 = ${wR} × 评分 + ${wP} × min(${cap}, 热度 / ${scale})`, en: `gate = ${wR}·rating + ${wP}·min(${cap}, popularity/${scale})` },
      { zh: `入选条件：门槛分 ≥ ${floor}`, en: `admitted when gate ≥ ${floor}` },
      { zh: `国产片放宽：热度 ≥ ${cnPop} 且 评分 ≥ ${cnRate}`, en: `CN relax: popularity ≥ ${cnPop} and rating ≥ ${cnRate}` },
    ];
  } else if (kind === "scoreMovie") {
    const s = cfg?.movie?.score || {};
    const wP = fmt(num(["movie","score","w_pop"],0.25));
    const wD = fmt(num(["movie","score","w_date"],0.55));
    const wQ = fmt(num(["movie","score","w_qual"],0.20));
    const hlF = num(["movie","score","hlFuture"],14);
    const hlP = num(["movie","score","hlPast"],7);
    lines = [
      { zh: `排名分 = (${wP}·S热度 + ${wD}·S新近 + ${wQ}·S口碑) / 100`, en: `rank = (${wP}·S_pop + ${wD}·S_date + ${wQ}·S_qual)/100` },
      { zh: `S新近：未来半衰期${hlF}天 / 过去${hlP}天，指数衰减`, en: `S_date: half-life ${hlF}d future / ${hlP}d past` },
    ];
  } else if (kind === "scoreTv") {
    const s = cfg?.tv?.score || {};
    const wP = fmt(num(["tv","score","w_pop"],0.25));
    const wD = fmt(num(["tv","score","w_date"],0.45));
    const wQ = fmt(num(["tv","score","w_qual"],0.30));
    const hlF = num(["tv","score","hlFuture"],14);
    const hlP = num(["tv","score","hlPast"],7);
    lines = [
      { zh: `排名分 = (${wP}·S热度 + ${wD}·S新近 + ${wQ}·S口碑) / 100`, en: `rank = (${wP}·S_pop + ${wD}·S_date + ${wQ}·S_qual)/100` },
      { zh: `S新近：用最近一季播出日，未来${hlF}天 / 过去${hlP}天半衰期`, en: `S_date: from latest season, ${hlF}d / ${hlP}d half-life` },
    ];
  } else return null;
  return (
    <div className="mt-3 bg-[#111] border-2 border-[#00ffff] text-white px-3 py-2 font-mono text-[11px] leading-relaxed shadow-[4px_4px_0_0_rgba(0,255,255,0.7)]">
      {lines.map((l, i) => (
        <div key={i} className="whitespace-pre-wrap">{locale === "en" ? l.en : l.zh}</div>
      ))}
    </div>
  );
}

export default function IntelConfigPanel({ token, locale, onToast }) {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await adminFetchConfig(token);
        if (data.error) { setError(data.error); setCfg(null); }
        else setCfg(data);
      } catch { setError("Failed to load config"); }
      setLoading(false);
    })();
  }, [token]);

  if (loading) return <p className="text-center text-gray-500 py-8">Loading config…</p>;
  if (error) return <div className="bg-red-500 border-4 border-black p-3 text-white font-bold text-sm mb-4">{error}</div>;
  if (!cfg) return null;

  const handleSave = async () => {
    setSaving(true); setSaved("");
    try {
      const res = await adminSaveConfig(token, cfg);
      if (res.error) { setError(res.error); }
      else { setSaved(locale === "en" ? "Saved ✓ (live in ≤60s)" : "已保存 ✓（约60秒内生效）"); setCfg(res); }
    } catch { setError(locale === "en" ? "Save failed" : "保存失败"); }
    setSaving(false);
  };

  const upd = (path, val) => setCfg((c) => setPath(c, path, val));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {locale === "en" ? "Editable knobs for the intelligence engine. Descriptions shown under each param; formulas update live. Changes go live within ~60s." : "智能引擎各可调参数。每个参数下方直接显示作用说明，公式随数值实时变化。保存后约60秒内生效。"}
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm bg-[#00ff00] text-black border-2 border-black px-4 py-1.5 font-black hover:bg-[#40ff40] disabled:opacity-50 transition-colors shadow-[3px_3px_0_0_#000] active:translate-y-1 active:shadow-none"
        >
          {saving ? "..." : (locale === "en" ? "Save all" : "保存全部")}
        </button>
      </div>
      {saved && <div className="bg-[#00ff00] text-black border-4 border-black p-3 font-bold text-sm">{saved}</div>}
      {error && <div className="bg-red-500 border-4 border-black p-3 text-white font-bold text-sm">{error}</div>}

      {GROUPS.map((grp) => (
        <div key={grp.title} className="bg-white text-black border-4 border-black p-4 mb-6 shadow-[8px_8px_0_0_rgba(0,255,255,1)]">
          <h3 className="font-black uppercase text-sm mb-3 border-b-2 border-black pb-1">
            {locale === "en" ? grp.titleEn : grp.title}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {grp.fields.map((f) => {
              const v = getPath(cfg, f.path);
              return (
                <div key={f.code} className="flex items-center gap-2 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[11px] text-[#ff00ff] font-bold truncate">{f.code}</div>
                    <div className="text-[11px] text-gray-500">{locale === "en" ? f.labelEn : f.label}</div>
                    {f.desc && <div className="text-[10px] text-gray-400 mt-0.5 leading-snug">{f.desc}</div>}
                  </div>
                  <div className="shrink-0 w-24">
                    {f.type === "checkbox" ? (
                      <input type="checkbox" checked={!!v} onChange={(e) => upd(f.path, e.target.checked)} className="w-5 h-5 cursor-pointer" />
                    ) : f.type === "csv" ? (
                      <input
                        value={Array.isArray(v) ? v.join(",") : ""}
                        onChange={(e) => upd(f.path, e.target.value.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n)))}
                        className="w-full border-2 border-black px-2 py-1 text-xs font-bold text-right focus:outline-none focus:bg-[#ffff00]"
                      />
                    ) : (
                      <input
                        type="number"
                        value={v ?? ""}
                        min={f.min} max={f.max} step={f.step}
                        onChange={(e) => upd(f.path, toNum(e.target.value))}
                        className="w-full border-2 border-black px-2 py-1 text-xs font-bold text-right focus:outline-none focus:bg-[#ffff00]"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {grp.formula && <FormulaBox kind={grp.formula} cfg={cfg} locale={locale} />}
        </div>
      ))}
    </div>
  );
}