import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SITE = "https://bloodyrex.xyz";

const discoverRaw = readFileSync(join(ROOT, "src", "data", "discover.json"), "utf-8");
const discover = JSON.parse(discoverRaw);

/** Build an array of { loc, changefreq, priority, lastmod } entries */
function buildEntries() {
  const today = new Date().toISOString().slice(0, 10);

  const entries = [
    { loc: `${SITE}/`, changefreq: "weekly", priority: "1.0", lastmod: today },
    { loc: `${SITE}/discover`, changefreq: "daily", priority: "0.9", lastmod: today },
  ];

  const seenSources = new Set();

  for (const genre of discover.genres) {
    for (const pair of genre.pairs) {
      seenSources.add(pair.source.tmdbId);
      const from = pair.source.tmdbId;
      const r = pair.recommend.tmdbId;

      // Query-param URLs (legacy, for existing indexed pages)
      entries.push({
        loc: `${SITE}/?from=${from}&r=${r}`,
        changefreq: "weekly",
        priority: "0.7",
        lastmod: today,
      });

      // Path-based static pre-rendered detail pages (crawler-friendly)
      entries.push({
        loc: `${SITE}/d/${from}-${r}`,
        changefreq: "weekly",
        priority: "0.8",
        lastmod: today,
      });
    }
  }

  // Add individual source-movie result pages for each unique source
  for (const tmdbId of seenSources) {
    entries.push({
      loc: `${SITE}/?from=${tmdbId}`,
      changefreq: "weekly",
      priority: "0.6",
      lastmod: today,
    });
  }

  return entries;
}

function xmlEscape(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function renderXml(entries) {
  const urls = entries
    .map(
      (e) => `  <url>
    <loc>${xmlEscape(e.loc)}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
    )
    .join("\n\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${urls}

</urlset>
`;
}

const entries = buildEntries();
const xml = renderXml(entries);
writeFileSync(join(ROOT, "public", "sitemap.xml"), xml, "utf-8");

console.log(`sitemap.xml generated - ${entries.length} URLs`);
