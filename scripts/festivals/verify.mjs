#!/usr/bin/env node
/**
 * Festival Calendar —— 发布产物自检（项目无 test 框架，用自带断言当回归门）
 *
 *   node scripts/festivals/verify.mjs
 *
 * 校验发布出去的 public/api 文件与磁盘上的标准化数据一致且自洽：
 *   1. 每条排片必须有官方来源 URL、合法日期/时间、合法影厅；
 *   2. 日期必须落在该届电影节区间内；
 *   3. 「排片待公布」必须是显式状态，不能只是空数组而无状态；
 *   4. 今日统计与今日排片条数必须对得上；
 *   5. 变更记录必须带 old/new 与官方来源；
 *   6. 详情文件里的影片引用必须存在。
 * 任一失败 → 非零退出（CI 里会让这一步红掉）。
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";
import * as idfa from "./adapters/idfa.mjs";
import * as bfi from "./adapters/bfi.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const API = join(ROOT, "public", "api");
// 自检用的临时目录（合成快照），不落进仓库
const SCRATCH = join(tmpdir(), "kims-verify-scratch");

const errors = [];
const warnings = [];
let checks = 0;
const ok = (cond, msg) => {
  checks++;
  if (!cond) errors.push(msg);
};

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

const eq = (got, want, msg) =>
  ok(JSON.stringify(got) === JSON.stringify(want), `${msg} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const hasItem = (arr, needle, msg) =>
  ok((arr || []).some((x) => String(x || "").includes(needle)), `${msg} — nothing matching "${needle}" in ${JSON.stringify((arr || []).slice(0, 6))}`);

/* ═════════════════════ 一、口径：PROGRAMME SCHEDULE 计数拆分必须自洽 ═════════════════════
 * 页面把 SCREENING + EVENT + TBA 合成一张 PROGRAMME SCHEDULE 列表并展示拆分计数；
 * 这里断言「条目总数 = 场次 + 活动 + 待定」，任何分类漂移（未知 kind、漏桶）都会让 CI 红掉。 */
function statBreakdown(st, where, { today = false } = {}) {
  if (!st) return;
  if (today) {
    ok(
      (st.entries ?? 0) === (st.screenings ?? 0) + (st.events ?? 0),
      `${where}: today entries ${st.entries} != screenings ${st.screenings} + events ${st.events}`
    );
    return;
  }
  ok(
    (st.entries ?? 0) === (st.screenings ?? 0) + (st.events ?? 0) + (st.pending ?? 0),
    `${where}: entries ${st.entries} != screenings ${st.screenings} + events ${st.events} + pending ${st.pending}`
  );
}

/* ═════════════════════ 二、IDFA 适配器自检（全离线：纯函数 + 假 fetchText，不碰网络） ═════════════════════
 * 覆盖：字段映射、非本届残留过滤、重复场次、缺失字段、空结果、HTTP 错误、GraphQL 错误、
 *       过滤条件必带、时区换算、稳定键。用假响应驱动真实管线，任何字段改名都会在这里先红。 */

const IDFA_UUIDS = {
  f1: "11111111-1111-4111-8111-111111111111",
  f2: "22222222-2222-4222-8222-222222222222",
  sec: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  s1: "b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1",
  s2: "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2",
  s3: "b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3",
  s4: "b4b4b4b4-b4b4-4b4b-8b4b-b4b4b4b4b4b4",
  s5: "b5b5b5b5-b5b5-4b5b-8b5b-b5b5b5b5b5b5",
};

const IDFA_EDITION = {
  id: "idfa-2026",
  year: 2026,
  startDate: "2026-11-12",
  endDate: "2026-11-22",
  timezone: "Europe/Amsterdam",
};

