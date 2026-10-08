import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLocale } from "../i18n";
import { Icons } from "./Icons";
import { SectionHeader } from "./Cards";
import { setSocialMeta } from "../services/seo";

/**
 * FESTIVAL CALENDAR / 全球电影节排片日历
 *
 * 数据源全部是仓库内的静态 JSON（与 /discover、/intelligence 同一套取数方式）：
 *   /api/festivals.json              —— 概览：今日统计、电影节卡片（含今日排片）、月历密度
 *   /api/festivals/<slug>.json       —— 单届完整排片（详情页按需加载）
 *   /api/festival-changes.json       —— 变更流（官方数据变化历史）
 *
 * 设计约束（来自实施方案）：
 *   - 事实（日期/时间/影厅/取消）100% 来自电影节官方来源，AI 不参与；
 *   - 「尚未公布排片」是显式状态（SCHEDULE_PENDING），不是空白；
 *   - 视觉沿用站点规范：黑底 + 荧光黄/品红/青 + 粗黑边框 + 硬阴影 + pixel 字体。
 */

// ── 常量 ──────────────────────────────────────────────
const TABS = [
  { id: "today", path: "/festivals", zh: "今天", en: "TODAY", icon: "Target", color: "#ff00ff" },
  { id: "week", path: "/festivals/week", zh: "本周", en: "WEEK", icon: "Calendar", color: "#ffff00" },
  { id: "month", path: "/festivals/month", zh: "月历", en: "MONTH", icon: "Calendar", color: "#00ffff" },
  { id: "festivals", path: "/festivals/all", zh: "电影节库", en: "FESTIVALS", icon: "Film", color: "#ff00ff" },
  { id: "changes", path: "/festivals/changes", zh: "变更", en: "CHANGES", icon: "RefreshCw", color: "#ffff00" },
];
const TAB_BY_PATH = Object.fromEntries(TABS.map((t) => [t.path, t.id]));
const TAB_IDS = new Set(TABS.map((t) => t.id));

const STATUS = {
  SCREENING_LIVE: { color: "#00ffff", zh: "正在放映", en: "SCREENING LIVE" },
  SCHEDULE_LIVE: { color: "#00ffff", zh: "排片已公布", en: "SCHEDULE LIVE" },
  PROGRAM_RELEASED: { color: "#ffff00", zh: "节目已公布", en: "PROGRAMME RELEASED" },
  CONFIRMED: { color: "#ffff00", zh: "日期已确认", en: "DATES CONFIRMED" },
  SCHEDULE_PENDING: { color: "#ff00ff", zh: "排片待公布", en: "SCHEDULE PENDING" },
  CHANGED: { color: "#ff00ff", zh: "有变更", en: "CHANGED" },
  CANCELLED: { color: "#ff4444", zh: "已取消", en: "CANCELLED" },
  TBC: { color: "#9ca3af", zh: "待确认", en: "TBC" },
};

const KIND = {
  SCREENING: { zh: "影片场次", en: "SCREENING", color: "#00ffff" },
  EVENT: { zh: "特别活动", en: "EVENT", color: "#ff00ff" },
  TBA: { zh: "待定", en: "TBA", color: "#9ca3af" },
};

const SOURCE_KIND = {
  SCHEDULE: { zh: "官方排片表", en: "Official schedule" },
  PROGRAMME: { zh: "官方节目单", en: "Official programme" },
  OFFICIAL_SITE: { zh: "官方网站", en: "Official site" },
  PDF: { zh: "官方 PDF", en: "Official PDF" },
  PRESS: { zh: "官方新闻稿", en: "Official press release" },
  TICKETING: { zh: "官方票务系统", en: "Official ticketing" },
  AUTHORITY: { zh: "权威行业机构", en: "Industry authority" },
};

const CHANGE_KIND = {
  ADDED: { zh: "新增", en: "ADDED", color: "#00ffff" },
  REMOVED: { zh: "取消/移除", en: "REMOVED", color: "#ff4444" },
  CHANGED: { zh: "变更", en: "CHANGED", color: "#ffff00" },
  STATUS: { zh: "状态", en: "STATUS", color: "#ff00ff" },
  INIT: { zh: "首次建立", en: "INITIAL", color: "#9ca3af" },
  SUMMARY: { zh: "汇总", en: "SUMMARY", color: "#9ca3af" },
};

const REGION_ZH = {
  ASIA: "亚洲", EUROPE: "欧洲", "NORTH AMERICA": "北美", "LATIN AMERICA": "拉美",
  AFRICA: "非洲", "MIDDLE EAST": "中东", OCEANIA: "大洋洲",
};
const TYPE_ZH = {
  FEATURE: "长片", SHORT: "短片", DOCUMENTARY: "纪录片", ANIMATION: "动画",
  "FAMILY / YOUTH": "家庭/青少年", EXPERIMENTAL: "实验", GENRE: "类型", IMMERSIVE: "沉浸式",
};

// ── 取数 ──────────────────────────────────────────────
function useJsonData(endpoint) {
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
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then((json) => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) { setData(null); setError(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [endpoint, attempt]);
  return { data, loading, error, retry: () => setAttempt((a) => a + 1) };
}

/** 详情文件按需加载 + 进程内缓存（切 tab 不重复请求） */
const detailCache = new Map();

/**
 * 「不存在」与「加载失败」必须区分：
 * 静态托管（_redirects: /* → /index.html 200）会把缺失的详情文件伪装成 200 HTML，
 * 若只按 r.ok 判断，未知届次会被误报成「数据加载失败」。故一律校验 content-type 与必备字段。
 */
function missingEdition() {
  const err = new Error("EDITION_NOT_FOUND");
  err.missing = true;
  return err;
}

function useDetail(slug) {
  const [state, setState] = useState(() => (slug && detailCache.get(slug)) || { data: null, loading: !!slug, error: false, missing: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!slug) return undefined;
    const hit = detailCache.get(slug);
    if (hit) { setState({ data: hit, loading: false, error: false, missing: false }); return undefined; }
    let cancelled = false;
    setState({ data: null, loading: true, error: false, missing: false });
    fetch(`/api/festivals/${slug}.json`)
      .then((r) => {
        const ct = (r.headers.get("content-type") || "").toLowerCase();
        if (!r.ok || !ct.includes("json")) throw missingEdition();
        return r.json();
      })
      .then((json) => {
        if (!json || !json.edition) throw missingEdition();
        detailCache.set(slug, json);
        if (!cancelled) setState({ data: json, loading: false, error: false, missing: false });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ data: null, loading: false, error: !(err && err.missing), missing: !!(err && err.missing) });
      });
    return () => { cancelled = true; };
  }, [slug, attempt]);
  return { ...state, retry: () => { detailCache.delete(slug); setAttempt((a) => a + 1); } };
}

// ── 工具 ──────────────────────────────────────────────
const MONTH_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_ZH = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

function fmtDate(d, locale, withYear = true) {
  if (!d) return "—";
  const [y, m, day] = d.split("-").map(Number);
  if (locale === "zh") return `${m}月${day}日${withYear ? ` ${y}` : ""}`;
  return `${String(day).padStart(2, "0")} ${MONTH_EN[m - 1]}${withYear ? ` ${y}` : ""}`;
}
function fmtDateRange(a, b, locale) {
  if (!a || !b) return "—";
  if (locale === "zh") {
    const [ya, ma, da] = a.split("-").map(Number);
    const [yb, mb, db] = b.split("-").map(Number);
    if (ya === yb && ma === mb) return `${ya}年${ma}月${da}–${db}日`;
    return `${ya}年${ma}月${da}日 – ${yb}年${mb}月${db}日`;
  }
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  if (ya === yb && ma === mb) return `${da}–${db} ${MONTH_EN[ma - 1]} ${ya}`;
  return `${da} ${MONTH_EN[ma - 1]} ${ya} – ${db} ${MONTH_EN[mb - 1]} ${yb}`;
}
function timeAgo(iso, locale) {
  if (!iso) return locale === "zh" ? "未知" : "unknown";
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 1) return locale === "zh" ? "刚刚" : "just now";
  if (min < 60) return locale === "zh" ? `${min} 分钟前` : `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return locale === "zh" ? `${h} 小时前` : `${h} h ago`;
  return locale === "zh" ? `${Math.round(h / 24)} 天前` : `${Math.round(h / 24)} d ago`;
}
function addDaysStr(d, n) {
  const t = Date.parse(d + "T00:00:00Z") + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}
function dayOfWeek(d, locale) {
  const wd = new Date(d + "T00:00:00Z").getUTCDay();
  return locale === "zh" ? "日一二三四五六"[wd] : ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][wd];
}
function nowHHMM(timeZone) {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  } catch {
    return new Date().toTimeString().slice(0, 5);
  }
}
function fname(name, locale) {
  if (!name) return "—";
  return (locale === "zh" ? name.zh || name.en : name.en || name.zh) || "—";
}

// ── 通用小组件 ─────────────────────────────────────────
function StatusBadge({ status, locale, small = false }) {
  const s = STATUS[status] || STATUS.TBC;
  return (
    <span
      className={`inline-block border-2 border-black font-black pixel-font uppercase ${small ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-1 text-[9px]"}`}
      style={{ background: s.color, color: "#000" }}
    >
      {locale === "zh" ? s.zh : s.en}
    </span>
  );
}

