#!/usr/bin/env node
/**
 * Change Detection —— 与上一份快照比对，产出可追溯的变更记录
 * 记录 old value / new value / changed at / official source，永不覆盖历史。
 */

const WATCHED = ["kind", "title", "date", "localTime", "venueName", "code", "grade", "subtitle", "qa", "ticketStatus", "filmId", "ticketUrl", "eventUrl"];

const fieldLabel = {
  kind: "条目类型",
  title: "片名 / 活动名",
  date: "日期",
  localTime: "放映时间",
  venueName: "影厅",
  code: "场次号",
  grade: "观众分级",
  subtitle: "字幕",
  qa: "影人问答",
  ticketStatus: "售票状态",
  filmId: "影片",
  ticketUrl: "购票链接",
  eventUrl: "活动页",
  status: "届次状态",
  httpStatus: "官方来源可访问性",
};

const KIND_ZH = { SCREENING: "影片场次", EVENT: "特别活动", TBA: "待定" };

function label(s) {
  return `${s.title || s.filmId || "?"} — ${s.date} ${s.localTime} · ${s.venueName}`;
}

export function detectChanges(prev, next, { at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z"), siteLabel = null } = {}) {
  const changes = [];
  const base = (kind, entity, ref, text, fields, sourceUrl) => ({
    id: `${next.slug}-${kind}-${entity}-${ref}-${at}`,
    at,
    slug: next.slug,
    festivalId: next.festivalId,
    kind,
    entity,
    ref,
    label: text,
    fields: fields.map((f) => ({ ...f, fieldLabel: fieldLabel[f.field] || f.field })),
    sourceUrl: sourceUrl || next.edition?.officialUrl || null,
    sourceLabel: siteLabel,
  });

  if (!prev) {
    return [
      base(
        "INIT",
        "EDITION",
        next.slug,
        `${next.festival.name.en} ${next.edition.year}`,
        [
          { field: "entries", from: null, to: String(next.stats.entries) },
          { field: "films", from: null, to: String(next.stats.films) },
        ],
        next.edition?.officialUrl
      ),
    ];
  }

  const prevById = new Map((prev.screenings || []).map((s) => [s.id, s]));
  const nextById = new Map((next.screenings || []).map((s) => [s.id, s]));
  const prevFilm = new Map((prev.films || []).map((f) => [f.id, f.title]));
  const nextFilm = new Map((next.films || []).map((f) => [f.id, f.title]));
  const filmName = (id) => prevFilm.get(id) || nextFilm.get(id) || id;

  for (const [id, s] of nextById) {
    const old = prevById.get(id);
    if (!old) {
      changes.push(
        base(
          "ADDED",
          s.kind === "SCREENING" ? "SCREENING" : "EVENT",
          id,
          label(s),
          [{ field: "localTime", from: null, to: s.localTime }],
          s.officialSourceUrl
        )
      );
      continue;
    }
    const diff = [];
    for (const f of WATCHED) {
      const a = old[f];
      const b = s[f];
      if (String(a ?? "") === String(b ?? "")) continue;
      if (f === "filmId") diff.push({ field: f, from: a ? filmName(a) : null, to: b ? filmName(b) : null });
      else if (f === "kind") diff.push({ field: f, from: KIND_ZH[a] || a || null, to: KIND_ZH[b] || b || null });
      else diff.push({ field: f, from: a ?? null, to: b ?? null });
    }
    if (diff.length) changes.push(base("CHANGED", "SCREENING", id, label(s), diff, s.officialSourceUrl));
  }

  for (const [id, s] of prevById) {
    if (nextById.has(id)) continue;
    changes.push(
      base(
        "REMOVED",
        s.kind === "SCREENING" ? "SCREENING" : "EVENT",
        id,
        label(s),
        [{ field: "localTime", from: s.localTime, to: null }],
        s.officialSourceUrl
      )
    );
  }

  for (const f of next.films || []) {
    if (!prevFilm.has(f.id))
      changes.push(base("ADDED", "FILM", f.id, f.title, [{ field: "title", from: null, to: f.title }], f.officialUrl));
  }
  for (const f of prev.films || []) {
    if (!nextFilm.has(f.id))
      changes.push(base("REMOVED", "FILM", f.id, f.title, [{ field: "title", from: f.title, to: null }], f.officialUrl));
  }

  if (prev.status !== next.status) {
    changes.push(
      base(
        "STATUS",
        "EDITION",
        next.slug,
        `${next.festival.name.en} ${next.edition.year}`,
        [{ field: "status", from: prev.status, to: next.status }],
        next.edition?.officialUrl
      )
    );
  }

  const prevSrc = new Map((prev.sources || []).map((s) => [s.url, s]));
  for (const s of next.sources || []) {
    const old = prevSrc.get(s.url);
    if (old && !!old.ok !== !!s.ok) {
      changes.push(
        base("CHANGED", "SOURCE", s.url, s.label || s.url, [
          { field: "httpStatus", from: old.httpStatus ?? null, to: s.httpStatus ?? null },
        ], s.url)
      );
    }
  }

  return changes;
}

/** 变更暴涨时收敛记录（避免一次改版写入上千条），但保留摘要与计数。 */
export function summarize(changes, limit = 200) {
  if (changes.length <= limit) return { changes, collapsed: 0 };
  const head = changes.slice(0, limit);
  const rest = changes.slice(limit);
  const byKind = {};
  for (const c of rest) byKind[c.kind] = (byKind[c.kind] || 0) + 1;
  return {
    changes: [
      ...head,
      {
        id: `collapsed-${Date.now()}`,
        at: rest[0].at,
        slug: rest[0].slug,
        festivalId: rest[0].festivalId,
        kind: "SUMMARY",
        entity: "EDITION",
        ref: rest[0].slug,
        label: `另有 ${rest.length} 条变更未逐条列出`,
        fields: Object.entries(byKind).map(([k, v]) => ({
          field: k,
          from: null,
          to: String(v),
          fieldLabel: `变更类型 ${k}`,
        })),
        sourceUrl: rest[0].sourceUrl,
      },
    ],
    collapsed: rest.length,
  };
}
