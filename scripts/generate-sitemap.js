import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SITE = "https://bloodyrex.xyz";

const discoverRaw = readFileSync(join(ROOT, "src", "data", "discover.json"), "utf-8");
const discover = JSON.parse(discoverRaw);

const GENRE_SLUGS = {
  "科幻": "sci-fi", "悬疑": "mystery", "恐怖": "horror",
  "动画": "animation", "战争": "war", "犯罪": "crime",
  "剧情": "drama", "奇幻": "fantasy",
};

function buildEntries() {
  const today = new Date().toISOString().slice(0, 10);

  const entries = [
    { loc: `${SITE}/`, changefreq: "daily", priority: "1.0", lastmod: today },
    { loc: `${SITE}/discover/`, changefreq: "daily", priority: "0.9", lastmod: today },
    { loc: `${SITE}/intelligence`, changefreq: "daily", priority: "0.9", lastmod: today },
    { loc: `${SITE}/wall/`, changefreq: "daily", priority: "0.8", lastmod: today },
    // Festival Calendar — 入口页（其 canonical 为 /festivals，week/month/all/changes 均归一到它，故不重复收录）
    { loc: `${SITE}/festivals`, changefreq: "daily", priority: "0.9", lastmod: today },
  ];

  // 电影节详情页：仅收录已发布届次的独立路由（页面 canonical 为 /festivals/<slug>）。
  // 数据源为发布索引本身；读取失败只跳过详情页，不中断 sitemap 生成。
  try {
    const festivals = JSON.parse(
      readFileSync(join(ROOT, "public", "api", "festivals.json"), "utf-8")
    );
    const seenFestival = new Set();
    for (const f of festivals.festivals || []) {
      if (!f || !f.slug || seenFestival.has(f.slug)) continue;
      seenFestival.add(f.slug);
      entries.push({
        loc: `${SITE}/festivals/${f.slug}`,
        changefreq: "daily",
        priority: "0.7",
        lastmod: today,
      });
    }
  } catch (e) {
    console.warn(`[sitemap] skipped festival detail pages: ${e.message}`);
  }

  // Genre pages
  const seenSlugs = new Set();
  for (const genre of discover.genres) {
    const slug = GENRE_SLUGS[genre.name] || genre.name;
    if (!seenSlugs.has(slug)) {
      seenSlugs.add(slug);
      entries.push({
        loc: `${SITE}/genre/${slug}/`,
        changefreq: "weekly",
        priority: "0.8",
        lastmod: today,
      });
    }
  }

  // Detail pages (deduplicated)
  const seenDetail = new Set();
  for (const genre of discover.genres) {
    for (const pair of genre.pairs) {
      const key = `${pair.source.tmdbId}-${pair.recommend.tmdbId}`;
      if (seenDetail.has(key)) continue;
      seenDetail.add(key);
      entries.push({
        loc: `${SITE}/d/${pair.source.tmdbId}-${pair.recommend.tmdbId}`,
        changefreq: "weekly",
        priority: "0.8",
        lastmod: today,
      });
    }
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