function Chip({ children, color = "#ffff00", onClick, active = false }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 border-2 border-black text-[10px] font-black pixel-font uppercase transition-colors ${
        active ? "text-black" : "bg-black text-gray-300 hover:text-white"
      }`}
      style={active ? { background: color, color: "#000" } : { borderColor: color }}
    >
      {children}
    </button>
  );
}

function Tile({ label, value, color, sub }) {
  return (
    <div className="border-4 border-black bg-black p-2 sm:p-3 text-center" style={{ boxShadow: `4px 4px 0 0 ${color}` }}>
      <div className="text-lg sm:text-2xl font-black" style={{ color }}>{value}</div>
      <div className="text-[8px] sm:text-[9px] pixel-font uppercase text-gray-400 mt-0.5">{label}</div>
      {sub ? <div className="text-[8px] text-gray-600 mt-0.5">{sub}</div> : null}
    </div>
  );
}

function OfficialLink({ url, label, locale, color = "#00ffff" }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-block px-2 py-1 border-2 border-black text-[9px] font-black pixel-font uppercase bg-black hover:bg-white hover:text-black transition-colors"
      style={{ color, borderColor: color }}
    >
      {label || (locale === "zh" ? "官方来源 ↗" : "OFFICIAL SOURCE ↗")}
    </a>
  );
}

function LoadingSpinner({ locale }) {
  return (
    <div className="flex items-center justify-center py-16">
      <span className="text-gray-500 text-xs pixel-font">{locale === "zh" ? "数据加载中..." : "Loading..."}</span>
    </div>
  );
}

function DataError({ locale, onRetry, onBack, notFound = false }) {
  if (notFound) {
    return (
      <div className="text-center py-8">
        <p className="text-[#ffff00] text-xs pixel-font mb-2">
          {locale === "zh" ? "未找到该电影节届次，请检查链接或返回日历" : "Festival edition not found. Check the link or return to the calendar."}
        </p>
        <p className="text-gray-500 text-[10px] pixel-font mb-4">
          {locale === "zh" ? "该届次可能尚未收录，或链接中的地址有误。" : "It may not be covered yet, or the link is wrong."}
        </p>
        <button
          onClick={onBack}
          className="inline-block px-6 py-2 text-xs font-black bg-[#ffff00] border-4 border-black pixel-font uppercase shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all"
        >
          {locale === "zh" ? "返回日历" : "BACK TO CALENDAR"}
        </button>
      </div>
    );
  }
  return (
    <div className="text-center py-8">
      <p className="text-red-400 text-xs pixel-font mb-4">
        {locale === "zh" ? "数据加载失败，请稍后重试" : "Failed to load data. Please retry."}
      </p>
      <button
        onClick={onRetry}
        className="inline-block px-6 py-2 text-xs font-black bg-[#ffff00] border-4 border-black pixel-font uppercase shadow-[4px_4px_0_0_#000] hover:translate-y-1 transition-all"
      >
        {locale === "zh" ? "重试" : "RETRY"}
      </button>
    </div>
  );
}

function Empty({ locale, text }) {
  return (
    <div className="border-4 border-dashed border-gray-700 p-8 text-center">
      <p className="text-gray-500 text-xs pixel-font">
        {text || (locale === "zh" ? "暂无数据" : "Nothing here yet")}
      </p>
    </div>
  );
}

/** 单条排片行 —— 所有事实字段均来自官方页面 */
function ScreeningRow({ s, locale, color = "#ffff00" }) {
  const k = KIND[s.kind] || KIND.TBA;
  return (
    <div className="flex gap-2 items-start py-1.5 border-b border-gray-800 last:border-b-0">
      <span className="text-xs sm:text-sm font-black tabular-nums pt-0.5 flex-shrink-0" style={{ color }}>
        {s.time || s.localTime}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs sm:text-sm text-white font-bold break-words">{s.title || "—"}</span>
          {s.qa ? (
            <span className="px-1 border border-black bg-[#ff00ff] text-black text-[8px] font-black pixel-font">GV/Q&amp;A</span>
          ) : null}
          {s.kind && s.kind !== "SCREENING" ? (
            <span className="px-1 border border-black text-black text-[8px] font-black pixel-font" style={{ background: k.color }}>
              {locale === "zh" ? k.zh : k.en}
            </span>
          ) : null}
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5 break-words">
          {[s.section, s.venueName].filter(Boolean).join(" · ")}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {s.grade ? <span className="text-[8px] text-gray-500 pixel-font">{locale === "zh" ? `分级 ${s.grade}` : `RATED ${s.grade}`}</span> : null}
          {s.subtitle ? <span className="text-[8px] text-gray-500 pixel-font">{locale === "zh" ? `字幕 ${s.subtitle}` : `SUB ${s.subtitle}`}</span> : null}
          {s.ticketUrl ? <OfficialLink url={s.ticketUrl} label={locale === "zh" ? "购票 ↗" : "TICKETS ↗"} locale={locale} color="#ffff00" /> : null}
          {s.eventUrl ? <OfficialLink url={s.eventUrl} label={locale === "zh" ? "活动页 ↗" : "EVENT ↗"} locale={locale} color="#ff00ff" /> : null}
          {s.officialUrl ? <OfficialLink url={s.officialUrl} label={locale === "zh" ? "官方排片 ↗" : "SOURCE ↗"} locale={locale} color="#00ffff" /> : null}
        </div>
      </div>
    </div>
  );
}

// ── TODAY ────────────────────────────────────────────
function NowNext({ items, timezone, locale, color }) {
  const now = nowHHMM(timezone);
  const timed = items.filter((i) => i.time && /^\d{2}:\d{2}$/.test(i.time));
  if (!timed.length) return null;
  const sorted = [...timed].sort((a, b) => a.time.localeCompare(b.time));
  const current = [...sorted].reverse().find((i) => i.time <= now) || null;
  const next = sorted.find((i) => i.time > now) || null;
  if (!current && !next) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
      {current && (
        <div className="border-4 border-black bg-gray-900 p-2" style={{ boxShadow: `3px 3px 0 0 ${color}` }}>
          <div className="text-[8px] pixel-font uppercase text-gray-400 mb-1">
            {locale === "zh" ? `当前场次（当地 ${now} 开始）` : `NOW · local time ${now}`}
          </div>
          <div className="text-xs font-black text-white truncate">{current.title}</div>
          <div className="text-[10px] text-gray-400 truncate">{current.time} · {current.venueName}</div>
        </div>
      )}
      {next && (
        <div className="border-4 border-black bg-gray-900 p-2" style={{ boxShadow: "3px 3px 0 0 #00ffff" }}>
          <div className="text-[8px] pixel-font uppercase text-gray-400 mb-1">
            {locale === "zh" ? "下一场" : "UP NEXT"}
          </div>
          <div className="text-xs font-black text-white truncate">{next.title}</div>
          <div className="text-[10px] text-gray-400 truncate">{next.time} · {next.venueName}</div>
        </div>
      )}
    </div>
  );
}

function FestivalCard({ card, locale, onOpen }) {
  const [expanded, setExpanded] = useState(false);
  const s = STATUS[card.status] || STATUS.TBC;
  const items = card.today?.items || [];
  const byVenue = useMemo(() => {
    const m = new Map();
    for (const i of items) {
      if (!m.has(i.venueName)) m.set(i.venueName, []);
      m.get(i.venueName).push(i);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);
  const limit = 3;
  const isLive = card.lifecycle === "LIVE";

  return (
    <div className="border-4 border-black bg-black" style={{ boxShadow: `6px 6px 0 0 ${s.color}` }}>
      {/* head */}
      <div className="p-3 border-b-4 border-black" style={{ background: isLive ? "#0b0b0b" : "#000" }}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <StatusBadge status={card.status} locale={locale} />
          {card.changes7d > 0 ? (
            <span className="text-[9px] pixel-font text-[#ffff00]">
              {locale === "zh" ? `${card.changes7d} 条变更/7天` : `${card.changes7d} changes / 7d`}
            </span>
          ) : null}
          <span className="text-[9px] pixel-font text-gray-500 uppercase">{card.dataSource === "official" ? (locale === "zh" ? "官方数据" : "OFFICIAL DATA") : (locale === "zh" ? "仅官方日期" : "DATES ONLY")}</span>
        </div>
        <button onClick={() => onOpen(card.slug)} className="text-left w-full group">
          <h3 className="text-base sm:text-xl font-black text-white group-hover:text-[#ffff00] transition-colors break-words">
            {fname(card.name, locale)}
          </h3>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 break-words">
            {[card.city, card.country].filter(Boolean).join(", ")} · {locale === "zh" ? `第 ${card.year} 届` : `${card.year} edition`}
          </p>
          <p className="text-[10px] sm:text-xs text-[#00ffff] mt-0.5 pixel-font">
            {fmtDateRange(card.startDate, card.endDate, locale)}
          </p>
        </button>
        {card.statusNote ? (
          <p className="text-[10px] text-[#ff00ff] mt-1.5 leading-relaxed">
            ⓘ {locale === "zh" ? card.statusNote.zh : card.statusNote.en}
          </p>
        ) : null}
      </div>

      {/* today's numbers */}
      <div className="grid grid-cols-4 gap-1 p-2 border-b-4 border-black bg-gray-950">
        {[
          { l: locale === "zh" ? "今日场次" : "SCREENINGS", v: card.today?.screenings ?? 0, c: "#00ffff" },
          { l: locale === "zh" ? "今日活动" : "EVENTS", v: card.today?.events ?? 0, c: "#ff00ff" },
          { l: locale === "zh" ? "影厅" : "VENUES", v: card.today?.venues ?? 0, c: "#ffff00" },
          { l: locale === "zh" ? "影片总数" : "FILMS", v: card.stats?.films ?? 0, c: "#ffffff" },
        ].map((t) => (
          <div key={t.l} className="text-center">
            <div className="text-sm sm:text-lg font-black" style={{ color: t.c }}>{t.v}</div>
            <div className="text-[8px] pixel-font text-gray-500 uppercase">{t.l}</div>
          </div>
        ))}
      </div>

      {/* today's schedule */}
      <div className="p-3">
        <div className="text-[9px] pixel-font uppercase text-gray-400 mb-2">
          {isLive
            ? locale === "zh" ? `今日排片 · ${fmtDate(card.today?.date, locale, false)}` : `TODAY'S SCHEDULE · ${fmtDate(card.today?.date, locale, false)}`
            : locale === "zh" ? "今日无排片（未在进行中）" : "NO SCREENINGS TODAY"}
        </div>
        {isLive && items.length ? (
          <>
            <NowNext items={items} timezone={card.timezone} locale={locale} color={s.color} />
            {byVenue.map(([venue, list]) => {
              const shown = expanded ? list : list.slice(0, limit);
              return (
                <div key={venue} className="mb-2">
                  <div className="text-[9px] font-black text-[#ffff00] mb-0.5 break-words">
                    {venue} <span className="text-gray-600">({list.length})</span>
                  </div>
                  <div className="pl-2 border-l-2 border-gray-800">
                    {shown.map((i) => <ScreeningRow key={i.id} s={i} locale={locale} color={s.color} />)}
                    {!expanded && list.length > limit ? (
                      <button onClick={() => setExpanded(true)} className="text-[9px] pixel-font text-[#00ffff] mt-1 hover:text-white">
                        {locale === "zh" ? `+ 展开其余 ${list.length - limit} 场` : `+ ${list.length - limit} MORE`}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {expanded ? (
              <button onClick={() => setExpanded(false)} className="text-[9px] pixel-font text-gray-500 hover:text-white">
                {locale === "zh" ? "收起" : "COLLAPSE"}
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-[10px] text-gray-600">{locale === "zh" ? "官方尚未公布今日排片。" : "Official schedule not published for today."}</p>
        )}
      </div>

      {/* actions */}
      <div className="p-3 pt-0 flex flex-wrap gap-2 items-center">
        <button
          onClick={() => onOpen(card.slug)}
          className="px-3 py-1.5 border-4 border-black bg-[#ffff00] text-black text-[10px] font-black pixel-font uppercase shadow-[3px_3px_0_0_#000] hover:translate-y-0.5 transition-all"
        >
          {locale === "zh" ? "完整排片" : "FULL SCHEDULE"}
        </button>
        <OfficialLink url={card.officialUrl} locale={locale} />
        <span className="text-[9px] pixel-font text-gray-600">
          {locale === "zh" ? `最后验证：${timeAgo(card.lastVerifiedAt, locale)}` : `Last verified: ${timeAgo(card.lastVerifiedAt, locale)}`}
        </span>
      </div>
    </div>
  );
}

function TodayView({ locale, onOpen }) {
  const { data, loading, error, retry } = useJsonData("/api/festivals.json");
  const changes = useJsonData("/api/festival-changes.json");
  if (loading) return <LoadingSpinner locale={locale} />;
  if (error) return <DataError locale={locale} onRetry={retry} />;
  if (!data) return <Empty locale={locale} />;

  const stats = data.stats || {};
  const cards = data.festivals || [];
  const live = cards.filter((c) => c.lifecycle === "LIVE" || (c.startDate <= data.today && c.endDate >= data.today));
  const upcoming = cards.filter((c) => c.startDate > data.today).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const pending = cards.filter((c) => c.statusDetail?.schedule === "PENDING" && !live.includes(c));
  const recent = (changes.data?.changes || []).filter((c) => Date.parse(c.at) > Date.now() - 7 * 86400000).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="border-4 border-black bg-black p-3" style={{ boxShadow: "6px 6px 0 0 #ff00ff" }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm sm:text-lg font-black pixel-font text-white uppercase">
            TODAY · {fmtDate(data.today, locale)}
          </h2>
          <span className="text-[9px] pixel-font text-gray-500">
            {locale === "zh" ? `数据更新：${timeAgo(data.updated, locale)}` : `Updated ${timeAgo(data.updated, locale)}`}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <Tile label={locale === "zh" ? "正在举行" : "FESTIVALS TODAY"} value={stats.liveToday ?? live.length} color="#ff00ff" />
          <Tile label={locale === "zh" ? "今日场次" : "SCREENINGS TODAY"} value={stats.screeningsToday ?? 0} color="#00ffff" />
          <Tile label={locale === "zh" ? "即将到来" : "UPCOMING"} value={stats.upcoming ?? upcoming.length} color="#ffff00" />
          <Tile label={locale === "zh" ? "近期变更" : "CHANGES · 7D"} value={stats.changes7d ?? 0} color="#00ffff" />
        </div>
        {data.scopeNote ? (
          <p className="text-[9px] text-gray-500 mt-3 leading-relaxed">ⓘ {locale === "zh" ? data.scopeNote.zh : data.scopeNote.en}</p>
        ) : null}
      </div>

      {live.length ? (
        <section>
          <SectionHeader label={locale === "zh" ? "正在举行" : "HAPPENING NOW"} count={live.length} color="#00ffff" />
          <div className="space-y-4">
            {live.map((c) => <FestivalCard key={c.slug} card={c} locale={locale} onOpen={onOpen} />)}
          </div>
        </section>
      ) : (
        <Empty locale={locale} text={locale === "zh" ? "今天没有已收录的电影节在举行" : "No tracked festival is running today"} />
      )}

      {upcoming.length ? (
        <section>
          <SectionHeader label={locale === "zh" ? "接下来" : "UPCOMING"} count={upcoming.length} color="#ffff00" />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {upcoming.slice(0, 8).map((c) => {
              const s = STATUS[c.status] || STATUS.TBC;
              return (
                <button
                  key={c.slug}
                  onClick={() => onOpen(c.slug)}
                  className="text-left border-4 border-black bg-black p-3 hover:bg-gray-950 transition-colors"
                  style={{ boxShadow: `4px 4px 0 0 ${s.color}` }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={c.status} locale={locale} small />
                    <span className="text-[9px] pixel-font text-gray-500">
                      {locale === "zh" ? `${c.dayCount} 天` : `${c.dayCount} DAYS`}
                    </span>
                  </div>
                  <div className="text-sm font-black text-white break-words">{fname(c.name, locale)}</div>
                  <div className="text-[10px] text-gray-400">{card_city(c, locale)}</div>
                  <div className="text-[10px] text-[#00ffff] pixel-font mt-0.5">{fmtDateRange(c.startDate, c.endDate, locale)}</div>
                  {c.statusNote ? <div className="text-[9px] text-[#ff00ff] mt-1">ⓘ {locale === "zh" ? c.statusNote.zh : c.statusNote.en}</div> : null}
                </button>
              );
            })}
          </div>
          {pending.length ? (
            <p className="text-[9px] text-gray-500 mt-2">
              ⓘ {locale === "zh"
                ? `${pending.length} 个电影节已确认日期但官方尚未公布排片（状态会明确显示，而不是空白）。`
                : `${pending.length} festival(s) have confirmed dates with schedules not yet announced (shown as a status, never blank).`}
            </p>
          ) : null}
        </section>
      ) : null}

      <section>
        <SectionHeader label={locale === "zh" ? "最近变更" : "RECENT CHANGES"} color="#ff00ff" />
        {recent.length ? (
          <div className="space-y-2">
            {recent.map((c) => <ChangeCard key={c.id} change={c} locale={locale} />)}
          </div>
        ) : (
          <Empty locale={locale} text={locale === "zh" ? "最近 7 天没有记录到官方排片变化" : "No official schedule changes recorded in the last 7 days"} />
        )}
      </section>
    </div>
  );
}

function card_city(card, locale) {
  return [card.city, card.country].filter(Boolean).join(", ") + (locale === "zh" ? ` · 第 ${card.year} 届` : ` · ${card.year} edition`);
}

// ── WEEK ─────────────────────────────────────────────
function WeekView({ locale, onOpen }) {
  const { data, loading, error, retry } = useJsonData("/api/festivals.json");
  const [selected, setSelected] = useState(null);
  if (loading) return <LoadingSpinner locale={locale} />;
  if (error) return <DataError locale={locale} onRetry={retry} />;
  if (!data) return <Empty locale={locale} />;

  const cards = data.festivals || [];
  const start = data.today;
  const days = Array.from({ length: 7 }, (_, i) => addDaysStr(start, i));
  const end = days[6];
  const active = cards.filter((c) => c.startDate <= end && c.endDate >= start);
  const cal = data.calendar || {};

  const dayCards = (d) => active.filter((c) => c.startDate <= d && c.endDate >= d);

  return (
    <div className="space-y-4">
      <div className="border-4 border-black bg-black p-3" style={{ boxShadow: "6px 6px 0 0 #ffff00" }}>
        <h2 className="text-sm sm:text-lg font-black pixel-font text-white uppercase">
          WEEK · {fmtDateRange(start, end, locale)}
        </h2>
        <p className="text-[10px] text-gray-400 mt-1">
          {locale === "zh"
            ? `${active.length} 个电影节在本周内活动；点开任意一天查看当日影片场次。`
            : `${active.length} festival(s) active this week — open any day for its screenings.`}
        </p>
      </div>

      {days.map((d) => {
        const list = dayCards(d);
        const c = cal[d] || { screenings: 0, events: 0, festivals: [] };
        const isToday = d === data.today;
        return (
          <div key={d} className="border-4 border-black bg-black" style={{ boxShadow: `4px 4px 0 0 ${isToday ? "#ff00ff" : "#333"}` }}>
            <button
              onClick={() => setSelected(selected === d ? null : d)}
              className="w-full text-left p-3 flex flex-wrap items-center gap-2 hover:bg-gray-950 transition-colors"
            >
              <span className={`text-xs sm:text-sm font-black pixel-font ${isToday ? "text-[#ff00ff]" : "text-white"}`}>
                {dayOfWeek(d, locale)} {fmtDate(d, locale, false)}
              </span>
              {isToday ? <span className="text-[8px] pixel-font bg-[#ff00ff] text-black px-1 border border-black">TODAY</span> : null}
              <span className="text-[9px] pixel-font text-gray-500 ml-auto">
                {locale === "zh" ? `${c.screenings} 场 · ${c.events} 活动 · ${list.length} 个电影节` : `${c.screenings} screenings · ${c.events} events · ${list.length} festivals`}
              </span>
            </button>
            <div className="px-3 pb-3 flex flex-wrap gap-1.5">
              {list.length ? list.map((f) => {
                const s = STATUS[f.status] || STATUS.TBC;
                return (
                  <button
                    key={f.slug}
                    onClick={() => onOpen(f.slug)}
                    className="px-2 py-1 border-2 border-black text-[10px] font-black bg-gray-900 hover:bg-gray-800 text-white"
                    style={{ borderColor: s.color }}
                  >
                    {fname(f.name, locale)}
                  </button>
                );
              }) : <span className="text-[10px] text-gray-600 pixel-font">{locale === "zh" ? "无已收录电影节" : "NO TRACKED FESTIVAL"}</span>}
            </div>
            {selected === d ? <DaySchedulePanel date={d} active={list} locale={locale} onOpen={onOpen} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function DaySchedulePanel({ date, active, locale, onOpen }) {
  return (
    <div className="border-t-4 border-black p-3 space-y-3 bg-gray-950">
      {active.map((f) => <DayFestivalSchedule key={f.slug} date={date} card={f} locale={locale} onOpen={onOpen} />)}
    </div>
  );
}

function DayFestivalSchedule({ date, card, locale, onOpen }) {
  const { data, loading, error } = useDetail(card.slug);
  const items = useMemo(
    () => (data?.screenings || []).filter((s) => s.date === date).sort((a, b) => a.localTime.localeCompare(b.localTime)),
    [data, date]
  );
  if (loading) return <div className="text-[10px] pixel-font text-gray-500">{locale === "zh" ? "正在加载官方排片…" : "Loading official schedule…"}</div>;
  if (error) return <div className="text-[10px] text-red-400">{locale === "zh" ? "排片加载失败" : "Failed to load schedule"}</div>;
  const limited = items.slice(0, 40);
  return (
    <div className="border-4 border-black bg-black p-2" style={{ boxShadow: "3px 3px 0 0 #00ffff" }}>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <button onClick={() => onOpen(card.slug)} className="text-xs font-black text-white hover:text-[#ffff00]">
          {fname(card.name, locale)}
        </button>
        <span className="text-[9px] pixel-font text-gray-500">{items.length} {locale === "zh" ? "条" : "entries"}</span>
      </div>
      {items.length ? (
        <>
          {limited.map((s) => <ScreeningRow key={s.id} s={s} locale={locale} />)}
          {items.length > limited.length ? (
            <button onClick={() => onOpen(card.slug)} className="text-[9px] pixel-font text-[#00ffff] mt-1">
              {locale === "zh" ? `还有 ${items.length - limited.length} 条 → 完整排片` : `+ ${items.length - limited.length} more → full schedule`}
            </button>
          ) : null}
        </>
      ) : (
        <p className="text-[10px] text-gray-600">{locale === "zh" ? "该日官方无排片（状态：排片待公布）" : "No official entries for this day (schedule pending)"}</p>
      )}
    </div>
  );
}

// ── MONTH ────────────────────────────────────────────
function MonthView({ locale, onOpen }) {
  const { data, loading, error, retry } = useJsonData("/api/festivals.json");
  const today = data?.today || new Date().toISOString().slice(0, 10);
  const [cursor, setCursor] = useState(() => today.slice(0, 7)); // YYYY-MM
  const [picked, setPicked] = useState(null);
  if (loading) return <LoadingSpinner locale={locale} />;
  if (error) return <DataError locale={locale} onRetry={retry} />;
  if (!data) return <Empty locale={locale} />;

  const cards = data.festivals || [];
  const cal = data.calendar || {};
  const [y, m] = cursor.split("-").map(Number);
  const first = `${cursor}-01`;
  const firstDow = new Date(first + "T00:00:00Z").getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${cursor}-${String(d).padStart(2, "0")}`);
  const shift = (n) => {
    const dt = new Date(Date.UTC(y, m - 1 + n, 1));
    setCursor(dt.toISOString().slice(0, 7));
    setPicked(null);
  };
  const festivalsOn = (d) => cards.filter((c) => c.startDate <= d && c.endDate >= d);

  return (
    <div className="space-y-4">
      <div className="border-4 border-black bg-black p-3" style={{ boxShadow: "6px 6px 0 0 #00ffff" }}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm sm:text-lg font-black pixel-font text-white uppercase">
            {locale === "zh" ? `${y} 年 ${MONTH_ZH[m - 1]}` : `${MONTH_EN[m - 1]} ${y}`}
          </h2>
          <div className="flex gap-2">
            <Chip onClick={() => shift(-1)} color="#00ffff">‹</Chip>
            <Chip onClick={() => setCursor(today.slice(0, 7))} color="#ffff00">{locale === "zh" ? "本月" : "THIS MONTH"}</Chip>
            <Chip onClick={() => shift(1)} color="#00ffff">›</Chip>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          {locale === "zh" ? "月历只展示电影节档期；具体影片进入详情页。" : "Month shows festival runs only — film details are in the festival page."}
        </p>
      </div>

      <div className="border-4 border-black bg-black p-2 overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {(locale === "zh" ? ["日", "一", "二", "三", "四", "五", "六"] : ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]).map((d) => (
              <div key={d} className="text-center text-[9px] pixel-font text-gray-500 uppercase py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} className="border-2 border-gray-900 min-h-[74px]" />;
              const fs = festivalsOn(d);
              const c = cal[d] || { screenings: 0, events: 0 };
              const isToday = d === today;
              return (
                <button
                  key={d}
                  onClick={() => setPicked(picked === d ? null : d)}
                  className={`text-left border-2 p-1 min-h-[74px] transition-colors ${picked === d ? "border-[#ffff00]" : "border-gray-800 hover:border-gray-600"} bg-black`}
                >
                  <div className={`text-[10px] font-black ${isToday ? "text-[#ff00ff]" : "text-gray-300"}`}>
                    {d.slice(8)}
                    {isToday ? <span className="ml-1 text-[8px] pixel-font">●</span> : null}
                  </div>
                  <div className="space-y-0.5 mt-0.5">
                    {fs.slice(0, 2).map((f) => {
                      const s = STATUS[f.status] || STATUS.TBC;
                      return (
                        <div key={f.slug} className="text-[8px] px-0.5 truncate border-l-2" style={{ borderColor: s.color, color: s.color }}>
                          {fname(f.name, locale)}
                        </div>
                      );
                    })}
                    {fs.length > 2 ? <div className="text-[8px] text-gray-500">+{fs.length - 2}</div> : null}
                  </div>
                  {c.screenings ? (
                    <div className="text-[8px] pixel-font text-gray-500 mt-0.5">{c.screenings}{locale === "zh" ? "场" : "scr"}</div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {picked ? (
        <div className="border-4 border-black bg-black p-3" style={{ boxShadow: "4px 4px 0 0 #ffff00" }}>
          <div className="text-xs font-black pixel-font text-white uppercase mb-2">
            {dayOfWeek(picked, locale)} {fmtDate(picked, locale)}
          </div>
          {festivalsOn(picked).length ? (
            <div className="space-y-2">
              {festivalsOn(picked).map((f) => (
                <div key={f.slug} className="border-2 border-gray-800 p-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={f.status} locale={locale} small />
                  <button onClick={() => onOpen(f.slug)} className="text-xs font-black text-white hover:text-[#ffff00]">{fname(f.name, locale)}</button>
                  <span className="text-[9px] pixel-font text-gray-500">
                    {locale === "zh" ? `今日 ${(cal[picked]?.screenings || 0)} 场` : `${cal[picked]?.screenings || 0} screenings`}
                  </span>
                  <button onClick={() => onOpen(f.slug)} className="ml-auto text-[9px] pixel-font text-[#00ffff] hover:text-white">
                    {locale === "zh" ? "排片 »" : "SCHEDULE »"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-gray-600">{locale === "zh" ? "这一天没有已收录的电影节" : "No tracked festival on this day"}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── FESTIVALS LIST + filters ─────────────────────────
function FestivalsView({ locale, onOpen }) {
  const { data, loading, error, retry } = useJsonData("/api/festivals.json");
  const [region, setRegion] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [when, setWhen] = useState("ALL");
  if (loading) return <LoadingSpinner locale={locale} />;
  if (error) return <DataError locale={locale} onRetry={retry} />;
  if (!data) return <Empty locale={locale} />;

  const cards = data.festivals || [];
  const today = data.today;
  const regions = ["ALL", ...new Set(cards.map((c) => c.region).filter(Boolean))];
  const types = ["ALL", ...new Set(cards.flatMap((c) => c.types || []))];
  const WHEN = [
    { id: "ALL", zh: "全部时间", en: "ALL TIME" },
    { id: "LIVE", zh: "正在举行", en: "LIVE NOW" },
    { id: "30", zh: "30 天内", en: "NEXT 30D" },
    { id: "90", zh: "3 个月内", en: "NEXT 3M" },
  ];

  const filtered = cards.filter((c) => {
    if (region !== "ALL" && c.region !== region) return false;
    if (type !== "ALL" && !(c.types || []).includes(type)) return false;
    if (when === "LIVE" && !(c.startDate <= today && c.endDate >= today)) return false;
    if (when === "30" && !(c.startDate >= today && c.startDate <= addDaysStr(today, 30))) return false;
    if (when === "90" && !(c.startDate >= today && c.startDate <= addDaysStr(today, 90))) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="border-4 border-black bg-black p-3" style={{ boxShadow: "6px 6px 0 0 #ff00ff" }}>
        <h2 className="text-sm sm:text-lg font-black pixel-font text-white uppercase">
          FESTIVAL DATABASE · {filtered.length}/{cards.length}
        </h2>
        <p className="text-[10px] text-gray-400 mt-1">
          {locale === "zh"
            ? "只收录已核实官方来源的电影节；注册表持续追加，不追求“全球所有”。"
            : "Only festivals with verified official sources. The registry grows continuously — never claiming \"all festivals\"."}
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="flex flex-wrap gap-1">
            {WHEN.map((w) => (
              <Chip key={w.id} active={when === w.id} color="#ffff00" onClick={() => setWhen(w.id)}>
                {locale === "zh" ? w.zh : w.en}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {regions.map((r) => (
              <Chip key={r} active={region === r} color="#00ffff" onClick={() => setRegion(r)}>
                {r === "ALL" ? (locale === "zh" ? "全部地区" : "ALL REGIONS") : locale === "zh" ? REGION_ZH[r] || r : r}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {types.map((t) => (
              <Chip key={t} active={type === t} color="#ff00ff" onClick={() => setType(t)}>
                {t === "ALL" ? (locale === "zh" ? "全部类型" : "ALL TYPES") : locale === "zh" ? TYPE_ZH[t] || t : t}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {filtered.length ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filtered.map((c) => {
            const s = STATUS[c.status] || STATUS.TBC;
            return (
              <button
                key={c.slug}
                onClick={() => onOpen(c.slug)}
                className="text-left border-4 border-black bg-black p-3 hover:bg-gray-950 transition-colors"
                style={{ boxShadow: `4px 4px 0 0 ${s.color}` }}
              >
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <StatusBadge status={c.status} locale={locale} small />
                  <span className="text-[9px] pixel-font text-gray-500 uppercase">{c.region}</span>
                  <span className="text-[9px] pixel-font text-gray-600">
                    {locale === "zh" ? `${c.dayCount} 天 · ${c.stats?.films ?? 0} 部影片 · ${c.stats?.screenings ?? 0} 场` : `${c.dayCount}d · ${c.stats?.films ?? 0} films · ${c.stats?.screenings ?? 0} screenings`}
                  </span>
                </div>
                <div className="text-sm font-black text-white break-words">{fname(c.name, locale)}</div>
                <div className="text-[10px] text-gray-400">{card_city(c, locale)}</div>
                <div className="text-[10px] text-[#00ffff] pixel-font mt-0.5">{fmtDateRange(c.startDate, c.endDate, locale)}</div>
                {c.statusNote ? <div className="text-[9px] text-[#ff00ff] mt-1">ⓘ {locale === "zh" ? c.statusNote.zh : c.statusNote.en}</div> : null}
                <div className="text-[9px] pixel-font text-gray-600 mt-2">
                  {locale === "zh" ? `最后验证：${timeAgo(c.lastVerifiedAt, locale)}` : `Last verified: ${timeAgo(c.lastVerifiedAt, locale)}`}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <Empty locale={locale} text={locale === "zh" ? "没有符合条件的电影节" : "No festival matches these filters"} />
      )}
    </div>
  );
}

// ── CHANGES ──────────────────────────────────────────
function ChangeCard({ change, locale }) {
  const k = CHANGE_KIND[change.kind] || CHANGE_KIND.CHANGED;
  return (
    <div className="border-4 border-black bg-black p-3" style={{ boxShadow: `4px 4px 0 0 ${k.color}` }}>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="px-1.5 py-0.5 border-2 border-black text-[8px] font-black pixel-font uppercase" style={{ background: k.color, color: "#000" }}>
          {change.kind === "SUMMARY" ? (locale === "zh" ? "汇总" : "SUMMARY") : `⚠ ${locale === "zh" ? k.zh : k.en}`}
        </span>
        <span className="text-[9px] pixel-font text-gray-500">{change.entity}</span>
        <span className="text-[9px] pixel-font text-gray-600 ml-auto">{timeAgo(change.at, locale)}</span>
      </div>
      <div className="text-xs font-black text-white break-words">{change.label}</div>
      {change.fields?.length ? (
        <div className="mt-2 space-y-1">
          {change.fields.map((f, i) => (
            <div key={i} className="text-[10px] text-gray-300 flex flex-wrap gap-1.5 items-center">
              <span className="text-gray-500">{f.fieldLabel || f.field}</span>
              <span className="text-gray-600 line-through">{f.from ?? "—"}</span>
              <span className="text-[#00ffff]">→</span>
              <span className="text-[#ffff00] font-bold">{f.to ?? "—"}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <OfficialLink url={change.sourceUrl} locale={locale} />
        <span className="text-[9px] pixel-font text-gray-600">
          {locale === "zh" ? `记录于 ${timeAgo(change.at, locale)}` : `Recorded ${timeAgo(change.at, locale)}`}
        </span>
      </div>
    </div>
  );
}

function ChangesView({ locale }) {
  const { data, loading, error, retry } = useJsonData("/api/festival-changes.json");
  const [kind, setKind] = useState("ALL");
  const [limit, setLimit] = useState(30);
  if (loading) return <LoadingSpinner locale={locale} />;
  if (error) return <DataError locale={locale} onRetry={retry} />;
  if (!data) return <Empty locale={locale} />;

  const all = data.changes || [];
  const list = (kind === "ALL" ? all : all.filter((c) => c.kind === kind)).slice(0, limit);
  const kinds = ["ALL", ...new Set(all.map((c) => c.kind))];

  return (
    <div className="space-y-4">
      <div className="border-4 border-black bg-black p-3" style={{ boxShadow: "6px 6px 0 0 #ffff00" }}>
        <h2 className="text-sm sm:text-lg font-black pixel-font text-white uppercase">
          CHANGES · {data.count7d ?? 0} / 7D
        </h2>
        <p className="text-[10px] text-gray-400 mt-1">
          {locale === "zh"
            ? "每次官方数据变化都会留下 old → new 记录，历史不被覆盖。"
            : "Every official change keeps an old → new record; history is never overwritten."}
        </p>
        <div className="flex flex-wrap gap-1 mt-3">
          {kinds.map((k) => (
            <Chip key={k} active={kind === k} color="#ffff00" onClick={() => { setKind(k); setLimit(30); }}>
              {k === "ALL" ? (locale === "zh" ? "全部" : "ALL") : (CHANGE_KIND[k]?.[locale === "zh" ? "zh" : "en"] || k)}
            </Chip>
          ))}
        </div>
      </div>
      {list.length ? (
        <>
          <div className="space-y-2">{list.map((c) => <ChangeCard key={c.id} change={c} locale={locale} />)}</div>
          {list.length >= limit && limit < all.length ? (
            <div className="text-center">
              <Chip color="#00ffff" onClick={() => setLimit(limit + 50)}>
                {locale === "zh" ? "加载更多" : "LOAD MORE"}
              </Chip>
            </div>
          ) : null}
        </>
      ) : (
        <Empty locale={locale} text={locale === "zh" ? "没有记录到变更" : "No changes recorded"} />
      )}
    </div>
  );
}

// ── DETAIL ───────────────────────────────────────────
function StatusRow({ label, value, locale }) {
  const map = {
    CONFIRMED: { zh: "已确认", en: "CONFIRMED", c: "#ffff00" },
    RELEASED: { zh: "已公布", en: "RELEASED", c: "#00ffff" },
    PENDING: { zh: "待公布", en: "PENDING", c: "#ff00ff" },
    LIVE: { zh: "进行中", en: "LIVE", c: "#00ffff" },
  };
  const v = map[value] || { zh: value, en: value, c: "#9ca3af" };
  return (
    <div className="flex items-center gap-2 border-2 border-gray-800 px-2 py-1">
      <span className="text-[9px] pixel-font text-gray-400 uppercase">{label}</span>
      <span className="text-[9px] pixel-font font-black ml-auto" style={{ color: v.c }}>{locale === "zh" ? v.zh : v.en}</span>
    </div>
  );
}

function DetailView({ slug, locale, onBack }) {
  const { data, loading, error, missing, retry } = useDetail(slug);
  const [day, setDay] = useState("ALL");
  const [venue, setVenue] = useState("ALL");
  const [section, setSection] = useState("ALL");
  const [kind, setKind] = useState("ALL");
  const [query, setQuery] = useState("");
  const [showAllDays, setShowAllDays] = useState(false);
  const [filmsOpen, setFilmsOpen] = useState(false);

  // 标题口径：可读的「电影节名 + 届次年」，不是 slug。
  // 数据到达后重设一次，并同步 OG/Twitter/description/canonical —— 只改标签文字不算改 SEO 标题。
  useEffect(() => {
    const nm = data?.festival?.name;
    const year = data?.edition?.year;
    const label = nm ? `${fname(nm, locale)}${year ? ` ${year}` : ""}` : null;
    const title = label
      ? `${label} | Festival Calendar`
      : locale === "zh"
        ? "全球电影节排片日历 | FESTIVAL CALENDAR | Kim's Video"
        : "Global Festival Calendar | Kim's Video";

    let description = title;
    if (label) {
      const bits = [fmtDateRange(data.edition.startDate, data.edition.endDate, locale)];
      if (data.festival?.city) bits.push(data.festival.city);
      const entries = (data.screenings || []).length;
      if (entries) bits.push(locale === "zh" ? `${entries} 条排片与活动` : `${entries} screenings & events`);
      description = locale === "zh"
        ? `${label} 官方排片日历：${bits.join(" · ")}。数据来自电影节官方来源。`
        : `${label} official calendar: ${bits.join(" · ")}. Sourced from the festival's official channels.`;
    }

    setSocialMeta({ title, description, url: `https://bloodyrex.xyz/festivals/${slug}` });
  }, [slug, data, locale]);

  if (loading) return <LoadingSpinner locale={locale} />;
  if (missing || error || !data) {
    return (
      <DataError
        locale={locale}
        notFound={missing || !error}
        onRetry={retry}
        onBack={onBack}
      />
    );
  }

  const s = STATUS[data.status] || STATUS.TBC;
  const all = data.screenings || [];
  const days = [...new Set(all.map((x) => x.date))].sort();
  const todayLocal = data.edition?.timezone
    ? new Date().toLocaleDateString("en-CA", { timeZone: data.edition.timezone })
    : new Date().toISOString().slice(0, 10);

  const q = query.trim().toLowerCase();
  const filtered = all.filter((x) => {
    if (day !== "ALL" && x.date !== day) return false;
    if (venue !== "ALL" && x.venueId !== venue) return false;
    if (section !== "ALL" && x.sectionId !== section) return false;
    if (kind === "SCREENING" && x.kind !== "SCREENING") return false;
    if (kind === "EVENT" && x.kind === "SCREENING") return false;
    if (q && !(x.title || "").toLowerCase().includes(q)) return false;
    return true;
  });

  // 口径：列表同时包含 SCREENING + EVENT + TBA —— 数量拆分必须从数据动态读取，禁止硬编码
  const byKind = filtered.reduce(
    (m, x) => {
      const k = KIND[x.kind] ? x.kind : "TBA";
      m[k] = (m[k] || 0) + 1;
      return m;
    },
    { SCREENING: 0, EVENT: 0, TBA: 0 }
  );

  const byDate = new Map();
  for (const x of filtered) {
    if (!byDate.has(x.date)) byDate.set(x.date, new Map());
    const byVenue = byDate.get(x.date);
    if (!byVenue.has(x.venueName)) byVenue.set(x.venueName, []);
    byVenue.get(x.venueName).push(x);
  }
  const dateKeys = [...byDate.keys()].sort();

  const filmsBySection = new Map();
  for (const f of data.films || []) {
    const key = f.sectionName || (locale === "zh" ? "未分组" : "Ungrouped");
    if (!filmsBySection.has(key)) filmsBySection.set(key, []);
    filmsBySection.get(key).push(f);
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-[10px] pixel-font text-[#00ffff] hover:text-white">
        ‹ {locale === "zh" ? "返回日历" : "BACK TO CALENDAR"}
      </button>

      {/* header */}
      <div className="border-4 border-black bg-black p-4" style={{ boxShadow: `6px 6px 0 0 ${s.color}` }}>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <StatusBadge status={data.status} locale={locale} />
          <span className="text-[9px] pixel-font text-gray-500 uppercase">
            {data.dataSource === "official" ? (locale === "zh" ? "官方数据" : "OFFICIAL DATA") : (locale === "zh" ? "仅官方日期" : "DATES ONLY")}
          </span>
          <span className="text-[9px] pixel-font text-gray-500">
            {locale === "zh" ? `最后验证：${timeAgo(data.lastVerifiedAt, locale)}` : `Last verified: ${timeAgo(data.lastVerifiedAt, locale)}`}
          </span>
        </div>
        <h2 className="text-lg sm:text-2xl font-black text-white break-words">{fname(data.festival?.name, locale)}</h2>
        <p className="text-xs text-gray-400 mt-1">
          {[data.festival?.city, data.festival?.country].filter(Boolean).join(", ")}
          {" · "}
          {locale === "zh" ? `第 ${data.edition?.year} 届` : `${data.edition?.year} edition`}
          {data.festival?.region ? ` · ${data.festival.region}` : ""}
        </p>
        <p className="text-xs text-[#00ffff] pixel-font mt-1">
          {fmtDateRange(data.edition?.startDate, data.edition?.endDate, locale)} · {data.edition?.dayCount} {locale === "zh" ? "天" : "days"} · {data.edition?.timezone}
        </p>
        <div className="mt-2">
          {data.festival?.types?.length ? (
            <div className="flex flex-wrap gap-1">
              {data.festival.types.map((t) => (
                <span key={t} className="px-1.5 py-0.5 border border-gray-700 text-[8px] pixel-font text-gray-400 uppercase">
                  {locale === "zh" ? TYPE_ZH[t] || t : t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <OfficialLink url={data.festival?.officialUrl} label={locale === "zh" ? "电影官网 ↗" : "FESTIVAL SITE ↗"} locale={locale} color="#ffff00" />
          <OfficialLink url={data.edition?.officialUrl} label={locale === "zh" ? "官方排片 ↗" : "OFFICIAL SCHEDULE ↗"} locale={locale} />
        </div>
      </div>

      {/* status detail — 「尚未公布」也要显式展示 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <StatusRow label={locale === "zh" ? "电影节日期" : "FESTIVAL DATES"} value={data.statusDetail?.dates} locale={locale} />
        <StatusRow label={locale === "zh" ? "节目单" : "PROGRAMME"} value={data.statusDetail?.programme} locale={locale} />
        <StatusRow label={locale === "zh" ? "排片表" : "SCREENING SCHEDULE"} value={data.statusDetail?.schedule} locale={locale} />
      </div>
      {data.statusNote ? (
        <p className="text-[10px] text-[#ff00ff] leading-relaxed">ⓘ {locale === "zh" ? data.statusNote.zh : data.statusNote.en}</p>
      ) : null}

      {/* stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <Tile label={locale === "zh" ? "影片" : "FILMS"} value={data.stats?.films ?? 0} color="#ffffff" />
        <Tile label={locale === "zh" ? "场次" : "SCREENINGS"} value={data.stats?.screenings ?? 0} color="#00ffff" />
        <Tile label={locale === "zh" ? "活动" : "EVENTS"} value={data.stats?.events ?? 0} color="#ff00ff" />
        <Tile label={locale === "zh" ? "影厅" : "VENUES"} value={data.stats?.venues ?? 0} color="#ffff00" />
        <Tile label={locale === "zh" ? "单元" : "SECTIONS"} value={data.stats?.sections ?? 0} color="#00ffff" />
        <Tile label={locale === "zh" ? "有影人出席" : "WITH GUESTS"} value={data.stats?.guestVisits ?? 0} color="#ff00ff" />
      </div>

      {/* filters */}
      <div className="border-4 border-black bg-black p-3 space-y-2">
        <div className="flex flex-wrap gap-1">
          <Chip active={kind === "ALL"} color="#ffff00" onClick={() => setKind("ALL")}>{locale === "zh" ? "全部" : "ALL"}</Chip>
          <Chip active={kind === "SCREENING"} color="#00ffff" onClick={() => setKind("SCREENING")}>{locale === "zh" ? "影片场次" : "SCREENINGS"}</Chip>
          <Chip active={kind === "EVENT"} color="#ff00ff" onClick={() => setKind("EVENT")}>{locale === "zh" ? "活动" : "EVENTS"}</Chip>
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[9px] pixel-font text-gray-500 uppercase">{locale === "zh" ? "日期" : "DAY"}</span>
          <Chip active={day === "ALL"} color="#00ffff" onClick={() => setDay("ALL")}>{locale === "zh" ? "全部" : "ALL"}</Chip>
          {days.map((d) => (
            <Chip key={d} active={day === d} color="#00ffff" onClick={() => setDay(d)}>{d.slice(5)}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            className="px-2 py-1 border-2 border-black bg-white text-[10px] font-bold max-w-full"
          >
            <option value="ALL">{locale === "zh" ? "全部影厅" : "ALL VENUES"}</option>
            {(data.venues || []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="px-2 py-1 border-2 border-black bg-white text-[10px] font-bold max-w-full"
          >
            <option value="ALL">{locale === "zh" ? "全部单元" : "ALL SECTIONS"}</option>
            {(data.sections || []).map((x) => <option key={x.id} value={x.id}>{x.name || x.id}</option>)}
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={locale === "zh" ? "搜索片名…" : "Search title…"}
            className="px-2 py-1 border-2 border-black bg-white text-[10px] font-bold min-w-[140px]"
          />
          <span className="text-[10px] pixel-font text-gray-400 ml-auto">
            {filtered.length} / {all.length} {locale === "zh" ? "条" : "entries"}
          </span>
        </div>
      </div>

      {/* schedule —— SCREENING + EVENT + TBA 合并列表（口径：entries = screenings + events + pending） */}
      <section>
        <SectionHeader label={locale === "zh" ? "排片总表" : "PROGRAMME SCHEDULE"} count={filtered.length} color="#00ffff" />
        <div className="-mt-2 mb-3 text-[10px] pixel-font text-gray-400">
          {locale === "zh"
            ? `${byKind.SCREENING} 场影片 · ${byKind.EVENT} 场活动 · ${byKind.TBA} 项待定`
            : `${byKind.SCREENING} screenings · ${byKind.EVENT} events · ${byKind.TBA} TBA`}
        </div>
        {dateKeys.length ? (
          <div className="space-y-3">
            {dateKeys.map((d, idx) => {
              const byVenue = byDate.get(d);
              const total = [...byVenue.values()].reduce((n, l) => n + l.length, 0);
              const open = showAllDays || idx === 0 || d === todayLocal || day !== "ALL";
              return (
                <div key={d} className="border-4 border-black bg-black" style={{ boxShadow: `4px 4px 0 0 ${d === todayLocal ? "#ff00ff" : "#333"}` }}>
                  <div className="p-2 border-b-2 border-gray-800 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black pixel-font text-white">
                      {dayOfWeek(d, locale)} {fmtDate(d, locale)}
                    </span>
                    {d === todayLocal ? <span className="text-[8px] pixel-font bg-[#ff00ff] text-black px-1 border border-black">TODAY</span> : null}
                    <span className="text-[9px] pixel-font text-gray-500 ml-auto">{total} {locale === "zh" ? "条" : "entries"}</span>
                  </div>
                  {open ? (
                    <div className="p-2 space-y-2">
                      {[...byVenue.entries()].map(([v, list]) => (
                        <div key={v}>
                          <div className="text-[9px] font-black text-[#ffff00] break-words">
                            {v} <span className="text-gray-600">({list.length})</span>
                          </div>
                          <div className="pl-2 border-l-2 border-gray-800">
                            {list.map((x) => <ScreeningRow key={x.id} s={x} locale={locale} color={s.color} />)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2">
                      <button onClick={() => setShowAllDays(true)} className="text-[9px] pixel-font text-[#00ffff] hover:text-white">
                        {locale === "zh" ? "展开该日排片" : "EXPAND"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Empty locale={locale} text={locale === "zh" ? "没有符合筛选条件的排片" : "No entries match the filters"} />
        )}
      </section>

      {/* films */}
      {(data.films || []).length ? (
        <section>
          <div className="flex items-center gap-2">
            <SectionHeader label={locale === "zh" ? "影片目录" : "FILM CATALOGUE"} count={data.films.length} color="#ff00ff" />
            <button onClick={() => setFilmsOpen(!filmsOpen)} className="text-[9px] pixel-font text-[#00ffff] mt-2">
              {filmsOpen ? (locale === "zh" ? "收起" : "COLLAPSE") : (locale === "zh" ? "展开" : "EXPAND")}
            </button>
          </div>
          {filmsOpen ? (
            <div className="space-y-3">
              {[...filmsBySection.entries()].map(([sec, films]) => (
                <div key={sec} className="border-4 border-black bg-black p-2">
                  <div className="text-[10px] font-black text-[#ffff00] mb-1">
                    {sec} <span className="text-gray-600">({films.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1">
                    {films.slice(0, 120).map((f) => (
                      <div key={f.id} className="text-[10px] text-gray-300 border-l-2 border-gray-800 pl-2 break-words">
                        <span className="text-white font-bold">{f.title}</span>
                        {f.director ? <span className="text-gray-500"> · {f.director}</span> : null}
                        {f.country ? <span className="text-gray-600"> · {f.country}</span> : null}
                      </div>
                    ))}
                  </div>
                  {films.length > 120 ? (
                    <div className="text-[9px] text-gray-600 mt-1">
                      {locale === "zh" ? `另有 ${films.length - 120} 部（完整列表见官方片单）` : `+${films.length - 120} more (see official programme)`}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* sources */}
      <section>
        <SectionHeader label={locale === "zh" ? "官方来源" : "OFFICIAL SOURCES"} count={(data.sources || []).length} color="#ffff00" />
        <div className="space-y-1">
          {(data.sources || []).map((src) => (
            <div key={src.url} className="border-2 border-gray-800 p-2 flex flex-wrap items-center gap-2">
              <span className="text-[9px] pixel-font uppercase" style={{ color: src.ok ? "#00ffff" : "#ff4444" }}>
                {src.ok ? "OK" : "FAIL"} {src.httpStatus || ""}
              </span>
              <span className="text-[9px] text-gray-400">
                {(SOURCE_KIND[src.kind] && (locale === "zh" ? SOURCE_KIND[src.kind].zh : SOURCE_KIND[src.kind].en)) || src.kind}
              </span>
              <span className="text-[10px] text-gray-300 break-all">{src.label || src.url}</span>
              <a href={src.url} target="_blank" rel="noreferrer noopener" className="text-[9px] pixel-font text-[#ffff00] hover:text-white ml-auto">
                {locale === "zh" ? "打开 ↗" : "OPEN ↗"}
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── PAGE ─────────────────────────────────────────────
export default function FestivalCalendarPage() {
  const { t, locale, toggleLocale } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();

  const path = location.pathname.replace(/\/+$/, "") || "/festivals";
  const tabId = TAB_BY_PATH[path] || (TAB_BY_PATH[path + "/"] ?? null);
  const rawSlug = tabId ? null : decodeURIComponent(path.replace(/^\/festivals\/?/, ""));
  const slug = rawSlug && /^[a-z0-9][a-z0-9-]*$/.test(rawSlug) && !TAB_IDS.has(rawSlug) ? rawSlug : null;
  const active = tabId || (slug ? "festivals" : "today");

  useEffect(() => {
    if (slug) return;
    const title =
      locale === "zh"
        ? "全球电影节排片日历 | FESTIVAL CALENDAR | Kim's Video"
        : "Global Festival Calendar | Kim's Video";
    setSocialMeta({ title, description: t("festivals.subtitle"), url: "https://bloodyrex.xyz/festivals" });
  }, [locale, slug]);

  const open = (s) => navigate(`/festivals/${s}`);
  const IconComp = (name) => Icons[name] || Icons.Target;

  return (
    <div className={`min-h-screen graffiti-bg text-black pb-32 festival-page locale-${locale}`}>
      <header className="relative z-10 flex flex-col items-center py-4 mb-0 bg-black border-b-8 border-[#ff00ff] shadow-[0_8px_0_0_rgba(0,255,255,1)]">
        <Link to="/" className="flex items-center justify-center hover:opacity-80 transition-opacity">
          <div className="bg-[#ffff00] p-2 border-4 border-black mr-4 transform -rotate-6">
            <span className="text-black transform rotate-90"><Icons.Play /></span>
          </div>
          <h1
            className="text-lg sm:text-2xl font-black text-white pixel-font uppercase tracking-widest drop-shadow-[4px_4px_0_#ff00ff] whitespace-nowrap"
            style={{ fontFamily: "'Press Start 2P','Courier New',Courier,monospace" }}
          >
            KIM'S <span className="text-[#00ffff]">VIDEO</span>
          </h1>
        </Link>
        <p className="text-gray-500 text-[10px] max-sm:text-[9px] pixel-font mt-1 tracking-wider">
          {t("festivals.subtitle")}
        </p>
      </header>

      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row">
        <aside className="sticky top-0 z-20 bg-black/90 sm:bg-black/60 sm:static sm:w-48 sm:min-h-[calc(100vh-200px)] sm:block sm:border-r-4 sm:border-[#ff00ff]">
          <nav className="flex sm:flex-col overflow-x-auto sm:overflow-x-visible px-4 py-2 sm:p-0 gap-1">
            {TABS.map((item) => {
              const Icon = IconComp(item.icon);
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-2 px-3 py-2.5 sm:py-3 w-full text-left transition-colors border-l-4 ${
                    isActive ? "bg-gray-900 border-[#ffff00] text-white" : "border-transparent text-gray-400 hover:bg-gray-900/50 hover:text-white"
                  }`}
                >
                  <span className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-white" : "text-gray-600"}`}><Icon className="w-5 h-5" /></span>
                  <span className="text-[10px] sm:text-xs font-black pixel-font whitespace-nowrap">{locale === "zh" ? item.zh : item.en}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 min-w-0">
          {slug ? (
            <DetailView slug={slug} locale={locale} onBack={() => navigate("/festivals/all")} />
          ) : active === "today" ? (
            <TodayView locale={locale} onOpen={open} />
          ) : active === "week" ? (
            <WeekView locale={locale} onOpen={open} />
          ) : active === "month" ? (
            <MonthView locale={locale} onOpen={open} />
          ) : active === "changes" ? (
            <ChangesView locale={locale} />
          ) : (
            <FestivalsView locale={locale} onOpen={open} />
          )}
        </main>
      </div>

      <div className="fixed bottom-[116px] sm:bottom-[128px] right-3 sm:right-4 z-40 flex flex-col gap-2">
        <button
          onClick={toggleLocale}
          className="w-7 h-7 sm:w-8 sm:h-8 bg-[#ff00ff] border-2 border-black text-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors font-black text-[10px] sm:text-xs shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none"
          style={{ fontFamily: "'Press Start 2P','Courier New',Courier,monospace" }}
        >
          {locale === "zh" ? "En" : "中"}
        </button>
      </div>

      <footer
        className={`fixed bottom-0 w-full z-10 text-center py-3 bg-black border-t-4 border-[#ffff00] text-white ${
          locale === "zh" ? "text-sm max-sm:text-xs font-bold tracking-wider" : "pixel-font text-[10px] max-sm:text-[9px] uppercase tracking-widest"
        }`}
      >
        <p>
          <Link to="/discover" className="hover:text-[#ffff00] transition-colors">{t("footer.discover")}</Link>
          <span className="text-gray-600 mx-2">|</span>
          <Link to="/intelligence" className="hover:text-[#00ffff] transition-colors">{t("footer.intel")}</Link>
          <span className="text-gray-600 mx-2">|</span>
          <Link to="/wall" className="hover:text-[#ff00ff] transition-colors">{t("footer.wall")}</Link>
          <span className="text-gray-600 mx-2">|</span>
          <a href="mailto:rexhr@yahoo.com" className="hover:text-[#ffff00] transition-colors">{t("footer.contact")}</a>
        </p>
      </footer>
    </div>
  );
}