/** 假 GraphQL 端点：按 query 文本路由，返回构造好的官方响应 */
function fakeIdfaFetcher({ days = {}, totalHits = 0, films = [], filmTotal = 0, sections = [], httpFail = null, gqlErrors = null } = {}) {
  const calls = [];
  const respond = (url, json) => ({ ok: true, status: 200, url, body: JSON.stringify(json) });
  const fn = async (url, opts = {}) => {
    const query = opts.body ? JSON.parse(opts.body).query : "";
    calls.push({ url, query, method: opts.method || "GET", headers: opts.headers || {} });
    if (httpFail) return { ok: false, status: httpFail, url, body: "", error: `HTTP ${httpFail}` };
    if (gqlErrors) return respond(url, { errors: gqlErrors });
    if (/searchSchedule\(filters: \[\{key: SHOW_TYPE/.test(query)) {
      return respond(url, {
        data: {
          searchSchedule: {
            totalHits,
            hits: [{ id: "x" }],
            filters: [{ filter: "DAY", amounts: Object.entries(days).map(([key, d]) => ({ key, amount: d.amount ?? (d.hits || []).length })) }],
          },
        },
      });
    }
    const day = query.match(/key: DAY, value: \["([^"]*)"\]/);
    if (day) {
      const d = days[day[1]] || { hits: [], amount: 0 };
      return respond(url, { data: { searchSchedule: { totalHits: d.amount ?? (d.hits || []).length, hits: d.hits || [] } } });
    }
    if (/searchFestivalFilms/.test(query)) {
      const offset = Number((query.match(/offset: (\d+)/) || [])[1] || 0);
      return respond(url, { data: { searchFestivalFilms: { totalHits: filmTotal, hits: offset === 0 ? films : [] } } });
    }
    if (/currentFestivalSections/.test(query)) return respond(url, { data: { currentFestivalSections: sections } });
    return { ok: false, status: 400, url, body: "", error: `unrouted query: ${query.slice(0, 60)}` };
  };
  fn.calls = calls;
  return fn;
}

const show = (id, startOn, endOn, location, film, extra = {}) => ({ id, fullTitle: `T ${id.slice(0, 2)}`, startOn, endOn, location, film, ...extra });

async function idfaAdapterChecks() {
  const { f1, f2, sec, s1, s3, s4, s5 } = IDFA_UUIDS;
  const film1 = {
    id: f1,
    fullPreferredTitle: "The Long Winter",
    translatedTitle: null,
    yearOfProduction: 2026,
    lengthInMinutes: 100,
    countriesOfProduction: [{ key: "NL", translation: "Netherlands" }],
    subtitleLanguages: [{ key: "EN", translation: "English" }],
    kijkwijzer: [{ key: "12", translation: "12" }],
    sections: [{ id: sec, name: "Best of IDFA" }],
    credits: [{ fullName: "Jane Doe", role: { key: "DIRECTOR", translation: "Director" }, person: { fullName: "Jane Doe" } }],
  };
  const film2 = { ...film1, id: f2, fullPreferredTitle: "All-day Programme", sections: [], subtitleLanguages: [], kijkwijzer: [] };

  // ── 1) 纯函数：时区 / 稳定键 / 分类边界 ──
  eq(idfa.localParts("2026-11-20T10:00:00Z", "Europe/Amsterdam"), { date: "2026-11-20", time: "11:00" }, "idfa: CET 换算");
  eq(idfa.localParts("2026-07-20T10:00:00Z", "Europe/Amsterdam"), { date: "2026-07-20", time: "12:00" }, "idfa: CEST 换算");
  eq(idfa.localParts("2026-11-20T23:30:00Z", "Europe/Amsterdam"), { date: "2026-11-21", time: "00:30" }, "idfa: 跨日换算");
  eq(idfa.localParts("", "Europe/Amsterdam"), null, "idfa: 空时间");
  eq(idfa.localParts("not-a-date", "UTC"), null, "idfa: 非法时间");
  const mins = (a, b) => idfa.durationMinutes({ startOn: a, endOn: b });
  eq(idfa.classifyShow({ film: { id: f1 }, startOn: "2026-11-20T10:00:00Z", endOn: "2026-11-20T14:00:00Z" }), "SCREENING", "idfa: 240 分钟仍是场次");
  eq(idfa.classifyShow({ film: { id: f1 }, startOn: "2026-11-20T10:00:00Z", endOn: "2026-11-20T14:01:00Z" }), "EVENT", "idfa: 超过 240 分钟归活动（整日节目块）");
  eq(idfa.classifyShow({ film: null, startOn: "2026-11-20T10:00:00Z", endOn: "2026-11-20T11:00:00Z" }), "EVENT", "idfa: 无影片关联归活动");
  eq(idfa.classifyShow({ film: { id: f1 }, startOn: "2026-11-20T10:00:00Z" }), "SCREENING", "idfa: 缺结束时间不误判为块");
  eq(mins("2026-11-20T10:00:00Z", "2026-11-20T09:00:00Z"), null, "idfa: 结束早于开始视为无效");
  ok(idfa.stableNum(f1) === idfa.stableNum(f1) && idfa.stableNum(f1) > 0, "idfa: 稳定键必须可重复且非零");
  ok(idfa.stableNum(f1) !== idfa.stableNum(f2), "idfa: 不同影片不得同键");

  // ── 2) 真实管线（假端点）：非本届 / 重复 / 缺字段 混合场景 ──
  const fetcher = fakeIdfaFetcher({
    totalHits: 7,
    days: {
      "2026-05-06": { amount: 1, hits: [show("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "2026-05-06T10:00:00Z", "2026-05-06T11:00:00Z", "Eye", null)] },
      "2026-11-20": {
        amount: 3,
        hits: [
          show(s1, "2026-11-20T10:00:00Z", "2026-11-20T11:40:00Z", "Pathé Noord 10", { id: f1, fullPreferredTitle: "The Long Winter" }, { hasQa: true, ticketAvailabilityStatus: "SOLD_OUT" }),
          show(s1, "2026-11-20T10:00:00Z", "2026-11-20T11:40:00Z", "Pathé Noord 10", { id: f1, fullPreferredTitle: "The Long Winter" }), // 官方重复行
          show(s3, "2026-11-20T12:00:00Z", "2026-11-20T13:00:00Z", "   ", { id: f1, fullPreferredTitle: "The Long Winter" }), // 缺影厅
        ],
      },
      "2026-11-21": {
        amount: 3,
        hits: [
          { id: s4, fullTitle: "All-day programme", startOn: "2026-11-21T06:00:00Z", endOn: "2026-11-21T18:00:00Z", location: "Eye", film: { id: f2, fullPreferredTitle: "All-day Programme" } },
          { id: s5, fullTitle: "No time", startOn: "", endOn: "", location: "Eye", film: null }, // 缺时间
          { fullTitle: "No id", startOn: "2026-11-21T09:00:00Z", endOn: "2026-11-21T10:00:00Z", location: "Eye", film: null }, // 缺 id
        ],
      },
    },
    films: [film1, film2, { id: "NotAUuid", fullPreferredTitle: "未收录联合成员" }],
    filmTotal: 3,
    sections: [{ id: sec, name: "Best of IDFA", group: "Competition" }],
  });

  const res = await idfa.fetchEdition({ edition: IDFA_EDITION, fetchText: fetcher, log: () => {} });

  eq(res.items.length, 2, "idfa: 6 条官方记录 → 2 条有效条目（1 场次 + 1 活动）");
  eq(res.items.map((i) => i.kind).sort(), ["EVENT", "SCREENING"], "idfa: 类型分类");
  const scr = res.items.find((i) => i.kind === "SCREENING");
  eq(scr.venueName, "Pathé Noord 10", "idfa: 影厅来自官方 location");
  eq([scr.date, scr.localTime], ["2026-11-20", "11:00"], "idfa: 当地日期时间");
  eq(scr.title, "The Long Winter", "idfa: 片名用官方首选片名");
  eq(scr.subtitle, "English", "idfa: 字幕语言随影片");
  eq(scr.grade, "12", "idfa: 分级随影片");
  eq(scr.qa, true, "idfa: 影人问答标记");
  eq(scr.ticketStatus, "SOLD_OUT", "idfa: 售票状态直取官方");
  eq(scr.filmIdx, idfa.stableNum(f1), "idfa: 影片键稳定");
  eq(scr.officialSourceUrl, idfa.ENDPOINT, "idfa: 每条都带官方来源");
  const blk = res.items.find((i) => i.kind === "EVENT");
  eq([blk.title, blk.filmIdx, blk.localTime], ["All-day programme", null, "07:00"], "idfa: 整日节目块归活动且不挂影片");
  // 丢弃原因通过 warnings 透出（fetchEdition 只回传 items/warnings，不回传原始 dropped 数组）
  const drops = res.warnings.filter((w) => w.includes("official record(s):")).join(" | ");
  hasItem([drops], "duplicate show id", "idfa: 重复场次必须被丢弃");
  hasItem([drops], "no venue in official record", "idfa: 缺影厅必须被丢弃");
  hasItem([drops], "no start time", "idfa: 缺时间必须被丢弃");
  hasItem([drops], "malformed record", "idfa: 缺 id 必须被丢弃");
  ok(!drops.includes("outside edition"), "idfa: 届次外日期不得混入 fetched rows（应只经 day 统计过滤）");
  ok(
    res.items.every((i) => i.date >= IDFA_EDITION.startDate && i.date <= IDFA_EDITION.endDate),
    "idfa: 入库条目日期必须落在本届区间内"
  );
  hasItem(res.warnings, "outside this edition", "idfa: 非本届残留必须显式告警");
  hasItem(res.warnings, "all-day programme block", "idfa: 节目块归类必须显式告警");
  eq(res.days.map((d) => d.date), ["2026-11-20", "2026-11-21"], "idfa: 只抓本届日期（5 月的残留日不下发查询）");
  ok(res.coverage.declaredTotal === 7 && res.coverage.declaredInEdition === 6 && res.coverage.fetched === 6, "idfa: 官方口径与实抓量须可核对");
  ok(res.sources.some((s) => s.kind === "SCHEDULE" && s.ok) && res.sources.some((s) => s.kind === "PROGRAMME" && s.ok), "idfa: SCHEDULE / PROGRAMME 来源须可用");
  ok(res.sources.every((s) => /^https:/.test(s.url)), "idfa: 来源 URL 必须为官方 https");
  eq(res.films.length, 2, "idfa: 非影片联合成员被丢弃");
  eq(res.sections, [{ cIdx: idfa.stableNum(sec), name: "Best of IDFA", group: "Competition" }], "idfa: 官方单元直取");

  // GraphQL 契约：POST + 站点头 + 每次排片查询都带有效 filter
  ok(fetcher.calls.every((c) => c.method === "POST" && c.headers.origin === idfa.SITE && c.headers["content-type"] === "application/json"), "idfa: 必须 POST + 带站点 Origin/Referer 头");
  ok(fetcher.calls[0].query.includes("filters: [{key: SHOW_TYPE"), "idfa: 概览查询必须带 SHOW_TYPE 过滤");
  ok(fetcher.calls.filter((c) => /key: DAY/.test(c.query)).length === 2, "idfa: 逐日查询必须带 DAY 过滤");
  ok(fetcher.calls.every((c) => c.query.includes("query {")), "idfa: 查询必须是合法 GraphQL 文档");

  // ── 3) 空结果 / 未公布 ──
  const empty = await idfa.fetchEdition({ edition: IDFA_EDITION, fetchText: fakeIdfaFetcher({}), log: () => {} });
  eq([empty.items.length, empty.films.length], [0, 0], "idfa: 空响应 → 0 条目 0 影片");
  hasItem(empty.warnings, "not published yet", "idfa: 0 场次必须显式声明尚未公布");
  hasItem(empty.warnings, "SCHEDULE_PENDING", "idfa: 必须区分 SCHEDULE_PENDING 与完整排片");
  ok(empty.sources.some((s) => s.kind === "SCHEDULE" && s.ok), "idfa: 空但可达的响应不算抓取失败");

  // ── 4) HTTP 错误 / GraphQL 错误 ──
  const http500 = await idfa.fetchEdition({ edition: IDFA_EDITION, fetchText: fakeIdfaFetcher({ httpFail: 500 }), log: () => {} });
  eq(http500.items.length, 0, "idfa: HTTP 500 → 不产出条目");
  ok(http500.sources.every((s) => !s.ok), "idfa: HTTP 500 必须标记来源不可用（不得覆盖旧数据）");
  hasItem(http500.warnings, "HTTP 500", "idfa: HTTP 错误必须记录");
  const broken = await idfa.fetchEdition({ edition: IDFA_EDITION, fetchText: fakeIdfaFetcher({ gqlErrors: [{ message: "cannot query field" }] }), log: () => {} });
  eq(broken.items.length, 0, "idfa: GraphQL 错误 → 不产出条目");
  ok(broken.sources.every((s) => !s.ok), "idfa: GraphQL 错误必须标记来源不可用");
  hasItem(broken.warnings, "cannot query field", "idfa: GraphQL 错误信息必须保留");
  eq(idfa.gqlError({ errors: [{ message: "a" }, { message: "b" }] }), "a; b", "idfa: GraphQL 错误合并");
  eq(idfa.gqlError({ data: {} }), null, "idfa: 无错误时返回 null");
  eq(idfa.gqlError(null), null, "idfa: 空响应不报错");

  // ── 5) 注入防线：非法 DAY 键不得进入查询 ──
  eq(idfa.dayAmounts({ data: { searchSchedule: { filters: [{ filter: "DAY", amounts: [{ key: "2026-11-20", amount: 1 }, { key: "2026-5-6", amount: 1 }, { key: '"; drop', amount: 9 }, { key: "", amount: 1 }] }] } } }), [{ day: "2026-11-20", amount: 1 }], "idfa: DAY 键必须只接受 YYYY-MM-DD");
  eq(idfa.dayAmounts({}), [], "idfa: 无 filters 时返回空");
  ok(idfa.QUERIES.day("2026-11-20").includes('key: DAY, value: ["2026-11-20"]'), "idfa: DAY 查询文本");
  const inject = fakeIdfaFetcher({ totalHits: 5, days: { '2026-11-20"; x': { amount: 5, hits: [] } } });
  const injRes = await idfa.fetchEdition({ edition: IDFA_EDITION, fetchText: inject, log: () => {} });
  ok(!inject.calls.some((c) => c.query.includes("DROP") || c.query.includes('"; x')), "idfa: 未校验的 DAY 键绝不出现在查询里");
  eq(injRes.items.length, 0, "idfa: 非法日期不产出条目");

  eq(idfa.parseShows(null, { edition: IDFA_EDITION, timeZone: "UTC" }), { items: [], dropped: [] }, "idfa: 空输入容错");
  eq(idfa.parseFilms(null), [], "idfa: 空影片列表容错");
}

/**
 * BFI London Film Festival 自检（离线快照优先）
 *  - 解析逻辑用合成页面测（CI 无快照也必须覆盖）；
 *  - 端到端断言只在 data/festivals/raw/bfi/*.html 快照存在时执行，
 *    快照缺失只 push warning，绝不 fail（whatson 对非浏览器客户端 403 属预期）。
 */
async function bfiAdapterChecks() {
  const EDITION = { slug: "bfi-2026", year: 2026, startDate: "2026-10-07", endDate: "2026-10-18", timezone: "Europe/London" };

  // ── 1) 纯函数：官方标签映射（证据 = 页面内联 searchLabels） ──
  const LABELS_HTML =
    'var searchLabels = { avail_excellent: "Excellent", avail_good: "Good", ' +
    'avail_limited: "Limited", avail_sold_out: "Sold Out", sold_out_message: "Sold out!", ' +
    'on_sale_message: "On sale" };';
  const labels = bfi.extractLabels(LABELS_HTML);
  eq(Object.keys(labels).sort(), ["excellent", "good", "limited", "onSaleMessage", "soldOut", "soldOutMessage"], "bfi: 官方标签必须可引证（searchLabels 全键）");
  eq(labels.soldOut, "Sold Out", "bfi: avail_sold_out = \"Sold Out\"");
  eq(labels.limited, "Limited", "bfi: avail_limited = \"Limited\"");
  eq(labels.good, "Good", "bfi: avail_good = \"Good\"");
  eq(labels.excellent, "Excellent", "bfi: avail_excellent = \"Excellent\"");
  eq(labels.soldOutMessage, "Sold out!", "bfi: sold_out_message = \"Sold out!\"");
  eq(labels.onSaleMessage, "On sale", "bfi: on_sale_message = \"On sale\"");

  // ── 2) 状态映射（只按实测共现事实；无证据一律 null） ──
  eq(bfi.ticketStatusOf({ salesStatus: "S", availabilityStatus: "S" }), "SOLD_OUT", "bfi: S+S → SOLD_OUT");
  eq(bfi.ticketStatusOf({ salesStatus: "S", availabilityStatus: "L" }), "LIMITED", "bfi: S+L → LIMITED");
  eq(bfi.ticketStatusOf({ salesStatus: "S", availabilityStatus: "G" }), "GOOD", "bfi: S+G → GOOD");
  eq(bfi.ticketStatusOf({ salesStatus: "S", availabilityStatus: "E" }), "EXCELLENT", "bfi: availability=E → EXCELLENT");
  eq(bfi.ticketStatusOf({ salesStatus: "C", availabilityStatus: "S" }), "NOT_ON_SALE", "bfi: C → NOT_ON_SALE");
  eq(bfi.ticketStatusOf({ salesStatus: "C", availabilityStatus: "U" }), "NOT_ON_SALE", "bfi: C+U → NOT_ON_SALE");
  eq(bfi.ticketStatusOf({ salesStatus: "S", availabilityStatus: "U" }), null, "bfi: 无证据组合绝不臆造（S+U → null）");
  eq(bfi.ticketStatusOf({ salesStatus: "", availabilityStatus: "" }), null, "bfi: 缺失状态 → null");

  // ── 3) 纯函数：URL / 日期 / 时间 / 单元 / 标签 ──
  eq(bfi.DAY_URL("20261007"), "https://whatson.bfi.org.uk/lff/Online/default.asp?BOparam::WScontent::loadArticle::permalink=20261007", "bfi: 日程页 URL 模板");
  eq(bfi.dayPermalinks(EDITION), ["20261007", "20261008", "20261009", "20261010", "20261011", "20261012", "20261013", "20261014", "20261015", "20261016", "20261017", "20261018"], "bfi: 12 天 permalink 由届次区间推出");
  eq(bfi.dateFromPermalink("20261018"), "2026-10-18", "bfi: permalink → 日期");
  eq(bfi.dateFromPermalink(bfi.CHANGES_PERMALINK), null, "bfi: 非日期 permalink 不得伪造日期");
  const d1 = bfi.dateOf("2026", "9", "8", "20261008");
  eq(d1.iso, "2026-10-08", "bfi: 零基月份换算（10 月 = 9）");
  eq(d1.permalinkDate, "2026-10-08", "bfi: permalink 日期原样保留");
  const d2 = bfi.dateOf("2026", "9", "9", "20261008");
  eq(d2.iso, "2026-10-09", "bfi: 行日期与页面 permalink 不一致时各自保留");
  eq(bfi.timeOf("17:45", "Thursday 08 October 2026 17:45"), "17:45", "bfi: 本地时间直取 [8]");
  eq(bfi.strandOf("LFFGALA"), "LFFGALA", "bfi: 单元代码原样保留");
  eq(bfi.strandOf("n/a"), null, "bfi: 无单元不得伪造");
  eq(bfi.eventUrlOf("default.asp?doWork::WScontent::loadArticle=Load&x=1"), "https://whatson.bfi.org.uk/lff/Online/default.asp?doWork::WScontent::loadArticle=Load&x=1", "bfi: [18] → 官方详情深链");
  eq(bfi.keywordTokens("UK, BSL, Q&A"), ["UK", "BSL", "Q&A"], "bfi: 标签列按逗号切分");
  ok(Object.values(bfi.STRAND_LABELS).every((v) => typeof v === "string" && v.length > 0), "bfi: 单元展示名只能是可引证的字符串");

  // ── 4) 解析：合成页面（内联数组非法转义 / 未转义嵌套数组；禁止 JSON.parse） ──
  const cells = () => new Array(98).fill("");
  const rowSrc = (over) => {
    const c = cells();
    for (const [k, v] of Object.entries(over)) c[Number(k)] = v;
    return "[" + c.map((x) => (x === "" ? '""' : x.startsWith("RAW:") ? x.slice(4) : JSON.stringify(x))).join(",") + "]";
  };
  const base = {
    0: "11111111-1111-4111-8111-111111111111",
    4: "andr_08Oct26",
    5: 'A Film: Part 2, Reprise "Special"',
    6: 'A Film: Part 2, Reprise "Special"',
    7: "Thursday 08 October 2026 13:00",
    8: "13:00",
    9: "8",
    10: "9",
    11: "2026",
    14: "S",
    15: "L",
    16: "7",
    17: "UK, BSL, Q&A",
    18: "default.asp?doWork::WScontent::loadArticle=Load&BOparam::WScontent::loadArticle::article_id=aaaa",
    28: "LFFGALA",
    62: "22222222-2222-4222-8222-222222222222",
    63: "LFF 2026 BFI Southbank - NFT1",
    64: "BFI Southbank, Screen NFT1",
    80: "LFF2026",
    81: "£10.00",
    93: "Public",
    97: 'RAW:["2026-10-08","2026-10-11"]', // 未转义嵌套数组：naive split 会把它切成两格
  };
  const synthetic =
    "<html><script>var searchHeaders = [\"a\",\"b\"];\n" +
    "var searchNames = " + JSON.stringify(new Array(98).fill("col")) + ";\n" +
    LABELS_HTML + "\n" +
    "var searchResults = [\n" +
    rowSrc(base) + ",\n" +
    rowSrc({ ...base, 0: "33333333-3333-4333-8333-333333333333", 4: "nots_15Oct26", 5: "Coming Soon Film", 6: "Coming Soon Film", 7: "Thursday 15 October 2026 18:30", 8: "18:30", 9: "15", 14: "C", 15: "U", 16: "", 28: "LFFTHRILL", 81: "£12.50" }) + ",\n" +
    rowSrc({ ...base, 0: "44444444-4444-4444-8444-444444444444", 4: "sold_07Oct26", 5: "Sold Out Film", 6: "Sold Out Film", 7: "Wednesday 07 October 2026 20:00", 8: "20:00", 9: "7", 14: "S", 15: "S", 16: "0", 28: "LFFGALAREPEAT" }) + "\n" +
    "];\n</script></html>";

  const parsed = bfi.parseDayHtml(synthetic, { permalink: "20261008", sourceUrl: bfi.DAY_URL("20261008") });
  eq(parsed.count, 3, "bfi: 深度扫描器须解析出 3 行（含未转义嵌套数组）");
  eq(parsed.columnNames.length, bfi.COLUMN_COUNT, "bfi: searchNames 列数 98");
  ok(parsed.rows.every((r) => r.length === bfi.COLUMN_COUNT), "bfi: 每行必须保持 98 列（嵌套数组不得撑裂行）");
  eq(parsed.rows[0][97], '["2026-10-08","2026-10-11"]', "bfi: 嵌套数组单元格必须原样保留");
  eq(parsed.rows[0][5], 'A Film: Part 2, Reprise "Special"', "bfi: 单元格内逗号与转义引号必须正确还原");
  eq(parsed.rows[0][81], "£10.00", "bfi: 票价列原样保留");

  // 合成快照也要走完 fetchEdition（净化后的取数路径，不应联网）
  const synthDir = join(SCRATCH, "bfi-synth-" + Date.now());
  mkdirSync(synthDir, { recursive: true });
  for (const p of bfi.dayPermalinks(EDITION)) writeFileSync(join(synthDir, `${p}.html`), synthetic, "utf8");
  writeFileSync(join(synthDir, `${bfi.CHANGES_PERMALINK}.html`), synthetic, "utf8");
  let synthNet = 0;
  const synthRes = await bfi.fetchEdition({
    festival: { id: "bfi" },
    edition: EDITION,
    snapshotDir: synthDir,
    log: () => {},
    fetchText: async (u) => { synthNet++; return { ok: false, status: 403, body: "", url: u }; },
  });
  eq(synthNet, 0, "bfi: 快照齐全时绝不允许发起网络请求");
  eq(synthRes.items.length, 36, "bfi: 合成快照 12 天 × 3 行 → 36 场次");
  eq(synthRes.items.filter((i) => i.ticketStatus === "SOLD_OUT").length, 12, "bfi: 售罄行映射 SOLD_OUT");
  eq(synthRes.items.filter((i) => i.ticketStatus === "NOT_ON_SALE").length, 12, "bfi: 未开票行映射 NOT_ON_SALE");
  eq(synthRes.items.filter((i) => i.ticketStatus === "LIMITED").length, 12, "bfi: 受限行映射 LIMITED");
  ok(synthRes.items.every((i) => i.ticketUrl === null), "bfi: 无稳定购票 URL 时必须置 null（不得编造）");
  ok(
    synthRes.items.every((i) => typeof i.minPrice === "string" && i.minPrice.length > 0),
    "bfi: 合成快照每行必须带官方票价原文（minPrice）"
  );
  eq(synthRes.items.filter((i) => i.minPrice === "£10.00").length, 24, "bfi: 票价列原样透传（£10.00 × 12 天 × 2 行）");
  eq(synthRes.items.filter((i) => i.minPrice === "£12.50").length, 12, "bfi: 票价列原样透传（£12.50 × 12 天 × 1 行）");
  ok(synthRes.items.every((i) => /^https:\/\/whatson\.bfi\.org\.uk\//.test(i.officialSourceUrl)), "bfi: 每行必须带官方来源 URL");
  ok(synthRes.items.every((i) => /^https:\/\/whatson\.bfi\.org\.uk\//.test(i.eventUrl)), "bfi: eventUrl 必须是官方深链");
  eq(synthRes.days.length, 12, "bfi: 覆盖 12 天");
  ok(synthRes.days.every((d) => d.via === "snapshot" && d.ok), "bfi: 全部走离线快照");
  eq(synthRes.notes.snapshotDays, 12, "bfi: 快照天数登记");
  eq(synthRes.notes.columnNamesConfirmed, 98, "bfi: 列名确认 98");
  eq(synthRes.films.length, 3, "bfi: 去重影片数（3 个不同片名）");
  ok(synthRes.films.every((f) => f.director === null && f.country === null), "bfi: 页面无可引证的导演/国家时必须 null，不得编造");
  ok(synthRes.sections.every((s) => s.cIdx && s.name), "bfi: 单元必须带原始代码与展示名");
  ok(synthRes.sources.filter((s) => s.kind === "SCHEDULE").length === 12, "bfi: 12 个日程来源须登记");
  ok(synthRes.sources.every((s) => /^https:\/\/whatson\.bfi\.org\.uk\//.test(s.url)), "bfi: 来源 URL 必须为官方 https");
  try { rmSync(synthDir, { recursive: true, force: true }); } catch { /* 清理失败不影响自检 */ }

  // ── 4.5) programme-changes 散文解析（纯函数，合成页；把页脚/促销文案放在边界之外） ──
  const CH_SYNTH = [
    '<html><body>',
    '<h1>Programme additions and changes</h1>',
    '<p><strong>Last update: 6</strong> October</p>',
    '<h3>LATE ADDITIONS</h3>',
    '<p>ARTIFICIAL<br>SUN 11 OCT RFH 21:00</p>',
    '<p>JOY OF JOYS<br>SAT 10 OCT NFT1 18:00</p>',
    '<h3>ACCESS UPDATES</h3>',
    '<p>FJORD<br>SAT 17 OCT 14:00 RFH<br>Closed Captions via WatchWord Glasses.</p>',
    '</div><div role="complementary" aria-label="Secondary">Sign up for our newsletter. Membership and brochure.</div>',
    '<div id="footer">cookie consent privacy policy</div>',
    '</body></html>',
  ].join("\n");
  const chSynth = bfi.parseProgrammeChanges(CH_SYNTH);
  eq(chSynth.sectionCount, 2, "bfi: 变更页按 h3 分节计数");
  eq(chSynth.entryCount, 3, "bfi: 变更页每个 <p> 记一条");
  eq(chSynth.lastUpdate, "Last update: 6 October", 'bfi: 变更页 lastUpdate 必须读全，不得截断为 "6"');
  eq(chSynth.sections[0].title, "LATE ADDITIONS", "bfi: 变更页分节标题");
  eq(chSynth.sections[0].entries[0].title, "ARTIFICIAL", "bfi: 条目首行 = 片名/标题");
  eq(chSynth.sections[0].entries[0].lines.length, 2, "bfi: <br> 分隔条目内行");
  eq(chSynth.sections[0].entries[0].lines[1], "SUN 11 OCT RFH 21:00", "bfi: 条目第二行 = 场次行");
  ok(
    !/cookie|consent|privacy policy|sign up|membership|brochure/i.test(JSON.stringify(chSynth.sections)),
    "bfi: 变更正文边界必须把页脚/促销文案挡在条目之外"
  );
  const chEmpty = bfi.parseProgrammeChanges("<html><body><p>nothing here</p></body></html>");
  eq(chEmpty.sectionCount, 0, "bfi: 非变更页 → 0 分节");
  eq(chEmpty.entryCount, 0, "bfi: 非变更页 → 0 条目（绝不编造）");
  eq(chEmpty.lastUpdate, null, "bfi: 非变更页 → lastUpdate 为 null");
  eq(bfi.parseProgrammeChanges(""), bfi.parseProgrammeChanges(null), "bfi: 空输入返回同一空结果（不 throw）");

  // 快照全缺 → 优雅失败：不 throw、只 warning、0 条目 0 影片
  let missNet = 0;
  const emptyDir = join(SCRATCH, "bfi-empty-" + Date.now());
  const missRes = await bfi.fetchEdition({
    festival: { id: "bfi" },
    edition: EDITION,
    snapshotDir: emptyDir,
    log: () => {},
    fetchText: async (u) => { missNet++; return { ok: false, status: 403, body: "", url: u }; },
  });
  eq(missRes.items.length, 0, "bfi: 无快照且抓取失败 → 0 条目（不得崩溃）");
  ok(missNet > 0, "bfi: 无快照时才允许回退 fetchText（此处 403 属预期）");
  hasItem(missRes.warnings, "无离线快照", "bfi: 无快照必须显式告警");
  ok(missRes.sources.filter((s) => s.kind === "SCHEDULE").every((s) => !s.ok), "bfi: 抓不动的来源必须标记不可用（不得静默清空旧数据）");

  // ── 5) 真实快照端到端（缺失则只告警，绝不判失败） ──
  const snapDayCount = bfi.dayPermalinks(EDITION).filter((p) => existsSync(join(bfi.SNAPSHOT_DIR, `${p}.html`))).length;
  if (snapDayCount === 0) {
    warnings.push("bfi: 离线快照缺失（data/festivals/raw/bfi/*.html）—— 跳过 BFI 端到端断言；whatson 对非浏览器客户端 403 属预期");
    return;
  }
  let net = 0;
  const res = await bfi.fetchEdition({
    festival: { id: "bfi" },
    edition: EDITION,
    log: () => {},
    fetchText: async (u) => { net++; return { ok: false, status: 403, body: "", url: u }; },
  });
  eq(net, 0, "bfi(实测): 快照存在时绝不允许联网");
  eq(snapDayCount, 12, `bfi(实测): 12 天日程快照齐全，实得 ${snapDayCount}`);
  ok(res.items.length > 0, "bfi(实测): 快照必须产出场次");
  eq(res.days.length, 12, "bfi(实测): 覆盖 12 天");
  ok(res.days.every((d) => d.via === "snapshot" || d.via === "live"), "bfi(实测): 每页取数方式必须登记");
  const ids = new Set();
  for (const i of res.items) {
    ok(/^\d{4}-\d{2}-\d{2}$/.test(i.date), `bfi(实测): 日期非法 ${i.title}`);
    ok(i.date >= EDITION.startDate && i.date <= EDITION.endDate, `bfi(实测): ${i.title} 超出届次区间`);
    ok(/^\d{2}:\d{2}$/.test(i.localTime), `bfi(实测): 时间非法 ${i.title}`);
    ok(!!i.venueName, `bfi(实测): ${i.title} 缺场馆`);
    ok(!!i.eventUrl && /^https:\/\/whatson\.bfi\.org\.uk\/lff\/Online\//.test(i.eventUrl), `bfi(实测): ${i.title} eventUrl 非官方深链`);
    ok(!!i.officialSourceUrl && /^https:\/\/whatson\.bfi\.org\.uk\//.test(i.officialSourceUrl), `bfi(实测): ${i.title} 缺官方来源`);
    ok(["SOLD_OUT", "LIMITED", "GOOD", "EXCELLENT", "NOT_ON_SALE", null].includes(i.ticketStatus), `bfi(实测): 非法售票状态 ${i.ticketStatus}`);
    if (i.ticketStatus === "SOLD_OUT" || i.ticketStatus === "NOT_ON_SALE") ok(i.ticketUrl === null, `bfi(实测): C/S 行 ticketUrl 必须为 null`);
    ok(!ids.has(i.itemId), `bfi(实测): 场次 Id 重复 ${i.itemId}`);
    ids.add(i.itemId);
  }
  for (const t of ["SOLD_OUT", "NOT_ON_SALE", "LIMITED"]) {
    ok(res.items.some((i) => i.ticketStatus === t), `bfi(实测): 缺少 ${t} 实测样本`);
  }
  eq(res.items.filter((i) => i.ticketStatus === "EXCELLENT").length, 0, "bfi(实测): 本批数据未观测到 EXCELLENT，不得输出");
  ok(
    res.items.every((i) => i.minPrice === null || /^£\d/.test(i.minPrice)),
    "bfi(实测): minPrice 必须是官方 £ 金额原文或 null（不得臆造）"
  );
  ok(res.items.some((i) => i.minPrice === "£0.00"), "bfi(实测): LFF for Free 场次应带 £0.00（官方免费价）");
  ok(res.items.some((i) => i.minPrice && i.minPrice !== "£0.00"), "bfi(实测): 应存在非零票价样本");
  ok(res.items.every((i) => /^https:\/\/whatson\.bfi\.org\.uk\//.test(i.eventUrl)), "bfi(实测): 全部 eventUrl 官方");
  ok(res.films.length > 0 && res.sections.length > 0, "bfi(实测): 影片与单元不得为空");
  ok(res.films.every((f) => f.director === null && f.country === null), "bfi(实测): 导演/国家无引证时必须 null");
  ok(res.films.every((f) => !f.officialUrl || /^https:\/\/whatson\.bfi\.org\.uk\//.test(f.officialUrl)), "bfi(实测): 影片详情链接必须官方");
  ok(res.sources.some((s) => s.kind === "SCHEDULE" && s.ok), "bfi(实测): SCHEDULE 来源须可用");
  ok(res.sources.some((s) => s.kind === "PROGRAMME_CHANGES"), "bfi(实测): 必须登记节目变更来源");
  ok(res.sources.every((s) => /^https:\/\/whatson\.bfi\.org\.uk\//.test(s.url)), "bfi(实测): 来源 URL 必须官方 https");
  eq(res.notes.columnNamesConfirmed, 98, "bfi(实测): 列名确认 98");
  eq(res.notes.unclosedArrays, 0, "bfi(实测): 不允许存在未闭合的内联数组");
  eq(res.notes.skippedRows, 0, "bfi(实测): 不允许存在被丢弃的行");
  eq(res.notes.dateMismatch, 0, "bfi(实测): 行日期与页面日期不允许冲突");
  ok(
    !res.warnings.some((w) => /无离线快照|解析出 0 行|未登记取值/.test(w)),
    `bfi(实测): 快照齐全时不应出现取数/解析告警 — ${res.warnings.slice(0, 3).join(" | ")}`
  );

  // ── 官方「节目变更」实测快照：必须真的解析出来，且不得混入页脚/促销文案 ──
  if (existsSync(join(bfi.SNAPSHOT_DIR, `${bfi.CHANGES_PERMALINK}.html`))) {
    eq(res.notes.programmeChangesOk, true, "bfi(实测): 变更页来源必须可用");
    ok(!!res.programmeChanges, "bfi(实测): 快照存在时 programmeChanges 不得为空");
    eq(res.programmeChanges.format, "prose", "bfi(实测): 变更页为散文结构（非日程表格）");
    ok(res.programmeChanges.sectionCount >= 2, `bfi(实测): 变更分节过少 ${res.programmeChanges.sectionCount}`);
    ok(res.programmeChanges.entryCount > 0, "bfi(实测): 变更条目不得为 0（这正是此前的漏报缺陷）");
    eq(res.notes.programmeChangesEntries, res.programmeChanges.entryCount, "bfi(实测): notes 与 programmeChanges 条目数必须一致");
    ok(
      /last update/i.test(res.programmeChanges.lastUpdate || ""),
      `bfi(实测): lastUpdate 必须读全官方原文 — 实得 ${JSON.stringify(res.programmeChanges.lastUpdate)}`
    );
    ok(
      res.programmeChanges.sections.every((s) => !!s.title && Array.isArray(s.entries) && s.entries.length > 0),
      "bfi(实测): 每个变更分节都必须有标题与条目"
    );
    ok(
      res.programmeChanges.sections.every((s) => s.entries.every((e) => !!e.title && Array.isArray(e.lines) && e.lines.length > 0)),
      "bfi(实测): 每条变更都必须有标题与至少一行正文"
    );
    ok(
      res.programmeChanges.sections.reduce((n, s) => n + s.entries.length, 0) === res.programmeChanges.entryCount,
      "bfi(实测): 分节条目之和必须等于 entryCount"
    );
    ok(
      !/cookie|consent|privacy policy|sign up|membership|brochure/i.test(JSON.stringify(res.programmeChanges.sections)),
      "bfi(实测): 变更条目不得混入页脚/cookie/促销文案"
    );
    ok(
      !res.warnings.some((w) => /解析出 0 条变更/.test(w)),
      "bfi(实测): 不得出现「解析出 0 条变更」告警"
    );
  } else {
    warnings.push("bfi: 缺 programme-changes 离线快照 —— 跳过官方节目变更端到端断言");
  }
}

async function main() {
  const indexPath = join(API, "festivals.json");
  ok(existsSync(indexPath), "public/api/festivals.json missing");
  if (!existsSync(indexPath)) return;

  const index = readJson(indexPath);
  const changes = existsSync(join(API, "festival-changes.json")) ? readJson(join(API, "festival-changes.json")) : { changes: [] };

  ok(!!index.updated, "index.updated missing");
  ok(!!index.today && /^\d{4}-\d{2}-\d{2}$/.test(index.today), `index.today invalid: ${index.today}`);
  ok(Array.isArray(index.festivals) && index.festivals.length > 0, "index.festivals empty");
  ok(index.scopeNote?.zh && index.scopeNote?.en, "index.scopeNote missing (scope must be stated, never 'all festivals')");
  ok(!!index.calendar && Object.keys(index.calendar).length > 0, "index.calendar empty");

  const stats = index.stats || {};
  const liveToday = (index.festivals || []).filter((f) => f.startDate <= index.today && f.endDate >= index.today);
  ok(stats.liveToday === liveToday.length, `stats.liveToday ${stats.liveToday} != computed ${liveToday.length}`);
  const screeningSum = liveToday.reduce((n, f) => n + (f.today?.screenings || 0), 0);
  ok(stats.screeningsToday === screeningSum, `stats.screeningsToday ${stats.screeningsToday} != sum ${screeningSum}`);

  for (const f of index.festivals || []) {
    ok(f.slug && f.startDate && f.endDate, `card ${f.slug}: missing dates`);
    ok(f.startDate <= f.endDate, `card ${f.slug}: start > end`);
    ok(!!f.officialUrl, `card ${f.slug}: no official URL`);
    ok(!!f.status, `card ${f.slug}: no status`);
    ok(!!f.statusDetail?.schedule, `card ${f.slug}: schedule status not explicit`);

    // 「尚未公布」必须是状态，不是空白
    if (f.statusDetail?.schedule === "PENDING") {
      ok(!!f.statusNote?.zh, `card ${f.slug}: schedule PENDING but no explicit note`);
    }

    // 今日排片与计数一致 + 每条都带官方来源
    const items = f.today?.items || [];
    const itemsInRange = items.filter((i) => /^\d{2}:\d{2}$/.test(i.time || ""));
    ok(itemsInRange.length <= (f.today?.entries ?? 0) + 0, `card ${f.slug}: today.items ${itemsInRange.length} > entries ${f.today?.entries}`);
    const scr = items.filter((i) => i.kind === "SCREENING").length;
    ok(scr === (f.today?.screenings ?? 0), `card ${f.slug}: today screenings ${scr} != stat ${f.today?.screenings}`);
    for (const i of items) {
      ok(!!i.venueName, `card ${f.slug}: today item ${i.id} without venue`);
      ok(!!i.officialUrl, `card ${f.slug}: today item ${i.id} without official source`);
    }
    ok(!!f.lastVerifiedAt || f.dataSource === "registry", `card ${f.slug}: no lastVerifiedAt`);
    statBreakdown(f.stats, `card ${f.slug}`);
    statBreakdown(f.today, `card ${f.slug}`, { today: true });

    if (f.dataSource === "official") {
      const detailPath = join(API, "festivals", `${f.slug}.json`);
      ok(existsSync(detailPath), `detail file missing for ${f.slug}`);
      if (!existsSync(detailPath)) continue;
      const d = readJson(detailPath);

      ok(d.slug === f.slug, `detail ${f.slug}: slug mismatch`);
      ok(d.stats.films === f.stats.films, `detail ${f.slug}: films ${d.stats.films} != index ${f.stats.films}`);
      ok(d.stats.screenings === f.stats.screenings, `detail ${f.slug}: screenings ${d.stats.screenings} != index ${f.stats.screenings}`);
      statBreakdown(d.stats, `detail ${f.slug} (PROGRAMME SCHEDULE 计数拆分)`);
      ok((d.sources || []).length > 0, `detail ${f.slug}: no sources`);
      ok((d.sources || []).every((s) => /^https?:/.test(s.url)), `detail ${f.slug}: bad source url`);
      ok((d.sources || []).some((s) => s.ok), `detail ${f.slug}: no reachable official source`);

      const venueIds = new Set((d.venues || []).map((v) => v.id));
      const filmIds = new Set((d.films || []).map((x) => x.id));
      const ids = new Set();
      for (const s of d.screenings || []) {
        ok(/^\d{4}-\d{2}-\d{2}$/.test(s.date), `detail ${f.slug}: bad date ${s.id}`);
        ok(/^\d{2}:\d{2}$/.test(s.localTime), `detail ${f.slug}: bad time ${s.id}`);
        ok(s.date >= d.edition.startDate && s.date <= d.edition.endDate, `detail ${f.slug}: ${s.id} outside edition range`);
        ok(venueIds.has(s.venueId), `detail ${f.slug}: ${s.id} unknown venue ${s.venueId}`);
        ok(!ids.has(s.id), `detail ${f.slug}: duplicate id ${s.id}`);
        ids.add(s.id);
        ok(!!s.officialSourceUrl, `detail ${f.slug}: ${s.id} without official source`);
        ok(!!s.timezone, `detail ${f.slug}: ${s.id} without timezone`);
        ok(
          !("minPrice" in s) || s.minPrice === null || /^£\d/.test(s.minPrice),
          `detail ${f.slug}: ${s.id} bad minPrice ${JSON.stringify(s.minPrice)}`
        );
        if (s.kind === "SCREENING") ok(filmIds.has(s.filmId), `detail ${f.slug}: ${s.id} unknown film`);
        else ok(!!s.title, `detail ${f.slug}: ${s.kind} entry without title`);
      }

      // 覆盖天数应等于官方排片页数（BIFF 全届 10 天）
      const coveredDays = new Set((d.screenings || []).map((s) => s.date)).size;
      if (coveredDays < d.edition.dayCount) {
        warnings.push(`detail ${f.slug}: schedule covers ${coveredDays}/${d.edition.dayCount} days`);
      }
      if ((d.warnings || []).length) warnings.push(`detail ${f.slug}: parser warnings — ${d.warnings.slice(0, 3).join(" | ")}`);

      // 部分数据不得伪装成完整排片：0 场次必须显式标 PENDING 且带「尚未公布」说明
      if (!(d.stats.screenings > 0)) {
        ok(
          d.statusDetail?.schedule === "PENDING",
          `detail ${f.slug}: 0 screenings but schedule status ${d.statusDetail?.schedule} (must be PENDING)`
        );
        ok(!!d.statusNote?.zh, `detail ${f.slug}: PENDING schedule without explicit note`);
      }
      if (d.slug === "idfa-2026") {
        // 发布产物会剥掉 warnings（run.mjs 写 detail 时 delete detail.warnings），
        // 故断言改以 store 自身字段为准：部分数据必须显式标 PENDING + 中文「尚未公布」说明，
        // 一旦官方排片真正发布（有 SCREENING）则必须转为 LIVE —— 两种状态都不许含糊。
        const partial = !(d.stats.screenings > 0);
        if (partial) {
          ok(
            d.statusDetail?.schedule === "PENDING",
            `detail idfa-2026: partial schedule (0 screenings) must be PENDING, got ${d.statusDetail?.schedule}`
          );
          ok(
            /尚未公布|未公布/.test(d.statusNote?.zh || ""),
            "detail idfa-2026: partial schedule must carry an explicit '尚未公布' note"
          );
        } else {
          ok(
            d.statusDetail?.schedule === "LIVE",
            `detail idfa-2026: non-empty schedule must be LIVE, got ${d.statusDetail?.schedule}`
          );
        }
        ok(d.dataSource === "official", `detail idfa-2026: data must come from official source, got ${d.dataSource}`);
      }
    }
  }

  // 官方节目变更必须贯通到发布产物（卡片摘要 + 详情），否则「接入节目变更数据」不算完成
  {
    const bfiCard = (index.festivals || []).find((f) => f.slug === "bfi-2026");
    if (bfiCard && bfiCard.dataSource === "official") {
      ok(!!bfiCard.programmeChanges, "card bfi-2026: 官方节目变更摘要缺失");
      ok(bfiCard.programmeChanges.entryCount > 0, "card bfi-2026: 节目变更条目数为 0");
      ok(bfiCard.programmeChanges.sections.length > 0, "card bfi-2026: 节目变更分节摘要为空");
      ok(
        bfiCard.programmeChanges.sections.every((s) => !!s.title && s.entries > 0),
        "card bfi-2026: 变更分节摘要缺标题/条目数"
      );
      const bfiDetailPath = join(API, "festivals", "bfi-2026.json");
      ok(existsSync(bfiDetailPath), "detail bfi-2026 missing");
      if (existsSync(bfiDetailPath)) {
        const bd = readJson(bfiDetailPath);
        ok(!!bd.programmeChanges, "detail bfi-2026: 官方节目变更未随详情发布");
        ok(
          (bd.programmeChanges.sections || []).length === bfiCard.programmeChanges.sections.length,
          "detail bfi-2026: 详情与卡片的分节数不一致"
        );
        ok(
          (bd.programmeChanges.sections || []).every((s, i) => s.title === bfiCard.programmeChanges.sections[i].title),
          "detail bfi-2026: 详情与卡片的分节标题不一致"
        );
        // 票价贯通发布产物：详情每条必须带 minPrice（£ 原文或 null），并覆盖免费/非零两态
        ok(
          (bd.screenings || []).every((s) => s.minPrice === null || /^£\d/.test(s.minPrice)),
          "detail bfi-2026: minPrice 必须是官方 £ 原文或 null"
        );
        ok((bd.screenings || []).some((s) => s.minPrice === "£0.00"), "detail bfi-2026: 应含 £0.00（免费场次）");
        ok((bd.screenings || []).some((s) => s.minPrice && s.minPrice !== "£0.00"), "detail bfi-2026: 应含非零票价");
        // 今日卡片 items 也必须带票价（前端今日排片直接读卡片）
        const pricedCardItems = (bfiCard.today?.items || []).filter((i) => "minPrice" in i);
        ok(
          pricedCardItems.every((i) => i.minPrice === null || /^£\d/.test(i.minPrice)),
          "card bfi-2026: today.items minPrice 必须是官方 £ 原文或 null"
        );
      }
    }
  }
  for (const c of changes.changes || []) {
    ok(!!c.at && !!c.kind && !!c.label, `change ${c.id}: incomplete record`);
    ok(Array.isArray(c.fields) && c.fields.length > 0, `change ${c.id}: no field-level diff`);
    ok(c.fields.every((x) => "from" in x && "to" in x), `change ${c.id}: field missing old/new`);
    ok(!!(c.sourceUrl || c.sourceLabel), `change ${c.id}: no official source reference`);
  }

  await idfaAdapterChecks();
  await bfiAdapterChecks();

  console.log(`[verify] ${checks} assertions, ${errors.length} error(s), ${warnings.length} warning(s)`);
  if (warnings.length) warnings.slice(0, 10).forEach((w) => console.log(`  warn: ${w}`));
  if (errors.length) {
    errors.slice(0, 25).forEach((e) => console.error(`  ERR: ${e}`));
    process.exit(1);
  }
  console.log("[verify] published festival data is self-consistent ✓");
}

main().catch((e) => {
  console.error(`[verify] fatal: ${e?.stack || e}`);
  process.exit(1);
});
