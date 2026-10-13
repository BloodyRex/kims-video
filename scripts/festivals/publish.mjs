#!/usr/bin/env node
/**
 * 发布 —— 把标准化存储摊平成前端要读的静态 JSON（沿用仓库既有 public/api 风格）
 *   public/api/festivals.json          今日/本周/月历所需（含今日排片内联）
 *   public/api/festivals/<slug>.json   单个届次完整排片（详情页按需加载）
 *   public/api/festival-changes.json   变更流
 */

const DAY = 86400000;

function localDay(now, timeZone) {
  try {
    return new Date(now).toLocaleDateString("en-CA", { timeZone });
  } catch {
    return String(now).slice(0, 10);
  }
}

function dateRange(start, end) {
  const out = [];
  let t = Date.parse(start + "T00:00:00Z");
  const e = Date.parse(end + "T00:00:00Z");
  while (t <= e) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += DAY;
  }
  return out;
}

/** registry 里「只有官方日期、暂未接入抓取」的届次 → 明确显示为待公布，而不是留空 */
export function registryOnlyStore(festival, edition, now) {
  return {
    slug: edition.id,
    festivalId: festival.id,
    festival: {
      id: festival.id,
      name: festival.name,
      city: festival.city,
      country: festival.country,
      countryCode: festival.countryCode || null,
      region: festival.region || null,
      types: festival.types || [],
      officialUrl: festival.officialUrl,
      // 授权状态必须从 registry 带到 store：发布门禁读的就是这里（run.mjs / publish.mjs
      // authorizationAllows）。漏带会让无 adapter 届次永远判为未放行，无论 registry 里
      // 是 granted 还是 testing。仅在 registry 已声明时才落键，避免向公开卡片注入 null。
      ...(festival.authorization ? { authorization: festival.authorization } : {}),
      ...(festival.authorizationNote ? { authorizationNote: festival.authorizationNote } : {}),
    },
    edition: {
      id: edition.id,
      year: edition.year,
      startDate: edition.startDate,
      endDate: edition.endDate,
      timezone: edition.timezone,
      dayCount: dateRange(edition.startDate, edition.endDate).length,
      officialUrl: edition.officialUrl || festival.officialUrl,
    },
    lifecycle: "UPCOMING",
    status: "CONFIRMED",
    statusDetail: { dates: "CONFIRMED", programme: "PENDING", schedule: "PENDING" },
    statusNote: {
      zh: "日期已由官方确认，节目单与具体排片尚未公布",
      en: "Dates officially confirmed — programme and screening schedule not announced yet",
    },
    sources: (edition.sources || []).map((s) => ({ ...s, ok: true, httpStatus: null, fetchedAt: now })),
    sections: [],
    venues: [],
    films: [],
    screenings: [],
    stats: {
      films: 0, filmsTotal: 0, screenings: 0, events: 0, pending: 0,
      entries: 0, venues: 0, sections: 0, days: 0, guestVisits: 0,
    },
    days: [],
    warnings: [],
    fetchedAt: now,
    lastVerifiedAt: null,
    dataSource: "registry",
  };
}

/**
 * 发布授权门禁（P1）：只有「授权状态明确放行」的届次才允许生成公开产物。
 *   - 放行状态 = granted（正式书面授权）或 testing（测试授权，用户明确允许测试内容通过并发布）。
 *   - 缺失 / pending / 其它未知值 → 一律阻断（不得进入索引、详情、变更流）。
 *   - 授权范围是否覆盖全部内容由人工审核；门禁只负责「未明确放行即不放行」。
 * 注意：本函数只决定「是否发布」，绝不修改 store 自身的任何字段。
 */
/* ═════════════════════ P1 授权门禁总开关 ═════════════════════
 * ⚠️ 高风险开关。本轮用户明确授权「停用 granted 门禁」（选项 a），故默认 GATE_DEFAULT = false。
 *   - true  = 门禁强制：只有 authorization 属于放行集合（granted / testing）的届次进入公开产物。
 *   - false = 门禁停用：未授权（missing / pending / 其它值）届次照常进入索引 / 详情 / 变更流。
 * 恢复门禁（二选一，无需改逻辑）：
 *   1) 把 GATE_DEFAULT 改回 true；或
 *   2) 运行时设环境变量 FESTIVALS_AUTHORIZATION_GATE=on（=off 可再次停用）。
 * 本开关只决定「是否按授权过滤」，绝不修改 store 自身任何字段，也不伪造授权状态。 */
