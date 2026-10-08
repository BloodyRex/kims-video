#!/usr/bin/env node
/**
 * BIFF 适配器 —— 只解析电影节官方英文站
 *   官方全片单 : /eng/html/program/prog_all_list.asp?allYear=YYYY   （片名/导演/制片国家/单元）
 *   官方排片表 : /eng/html/schedule/date.asp?day1=N                 （日期/时间/影厅/分级/字幕/GV/场次号）
 *
 * 排片页的每个时间槽分三类，均如实保留（不丢数据、不猜测）：
 *   SCREENING — 链接到 prog_view.asp（正式影片场次）
 *   EVENT     — 链接到 /eng/addon/…/page.asp（大师班 / 特别对谈 / Cine Class / Actors' House 等）
 *   TBA       — 官方只有标题、暂无链接（如「各奖项得主放映」、闭幕式）
 *
 * 事实（日期、时间、影厅、场次号、分级、GV）100% 来自官方页面；本文件不做任何推断或 AI 补全。
 */

import { clean, addDays, parseScheduleHeading, daysBetween } from "../lib.mjs";

const HOST = "https://www.biff.kr";
const PROG_URL = (year) => `${HOST}/eng/html/program/prog_all_list.asp?allYear=${year}`;
const DAY_URL = (n) => `${HOST}/eng/html/schedule/date.asp?day1=${n}`;
/** 官方排片页自身脚本就用 sdCode 拼购票深链：//biff.maketicket.co.kr/BIFF/en/resMain?sdCode=NNN */
const TICKET_URL = (code) => `https://biff.maketicket.co.kr/BIFF/en/resMain?sdCode=${code}`;

/** 分级图标 → 观众分级 */
function parseGrade(slot) {
  for (const hit of slot.match(/ico_grade ico_([a-z0-9]+)/g) || []) {
    const code = hit.split("ico_").pop();
    if (code === "g" || code === "all") return "ALL";
    if (["12", "15", "19"].includes(code)) return code;
  }
  return null;
}

function parseSubtitle(slot) {
  const m = slot.match(/ico_grade ico_(ke|kk|kn)\b/);
  return m ? m[1].toUpperCase() : null;
}

function absolute(href) {
  if (!href) return null;
  if (/^https?:/i.test(href)) return href;
  return HOST + (href.startsWith("/") ? "" : "/") + href;
}

