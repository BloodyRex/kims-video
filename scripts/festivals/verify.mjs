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

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as idfa from "./adapters/idfa.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const API = join(ROOT, "public", "api");

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

  for (const c of changes.changes || []) {
    ok(!!c.at && !!c.kind && !!c.label, `change ${c.id}: incomplete record`);
    ok(Array.isArray(c.fields) && c.fields.length > 0, `change ${c.id}: no field-level diff`);
    ok(c.fields.every((x) => "from" in x && "to" in x), `change ${c.id}: field missing old/new`);
    ok(!!(c.sourceUrl || c.sourceLabel), `change ${c.id}: no official source reference`);
  }

  await idfaAdapterChecks();

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