const GATE_DEFAULT = false;
export const GATE_ENFORCED =
  process.env.FESTIVALS_AUTHORIZATION_GATE === "on" ? true
  : process.env.FESTIVALS_AUTHORIZATION_GATE === "off" ? false
  : GATE_DEFAULT;

/* 放行集合（纯判据，不受开关影响）：
 *   granted —— 已取得正式书面授权（原 P1 唯一放行状态，语义不变）。
 *   testing —— 测试授权：用户明确要求「允许测试状态内容通过并发布」，与 granted 并列放行。
 * 二者语义严格区分：testing 绝不等于 granted，也不会被改写成 granted；仅是「允许进入公开产物」的两种状态。 */
export const RELEASABLE_AUTHORIZATIONS = Object.freeze(["granted", "testing"]);

/** 纯授权判据（不受开关影响）：authorization 属于放行集合（granted / testing）为真。 */
export const rawAuthorized = (auth) => RELEASABLE_AUTHORIZATIONS.includes(auth);

/** 生效的授权判据：门禁停用时一律放行，否则等同 rawAuthorized。 */
export function authorizationAllows(auth) {
  return !GATE_ENFORCED || rawAuthorized(auth);
}

export function isAuthorized(store) {
  return authorizationAllows(store?.festival?.authorization);
}

/** 被门禁阻断的届次清单（含原因），用于报告与核验；不写盘、不改数据。 */
export function blockedEditions(stores) {
  return (stores || [])
    .filter((s) => !isAuthorized(s))
    .map((s) => ({ slug: s.slug, authorization: s.festival?.authorization ?? null }));
}

function cardOf(store, { today, changes }) {
  const tz = store.edition.timezone;
  const entries = store.screenings || [];
  const todayEntries = entries.filter((s) => s.date === today);
  const venuesToday = new Set(todayEntries.map((s) => s.venueId));
  const items = todayEntries.slice(0, 160).map((s) => ({
    id: s.id,
    kind: s.kind,
    time: s.localTime,
    title: s.title,
    venueName: s.venueName,
    section: s.sectionName,
    grade: s.grade,
    subtitle: s.subtitle,
    qa: s.qa,
    ticketStatus: s.ticketStatus || null,
    // 票价仅在来源确有官方价时落键；无价则不落键，避免给未接入票价的届次写入 null 噪声
    ...(s.minPrice ? { minPrice: s.minPrice } : {}),
    ticketUrl: s.ticketUrl,
    eventUrl: s.eventUrl,
    officialUrl: s.officialSourceUrl,
  }));
  const upcoming = entries.find((s) => s.date > today);
  const changes7d = (changes || []).filter(
    (c) => c.slug === store.slug && Date.parse(c.at) > Date.now() - 7 * DAY
  ).length;
  // 官方节目变更摘要（仅官方已接入「节目变更」页的届次才有；其余为 null，卡片不落键）
  const pc = store.programmeChanges
    ? {
        lastUpdate: store.programmeChanges.lastUpdate || null,
        via: store.programmeChanges.via || null,
        url: store.programmeChanges.url || null,
        sectionCount: store.programmeChanges.sectionCount || 0,
        entryCount: store.programmeChanges.entryCount || 0,
        sections: (store.programmeChanges.sections || []).map((s) => ({
          title: s.title,
          entries: s.entryCount ?? (s.entries || []).length,
        })),
      }
    : null;

  return {
    slug: store.slug,
    festivalId: store.festivalId,
    name: store.festival.name,
    city: store.festival.city,
    country: store.festival.country,
    countryCode: store.festival.countryCode,
    region: store.festival.region,
    types: store.festival.types,
    // 授权状态（仅当存在时落键，未声明授权的届次卡片保持不变）
    ...(store.festival.authorization ? { authorization: store.festival.authorization } : {}),
    ...(store.festival.authorizationNote ? { authorizationNote: store.festival.authorizationNote } : {}),
    year: store.edition.year,
    startDate: store.edition.startDate,
    endDate: store.edition.endDate,
    dayCount: store.edition.dayCount,
    timezone: tz,
    officialUrl: store.festival.officialUrl,
    lifecycle: store.lifecycle,
    status: store.status,
    statusDetail: store.statusDetail,
    statusNote: store.statusNote,
    stats: store.stats,
    ...(pc ? { programmeChanges: pc } : {}),
    today: {
      date: today,
      screenings: todayEntries.filter((s) => s.kind === "SCREENING").length,
      events: todayEntries.filter((s) => s.kind !== "SCREENING").length,
      entries: todayEntries.length,
      venues: venuesToday.size,
      guestVisits: todayEntries.filter((s) => s.qa).length,
      items,
    },
    nextScreeningDate: upcoming ? upcoming.date : null,
    sources: (store.sources || []).map((s) => ({
      kind: s.kind, label: s.label, url: s.url, ok: s.ok, httpStatus: s.httpStatus, fetchedAt: s.fetchedAt,
    })),
    fetchedAt: store.fetchedAt,
    lastVerifiedAt: store.lastVerifiedAt,
    dataAgeMinutes: store.lastVerifiedAt
      ? Math.max(0, Math.round((Date.now() - Date.parse(store.lastVerifiedAt)) / 60000))
      : null,
    changes7d,
    dataSource: store.dataSource,
  };
}