/** 官方全片单 → 影片（含所属单元） */
export function parseProgramme(html) {
  const films = [];
  const parts = String(html).split('<div class="list_sec">').slice(1);
  for (const part of parts) {
    const nameM = part.match(/<h3>\s*<strong>\s*([\s\S]*?)\s*<\/strong>/);
    const sectionName = nameM ? clean(nameM[1]) : null;
    const rows = part.match(/<tr class="href_view"[\s\S]*?<\/tr>/g) || [];
    for (const row of rows) {
      const link = row.match(/prog_view\.asp\?idx=(\d+)[^'"]*?c_idx=(\d+)/);
      const titleM = row.match(/<b[^>]*>([\s\S]*?)<\/b>/);
      if (!link || !titleM) continue;
      const directorM = row.match(/<td class="director"[^>]*>([\s\S]*?)<\/td>/);
      const countryM = row.match(/<td class="country"[^>]*>([\s\S]*?)<\/td>/);
      films.push({
        idx: Number(link[1]),
        cIdx: Number(link[2]),
        title: clean(titleM[1]),
        director: directorM ? clean(directorM[1]) : null,
        country: countryM ? clean(countryM[1]) : null,
        sectionName,
        officialUrl: `${HOST}/eng/html/program/prog_view.asp?idx=${link[1]}&c_idx=${link[2]}&QueryStep=2`,
      });
    }
  }
  return { films };
}

/** 单个时间槽 → 一条排片事实（无时间则返回 null） */
function parseSlot(slot, sourceUrl) {
  const timeM = slot.match(/<p class="time en">\s*(\d{1,2}:\d{2})/);
  if (!timeM) return null;
  const codeM = slot.match(/data-scode="(\d+)"/);
  const hrefM = slot.match(/href\s*=\s*["']?([^"'\s>]+)/);
  const href = hrefM ? hrefM[1] : null;
  const titleM =
    slot.match(/<span class="film_tit_kor">([\s\S]*?)<\/span>/) ||
    slot.match(/<div class="film_tit">[\s\S]*?<div>([\s\S]*?)<\/div>/);
  const title = titleM ? clean(titleM[1]) : null;

  let kind = "TBA";
  let filmIdx = null;
  let cIdx = null;
  let eventUrl = null;
  if (href && /prog_view\.asp/i.test(href)) {
    const idxM = href.match(/idx=(\d+)/);
    const cM = href.match(/c_idx=(\d+)/);
    if (idxM) {
      kind = "SCREENING";
      filmIdx = Number(idxM[1]);
      cIdx = cM ? Number(cM[1]) : null;
    }
  } else if (href && /\/addon\//i.test(href)) {
    kind = "EVENT";
    eventUrl = absolute(href);
  }

  const code = codeM ? codeM[1] : null;
  return {
    kind,
    filmIdx,
    cIdx,
    title,
    localTime: timeM[1].padStart(5, "0"),
    code,
    grade: parseGrade(slot),
    subtitle: parseSubtitle(slot),
    qa: /ico_grade ico_gv/.test(slot),
    ticketUrl: code ? TICKET_URL(code) : null,
    eventUrl,
    officialSourceUrl: sourceUrl,
  };
}

/**
 * 影厅名归一化（仅格式清洗，绝不改写官方用词）
 * 官方页面把影厅与楼栋/楼层写在同一字符串里，例如
 *   "Culture Hall(9F), Shinsegae Centum City"（括号前缺空格）
 *   "Book Cafe Lounge, 4F, DSU-KIT Centum Campus"（逗号后已带空格）
 * 这里只做：压缩空白 → 逗号后统一一个空格 → 括号前统一一个空格。
 * 官方原始name、影厅数量、顺序都不受影响。
 */
export function normalizeVenueName(raw) {
  return clean(raw)
    .replace(/\s*,\s*/g, ", ")
    .replace(/(?<=[^\s(])\(/g, " (")
    .replace(/\(\s+/g, "(")
    .trim();
}

/** 官方单日排片页 → 影厅块 + 排片条目 */
export function parseDay(html, sourceUrl) {
  const text = String(html);
  const headM = text.match(/<h3 class="tit_schedule">([\s\S]*?)<\/h3>/);
  const heading = headM ? clean(headM[1]) : null;
  const start = text.indexOf('class="tbl_schedule');
  if (start < 0) return { heading, venues: [] };
  const chunks = text.slice(start).split('<div class="sch_li"');
  const venues = [];
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    const venueM = chunk.match(/<div class="sch_li_tit">([\s\S]*?)<\/div>/);
    if (!venueM) continue;
    const venueName = normalizeVenueName(venueM[1]);
    if (!venueName) continue;
    const slots = chunk.split('<div class="sch_it ').slice(1);
    const items = [];
    for (const slot of slots) {
      const parsed = parseSlot(slot, sourceUrl);
      if (parsed) items.push(parsed);
    }
    if (items.length) venues.push({ name: venueName, items });
  }
  return { heading, venues };
}

/**
 * 抓取一个届次 → 原始（未标准化）数据
 */
export async function fetchEdition({ festival, edition, fetchText, log = () => {} }) {
  const year = edition.year;
  const warnings = [];
  const sources = [];
  const fetchedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  // ── 1) 官方全片单 ──
  const progUrl = PROG_URL(year);
  log(`[biff] programme: ${progUrl}`);
  const progRes = await fetchText(progUrl, { label: "programme" });
  sources.push({
    kind: "PROGRAMME",
    label: "Official programme (all films)",
    url: progUrl,
    httpStatus: progRes.status || null,
    ok: progRes.ok,
    fetchedAt,
  });
  let films = [];
  if (progRes.ok) {
    films = parseProgramme(progRes.body).films;
    log(`[biff] films parsed: ${films.length}`);
    if (!films.length) warnings.push("programme page parsed 0 films");
  } else {
    warnings.push(`programme fetch failed: ${progRes.error}`);
  }

  // ── 2) 官方按日排片 ──
  const dayCount = daysBetween(edition.startDate, edition.endDate) + 1;
  const tabStart = Number.isFinite(edition.dateTabStart) ? edition.dateTabStart : 1;
  const days = [];
  const allItems = [];
  for (let i = 0; i < dayCount; i++) {
    const tab = tabStart + i;
    const url = DAY_URL(tab);
    log(`[biff] schedule ← day1=${tab}`);
    const res = await fetchText(url, { label: `day1=${tab}` });
    sources.push({
      kind: "SCHEDULE",
      label: `Official schedule — day1=${tab}`,
      url,
      httpStatus: res.status || null,
      ok: res.ok,
      fetchedAt,
    });
    if (!res.ok) {
      warnings.push(`schedule day1=${tab} failed: ${res.error}`);
      continue;
    }
    const parsed = parseDay(res.body, url);
    // 日期以官方页面标题为准（OCT 8 (THU)），无法解析才退回 startDate + i
    const h = parseScheduleHeading(parsed.heading);
    let date = addDays(edition.startDate, i);
    if (h) {
      const fromHeading = `${year}-${String(h.month).padStart(2, "0")}-${String(h.day).padStart(2, "0")}`;
      if (fromHeading !== date) {
        warnings.push(`day1=${tab} heading date ${fromHeading} != computed ${date} (using heading)`);
        date = fromHeading;
      }
    } else {
      warnings.push(`day1=${tab} heading not parsed (${parsed.heading || "missing"})`);
    }
    let count = 0;
    for (const v of parsed.venues) {
      for (const item of v.items) {
        allItems.push({ ...item, date, venueName: v.name });
        count++;
      }
    }
    days.push({
      date,
      tab,
      sourceUrl: url,
      heading: parsed.heading,
      venues: parsed.venues.length,
      items: count,
    });
    log(`[biff]   ${date}: ${count} entries / ${parsed.venues.length} venues`);
  }

  // 单元：c_idx → 名称（来自官方片单）
  const sectionMap = new Map();
  for (const f of films) {
    if (f.cIdx && !sectionMap.has(f.cIdx)) sectionMap.set(f.cIdx, f.sectionName || null);
  }

  return {
    items: allItems,
    films,
    sections: [...sectionMap].map(([cIdx, name]) => ({ cIdx, name })),
    sources,
    days,
    warnings,
    fetchedAt,
  };
}

export const meta = {
  id: "biff",
  officialHost: HOST,
  entryPages: ["prog_all_list.asp", "schedule/date.asp"],
};
