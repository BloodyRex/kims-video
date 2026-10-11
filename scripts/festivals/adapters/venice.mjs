#!/usr/bin/env node
/**
 * Venice Film Festival (La Biennale di Venezia) — Adapter
 * 模式：授权 pending + 离线快照（默认不实时抓取；仅 --snapshot 可跑）
 * 契约：export async function fetchEdition({ festival, edition, fetchText, log, snapshotDir })
 *       export const meta = { id, officialHost, entryPages, offlineSnapshots }
 */

import { slugify } from "../lib.mjs";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function readSnapshot(dir, key) {
  const p = join(dir, `${key}.html`);
  if (!existsSync(p)) return null;
  try {
    return { path: p, body: readFileSync(p, "utf8") };
  } catch {
    return null;
  }
}

export const meta = {
  id: "venice",
  officialHost: "labiennale.org",
  entryPages: [
    "https://www.labiennale.org/en/cinema/2026/program-cinema-2026-public",
    "https://www.labiennale.org/en/cinema/2026/lineup",
  ],
  offlineSnapshots: true,
};

const BASE = "https://www.labiennale.org";

function clean(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function parseTime(t) {
  const m = String(t || "").match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

function dateFromPermalink(permalink) {
  const m = permalink.match(/date=(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function permalinkForDate(date) {
  return `${BASE}/en/cinema/2026/program-cinema-2026-public?date=${date}`;
}

function extractDayLinks(html) {
  const urls = new Set();
  const re = /href="([^"]*program-cinema-2026-public\?date=\d{4}-\d{2}-\d{2})"/g;
  let m;
  while ((m = re.exec(html))) urls.add(m[1]);
  return [...urls].sort();
}

function parseDayHtml(html, { permalink, sourceUrl, warn }) {
  const items = [];
  const blocks = html.split(/(?=<div[^>]*class="[^"]*lb-agenda-item[^"]*")/);
  for (const block of blocks) {
    if (!block.includes('class="lb-agenda-item')) continue;

    const timeMatch = block.match(/<time datetime="(\d{2}:\d{2})"/);
    const localTime = timeMatch ? timeMatch[1] : null;

    const titleMatch = block.match(/<div[^>]*class="[^"]*lb-title[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const rawTitle = titleMatch ? titleMatch[1] : "";
    const title = clean(rawTitle.replace(/<[^>]+>/g, ""));

    const exceptMatch = block.match(/<div[^>]*class="[^"]*lb-except[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    let director = null;
    let section = null;
    if (exceptMatch) {
      const exc = exceptMatch[1];
      // Directors: every <strong>…</strong> that follows "by"
      const dirs = [...exc.matchAll(/<strong>([^<]+)<\/strong>/g)].map((m) => clean(m[1])).filter(Boolean);
      if (dirs.length) director = dirs.join(", ");
      // Section: text after the LAST </strong> (strip <br> tags & whitespace)
      const tail = exc.split(/<\/strong>/).pop() || "";
      const secName = clean(tail.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "));
      if (secName) section = secName;
    }

    const detailMatch = block.match(/<a href="(\/en\/cinema\/2026\/[^"]*)"[^>]*class="[^"]*lb-cta-arrow-2/);
    const detailHref = detailMatch ? detailMatch[1] : null;

    const venueMatch = block.match(/icon-map[^>]*><\/i>\s*<p>(.*?)<\/p>/);
    const venueName = venueMatch ? clean(venueMatch[1]) : null;

    const ticketMatch = block.match(/icon-ticket[^>]*><\/i>\s*<p>(.*?)<\/p>/);
    const ticketStatus = ticketMatch ? clean(ticketMatch[1]) : null;

    if (!title || !localTime || !venueName) {
      warn?.(`[venice] skip row: missing title/time/venue`);
      continue;
    }

    let code = null;
    if (detailHref) {
      const slug = detailHref.split("/").pop();
      if (slug) code = slug;
    }
    if (!code) {
      code = `fb-${slugify(venueName)}-${localTime.replace(":", "")}`;
    }

    items.push({
      title,
      localTime,
      venueName,
      director,
      section,
      detailHref,
      ticketStatus,
      code,
      sourceUrl: detailHref ? BASE + detailHref : sourceUrl,
    });
  }
  return items;
}

function parseFilmDetail(html) {
  const data = {};
  const rows = html.match(/<tr>[\s\S]*?<\/tr>/g) || [];
  for (const row of rows) {
    const th = row.match(/<th[^>]*>(.*?)<\/th>/);
    const td = row.match(/<td[^>]*>(.*?)<\/td>/);
    if (th && td) {
      const key = clean(th[1]).toLowerCase();
      const val = clean(td[1].replace(/<[^>]+>/g, ""));
      if (key.includes("director")) data.director = val;
      else if (key.includes("production")) data.production = val;
      else if (key.includes("runtime")) data.runtime = val;
      else if (key.includes("language")) data.language = val;
      else if (key.includes("country")) data.country = val;
      else if (key.includes("cast")) data.cast = val;
      else if (key.includes("screenplay")) data.screenplay = val;
    }
  }
  const synopsisMatch = html.match(/<h2[^>]*>Synopsis<\/h2>[\s\S]*?<p>([\s\S]*?)<\/p>/);
  if (synopsisMatch) data.synopsis = clean(synopsisMatch[1]);
  return data;
}

function parseSectionFilmPage(html) {
  const data = {};
  // Match the section page film list: node-film node-teaser with lb-item-title and lb-description
  const synopsisMatch = html.match(/<h2[^>]*>Synopsis<\/h2>[\s\S]*?<div class="lb-description">([\s\S]*?)<\/div>/);
  if (synopsisMatch) data.synopsis = clean(synopsisMatch[1].replace(/<[^>]+>/g, ""));
  return data;
}

function parseSectionFilms(html) {
  // Parse films from a section page (e.g., competition page).
  // Description format: "Director <strong>Names</strong><br>[Main Cast … / ]Country / Runtime’"
  // Returns array of { slug, title, director, country, runtime, detailHref }
  const films = [];
  const blocks = html.split(/(?=<article[^>]*class="[^"]*node-film node-teaser[^"]*")/);
  for (const block of blocks) {
    if (!block.includes("node-film node-teaser")) continue;

    const hrefMatch = block.match(/<a href="(\/en\/cinema\/2026\/[^"]*)"[^>]*class="[^"]*lb-entry-link/);
    const titleMatch = block.match(/<div[^>]*class="[^"]*lb-item-title[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const descMatch = block.match(/<div[^>]*class="[^"]*lb-description[^"]*"[^>]*>([\s\S]*?)<\/div>/);

    if (!hrefMatch || !titleMatch) continue;

    const slug = hrefMatch[1].split("/").pop();
    const title = clean(titleMatch[1].replace(/<[^>]+>/g, ""));

    let director = null;
    let country = null;
    let runtime = null;

    if (descMatch) {
      let desc = descMatch[1].replace(/&nbsp;/g, " ").replace(/<br\s*\/?>/gi, " ");
      const dirMatch = desc.match(/Director\s*<strong[^>]*>([^<]*)<\/strong>/i);
      if (dirMatch) director = clean(dirMatch[1]);

      // Everything after the last </strong>: "[Main Cast … / ]Country / Runtime’"
      const tail = desc.split(/<\/strong>/).pop() || "";
      const parts = tail
        .split("/")
        .map((s) => clean(s.replace(/<[^>]+>/g, " ")))
        .filter(Boolean);
      if (parts.length >= 2) {
        runtime = parts[parts.length - 1];
        country = parts[parts.length - 2];
        // If the penultimate part still contains "Main Cast", the country list is the real country
        if (/main cast/i.test(country)) country = parts.length >= 3 ? parts[parts.length - 3] : null;
      }
    }

    films.push({ slug, title, director, country, runtime, detailHref: hrefMatch[1] });
  }
  return films;
}

function parseLineup(html) {
  const sections = [];
  // Match node-film-categoria items with lb-entry-link and lb-title (classes may have multiple values)
  const blocks = html.split(/(?=<article[^>]*class="[^"]*node-film-categoria[^"]*")/);
  for (const block of blocks) {
    if (!block.includes('node-film-categoria')) continue;
    
    const hrefMatch = block.match(/<a href="(\/en\/cinema\/2026\/[^"]*)"[^>]*class="[^"]*lb-entry-link/);
    const titleMatch = block.match(/<div[^>]*class="[^"]*lb-title[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    
    if (hrefMatch && titleMatch) {
      const slug = hrefMatch[1].split("/").pop();
      sections.push({ slug, name: clean(titleMatch[1].replace(/<[^>]+>/g, "")) });
    }
  }
  return sections;
}

export async function fetchEdition({ festival, edition, fetchText, log = () => {}, snapshotDir } = {}) {
  const SNAPSHOT = !!snapshotDir;
  const sources = [];
  const items = [];
  const films = [];
  const sections = [];
  const days = [];
  const warnings = [];
  const filmByCode = new Map();
  const sectionBySlug = new Map();
  const sectionByName = new Map();
  let filmIdx = 0;
  let sectionIdx = 0;

  const warn = (msg) => { warnings.push(msg); log(`[venice] ${msg}`); };

  // Read lineup page (for sections)
  let lineupHtml = "";
  let lineupUrl = `${BASE}/en/cinema/2026/lineup`;
  if (SNAPSHOT) {
    const snap = readSnapshot(snapshotDir, "lineup");
    if (snap) { lineupHtml = snap.body; lineupUrl = snap.url; }
  }
  if (!lineupHtml) {
    try {
      const res = await fetchText(lineupUrl, { label: "lineup" });
      if (res.ok) lineupHtml = res.body;
      sources.push({ kind: "PROGRAMME", label: "Official lineup", url: lineupUrl, httpStatus: res.status, ok: res.ok, fetchedAt: new Date().toISOString() });
    } catch (e) {
      warn(`lineup fetch failed: ${e.message}`);
      sources.push({ kind: "PROGRAMME", label: "Official lineup", url: lineupUrl, httpStatus: 0, ok: false, fetchedAt: new Date().toISOString() });
    }
  }
  if (lineupHtml) {
    const secs = parseLineup(lineupHtml);
    for (const s of secs) {
      sectionIdx++;
      const sec = { idx: sectionIdx, cIdx: sectionIdx, name: s.name, slug: s.slug };
      sections.push(sec);
      sectionBySlug.set(s.slug, sec);
      if (s.name) sectionByName.set(s.name.toLowerCase(), sec);
    }
    log(`[venice] lineup: ${sections.length} sections`);
  }

  // Resolve a section name (from a day page) to a known lineup section.
  // 1) exact slug, 2) exact name, 3) fuzzy token-overlap (handles "Out of Competition" vs "Out-competition").
  const resolveSection = (name) => {
    if (!name) return null;
    const direct = sectionBySlug.get(slugify(name)) || sectionByName.get(String(name).toLowerCase());
    if (direct) return direct;
    const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean)
      .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
    const a = new Set(norm(name));
    let best = null;
    let bestScore = 0;
    for (const sec of sections) {
      const b = new Set(norm(sec.name));
      const shared = [...a].filter((t) => b.has(t)).length;
      const score = shared / Math.max(a.size, b.size);
      if (score > bestScore) { bestScore = score; best = sec; }
    }
    return bestScore >= 0.6 ? best : null;
  };

  // Determine day URLs from lineup or edition dates
  const dayUrls = [];
  if (lineupHtml) {
    const links = extractDayLinks(lineupHtml);
    dayUrls.push(...links.map(u => BASE + u));
  }
  if (dayUrls.length === 0) {
    // Fallback: generate from edition date range
    const start = new Date(edition.startDate);
    const end = new Date(edition.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      dayUrls.push(permalinkForDate(iso));
    }
  }

  // Fetch/read each day page
  for (const dayUrl of dayUrls) {
    const date = dateFromPermalink(dayUrl) || dayUrl.split("date=")[1]?.slice(0, 10);
    if (!date) continue;

    let html = "";
    let httpStatus = 200;
    let ok = true;
    let via = "snapshot";

    if (SNAPSHOT) {
      const key = `day-${date}`;
      const snap = readSnapshot(snapshotDir, key);
      if (snap) { html = snap.body; httpStatus = snap.status || 200; }
      else { ok = false; via = "missing-snapshot"; }
    } else {
      try {
        const res = await fetchText(dayUrl, { label: `schedule-${date}` });
        html = res.body || "";
        httpStatus = res.status || 200;
        ok = res.ok === true;
        via = "live";
      } catch (e) {
        ok = false;
        httpStatus = 0;
        warn(`day ${date} fetch failed: ${e.message}`);
      }
    }

    sources.push({
      kind: "SCHEDULE",
      label: via === "snapshot" ? `Official schedule (offline snapshot) — ${dayUrl}` : `Official schedule — ${dayUrl}`,
      url: dayUrl,
      httpStatus,
      ok,
      fetchedAt: new Date().toISOString(),
    });

    const day = { date, permalink: dayUrl, sourceUrl: dayUrl, via, ok, items: 0, venues: 0 };
    if (ok && html) {
      const parsed = parseDayHtml(html, { permalink: dayUrl, sourceUrl: dayUrl, warn });
      day.items = parsed.length;
      day.venues = new Set(parsed.map(p => p.venueName)).size;

      for (const p of parsed) {
        let film = filmByCode.get(p.code);
        if (!film) {
          filmIdx++;
          film = {
            idx: filmIdx,
            cIdx: resolveSection(p.section)?.cIdx || null,
            title: p.title,
            director: p.director,
            country: null,
            sectionName: p.section || null,
            officialUrl: p.detailHref ? BASE + p.detailHref : p.sourceUrl,
          };
          filmByCode.set(p.code, film);
          films.push(film);
        }

        const kind = film.director ? "SCREENING" : "TBA";
        items.push({
          kind,
          filmIdx: film.idx,
          cIdx: film.cIdx,
          title: p.title,
          localTime: p.localTime,
          code: p.code,
          grade: null,
          subtitle: null,
          qa: false,
          ticketStatus: p.ticketStatus,
          ticketUrl: null,
          eventUrl: null,
          officialSourceUrl: p.detailHref ? BASE + p.detailHref : dayUrl,
          date,
          venueName: p.venueName,
        });
      }
    }
    days.push(day);
    log(`[venice] ${date}: ${day.items} items, ${day.venues} venues (${via})`);
  }

  // Parse section pages to enrich films with director/country/runtime
  if (SNAPSHOT) {
    for (const sec of sections) {
      const key = `section-${sec.slug}`;
      const snap = readSnapshot(snapshotDir, key);
      if (snap && snap.body) {
        const sectionFilms = parseSectionFilms(snap.body);
        for (const sf of sectionFilms) {
          // Find matching film by title or slug
          let film = films.find(f => f.title === sf.title || f.officialUrl?.includes(sf.slug));
          if (!film && sf.detailHref) {
            film = filmByCode.get(sf.slug);
          }
          if (film) {
            if (sf.director) film.director = sf.director;
            if (sf.country) film.country = sf.country;
            if (sf.runtime) film.runtime = sf.runtime;
            if (sf.detailHref) film.officialUrl = BASE + sf.detailHref;
          }
        }
      }
    }
  }

  // Enrich films with synopsis from section film pages (for films missing synopsis)
  if (SNAPSHOT) {
    for (const film of films) {
      if (film.officialUrl && !film.synopsis) {
        const sectionSlug = film.sectionName ? slugify(film.sectionName) : null;
        const filmSlug = film.officialUrl.split("/").pop();
        if (sectionSlug && filmSlug) {
          const key = `section-${sectionSlug}-${filmSlug}`;
          const snap = readSnapshot(snapshotDir, key);
          if (snap && snap.body) {
            const enriched = parseSectionFilmPage(snap.body);
            if (enriched.synopsis) film.synopsis = enriched.synopsis;
          }
        }
      }
    }
  }

  log(`[venice] total: ${items.length} items, ${films.length} films, ${sections.length} sections, ${days.length} days`);

  return {
    items,
    films,
    sections,
    sources,
    days,
    warnings,
    fetchedAt: new Date().toISOString(),
    notes: SNAPSHOT ? "Offline snapshot mode (authorization: pending)" : "Live fetch (authorization: pending - not recommended)",
  };
}