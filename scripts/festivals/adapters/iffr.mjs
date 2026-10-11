#!/usr/bin/env node
/**
 * IFFR (International Film Festival Rotterdam) — Adapter
 *
 * 模式：授权 pending + 离线快照（默认不实时抓取；仅 --snapshot 可跑）
 * 契约：export async function fetchEdition({ festival, edition, fetchText, log, snapshotDir })
 *       export const meta = { id, officialHost, entryPages, offlineSnapshots }
 *
 * 数据源：IFFR 官方静态 JSON feed
 *   https://iffr.com/en/wp-content/uploads/sites/2/static-files/iffr-2026.json
 *   结构：data.edition.items.nodes（632 节点）
 *
 * 过滤规则：film ⇔ lengthInMinutes != null
 *   该 feed 中 events（活动）不含 lengthInMinutes；按 isEvent 判定不可靠（三态且有交叠）。
 *
 * programme-only：feed 不含任何场次/时间/场馆 → 只产出影片元数据（无 SCREENING）。
 *   因此 edition.coverageMinDays 必须为 0（否则会被 ceil(dayCount/2) 校验拒绝），
 *   且本适配器绝不发出 kind === "SCHEDULE" 的 source（validate 对失败 SCHEDULE 源硬拒）。
 *
 * 合规：iffr.com/en/disclaimer 明文禁止未经书面许可复制/再发布网站内容；
 *   故 authorization = pending，raw feed 不入库（gitignore），仅由离线快照生成产物。
 */

import { nowIso, clean } from "../lib.mjs";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const meta = {
  id: "iffr",
  officialHost: "iffr.com",
  entryPages: ["https://iffr.com/en/iffr/2026/films"],
  offlineSnapshots: true,
};

const FEED_URL =
  "https://iffr.com/en/wp-content/uploads/sites/2/static-files/iffr-2026.json";
const OFFICIAL_SITE = "https://iffr.com/en/iffr/2026";
const SNAPSHOT_FILE = "iffr-2026.json";

function readSnapshotFile(snapshotDir, name) {
  const p = join(snapshotDir, name);
  if (!existsSync(p)) return null;
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

/** feed → film 节点数组（film ⇔ lengthInMinutes != null） */
function parseFeed(body) {
  const json = JSON.parse(body);
  const nodes = json?.data?.edition?.items?.nodes || [];
  const out = [];
  for (const n of nodes) {
    if (n && n.lengthInMinutes != null) out.push(n);
  }
  return out;
}

function firstSection(node) {
  const nodes = node?.sections?.nodes;
  return Array.isArray(nodes) && nodes.length ? nodes[0] : null;
}

function directorsOf(node) {
  return (node?.credits || [])
    .map((c) => c?.director?.fullname)
    .filter(Boolean)
    .join(", ");
}

function countriesOf(node) {
  return (node?.countries?.nodes || [])
    .map((c) => c?.name)
    .filter(Boolean)
    .join(", ");
}

/** IFFR feed 节点 → normalize 期望的 film 记录 */
function mapFilm(node, i) {
  const section = firstSection(node);
  const synopsis = clean(node?.excerpt || node?.extendedDescription || "");
  const minutes = node?.lengthInMinutes;
  return {
    idx: i + 1,
    cIdx: section?.id ?? null,
    title: clean(node?.title) || node?.slug || null,
    director: directorsOf(node) || null,
    country: countriesOf(node) || null,
    sectionName: section?.name || null,
    officialUrl: node?.link || null,
    // 扩展字段（normalize 仅在存在时落键）
    synopsis: synopsis || null,
    runtime: minutes != null ? `${minutes} min` : null,
  };
}

export async function fetchEdition({ festival, edition, fetchText, log = () => {}, snapshotDir } = {}) {
  const SNAPSHOT = !!snapshotDir;
  const fetchedAt = nowIso();
  const warnings = [];
  const sources = [];

  let body = "";
  let httpStatus = 200;

  if (SNAPSHOT) {
    const snap = readSnapshotFile(snapshotDir, SNAPSHOT_FILE);
    if (snap) {
      body = snap;
    } else {
      sources.push({
        kind: "PROGRAMME",
        label: "Official IFFR film catalogue (static JSON feed)",
        url: FEED_URL,
        httpStatus: 0,
        ok: false,
        fetchedAt,
      });
      return {
        items: [],
        films: [],
        sections: [],
        sources,
        days: [],
        warnings: [`snapshot missing: ${SNAPSHOT_FILE}`],
        fetchedAt,
      };
    }
  } else {
    log(`[iffr] feed: ${FEED_URL}`);
    const res = await fetchText(FEED_URL, { label: "iffr-feed" });
    body = res.body || "";
    httpStatus = res.status || 200;
    if (!res.ok) warnings.push(`feed fetch failed: ${res.error || res.status}`);
  }

  let rawFilms = [];
  try {
    rawFilms = parseFeed(body);
  } catch (e) {
    warnings.push(`feed parse failed: ${e?.message || e}`);
  }
  log(`[iffr] feed parsed: ${rawFilms.length} films (of 632 nodes)`);

  if (!rawFilms.length) {
    // 无影片 → 视为抓取/解析异常，抛错以保留旧数据（绝不发布空节目单）
    throw new Error(`iffr feed yielded 0 films (parse warnings: ${warnings.join("; ") || "none"})`);
  }

  const films = rawFilms.map(mapFilm);

  const sectionSet = new Map();
  for (const f of films) {
    if (f.cIdx != null && !sectionSet.has(f.cIdx)) sectionSet.set(f.cIdx, f.sectionName);
  }
  const sections = [...sectionSet].map(([cIdx, name]) => ({ cIdx, name }));

  sources.push({
    kind: "PROGRAMME",
    label: "Official IFFR film catalogue (static JSON feed)",
    url: FEED_URL,
    httpStatus,
    ok: true,
    fetchedAt,
  });
  sources.push({
    kind: "OFFICIAL_SITE",
    label: "IFFR official site",
    url: OFFICIAL_SITE,
    httpStatus: null,
    ok: true,
    fetchedAt,
  });

  log(`[iffr] total: ${films.length} films, ${sections.length} sections (programme-only)`);

  return {
    items: [], // programme-only：feed 无场次
    films,
    sections,
    sources,
    days: [],
    warnings,
    fetchedAt,
    notes: {
      programmeOnly: true,
      films: films.length,
      sections: sections.length,
      via: SNAPSHOT ? "offline snapshot" : "live feed",
    },
  };
}