export function buildPublished({ stores, changes, now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z") }) {
  // ── 发布授权门禁 ── 未明确 granted 的届次在此被整体剔除，
  // 后续所有产物（索引卡片、月历、变更流）都从过滤后的集合派生，无法被绕过。
  const publishable = (stores || []).filter(isAuthorized);
  const publishedSlugs = new Set(publishable.map((s) => s.slug));
  const cards = publishable.map((store) => cardOf(store, { today: localDay(now, store.edition.timezone || "UTC"), changes }));

  // 月历 / 周视图密度：日期 → {screenings, events, festivals}
  const calendar = {};
  const bump = (date, slug, screenings = 0, events = 0) => {
    if (!calendar[date]) calendar[date] = { screenings: 0, events: 0, festivals: [] };
    if (!calendar[date].festivals.includes(slug)) calendar[date].festivals.push(slug);
    calendar[date].screenings += screenings;
    calendar[date].events += events;
  };
  for (const store of publishable) {
    for (const d of dateRange(store.edition.startDate, store.edition.endDate)) bump(d, store.slug, 0, 0);
    const perDay = new Map();
    for (const s of store.screenings || []) {
      const cur = perDay.get(s.date) || { scr: 0, ev: 0 };
      if (s.kind === "SCREENING") cur.scr++;
      else cur.ev++;
      perDay.set(s.date, cur);
    }
    for (const [d, v] of perDay) bump(d, store.slug, v.scr, v.ev);
  }
  for (const d of Object.keys(calendar)) calendar[d].festivals.sort();

  const today = localDay(now, "Asia/Shanghai");
  const liveToday = cards.filter(
    (c) => c.lifecycle === "LIVE" || (c.startDate <= today && c.endDate >= today)
  );
  const upcoming = cards.filter((c) => c.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const recentChanges = (changes || []).filter((c) => Date.parse(c.at) > Date.now() - 7 * DAY);

  return {
    summary: {
      updated: now,
      today,
      scopeNote: {
        zh: "只收录已核实官方来源的电影节；尚未公布排片会明确标注状态，而不是留空。",
        en: "Only festivals with verified official sources. Unannounced schedules are labelled, never left blank.",
      },
      stats: {
        festivals: cards.length,
        blocked: (stores || []).filter((s) => !isAuthorized(s)).length,
        liveToday: liveToday.length,
        screeningsToday: liveToday.reduce((n, c) => n + (c.today?.screenings || 0), 0),
        eventsToday: liveToday.reduce((n, c) => n + (c.today?.events || 0), 0),
        upcoming: upcoming.length,
        changes7d: recentChanges.length,
        venuesToday: liveToday.reduce((n, c) => n + (c.today?.venues || 0), 0),
      },
      festivals: cards,
      calendar,
    },
    details: Object.fromEntries(publishable.map((s) => [s.slug, s])),
    changesFeed: {
      updated: now,
      count7d: recentChanges.length,
      // 变更流只收录已获授权届次，避免被阻断届次的变更记录绕过门禁出现在公开产物里
      changes: (changes || []).filter((c) => publishedSlugs.has(c.slug)).slice(0, 200),
    },
  };
}
