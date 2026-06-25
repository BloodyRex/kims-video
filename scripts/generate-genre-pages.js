import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');
const SITE = 'https://bloodyrex.xyz';

const discover = JSON.parse(
  readFileSync(resolve(root, 'src', 'data', 'discover.json'), 'utf-8')
);

const indexHtml = readFileSync(resolve(dist, 'index.html'), 'utf-8');
const scriptSrc = indexHtml.match(/<script type="module".+?src="([^"]+)"/)?.[1] || '/assets/index.js';
const cssHref = indexHtml.match(/<link rel="stylesheet".+?href="([^"]+)">/)?.[1] || '/assets/index.css';

const GENRE_COLORS = {
  "科幻": "#ff00ff", "悬疑": "#00ffff", "恐怖": "#ff00ff",
  "动画": "#ffff00", "战争": "#ff00ff", "犯罪": "#00ffff",
  "剧情": "#ffff00", "奇幻": "#ff00ff",
};

const GENRE_SLUGS = {
  "科幻": "sci-fi", "悬疑": "mystery", "恐怖": "horror",
  "动画": "animation", "战争": "war", "犯罪": "crime",
  "剧情": "drama", "奇幻": "fantasy",
};

const GENRE_THEMES = {
  "科幻": { zh: "时空、科技与人性探索", en: "time, technology, and human exploration" },
  "悬疑": { zh: "悬疑、记忆与身份认同", en: "suspense, memory, and identity" },
  "恐怖": { zh: "心理恐怖与氛围营造", en: "psychological dread and atmosphere" },
  "动画": { zh: "想象力与情感表达", en: "imagination and emotional expression" },
  "战争": { zh: "人性考验与历史反思", en: "human endurance and historical reflection" },
  "犯罪": { zh: "道德边界与命运纠缠", en: "moral boundaries and fate" },
  "剧情": { zh: "人性深度与社会洞察", en: "human depth and social insight" },
  "奇幻": { zh: "神话叙事与史诗冒险", en: "mythic storytelling and epic adventure" },
};

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Build cross-genre nav
let crossNav = '';
for (const g of discover.genres) {
  const slug = GENRE_SLUGS[g.name] || g.name;
  crossNav += ` <a href="/genre/${slug}" style="color:#ffff00;text-decoration:none;font-weight:900;">${g.name}</a> ·`;
}
crossNav = crossNav.replace(/·$/, '');

for (const genre of discover.genres) {
  const color = GENRE_COLORS[genre.name] || '#ff00ff';
  const slug = GENRE_SLUGS[genre.name] || genre.name;
  const theme = GENRE_THEMES[genre.name] || { zh: "主题与情感体验", en: "themes and emotional experience" };
  const pagePath = `/genre/${slug}`;

  const zhTitle = `${genre.name}电影推荐 — 相似电影发现 | Kim's Video`;
  const enTitle = `${genre.name} Movie Recommendations — Similar Movies | Kim's Video`;
  const zhDesc = `发现与经典${genre.name}电影相似的推荐。AI 基于${theme.zh}进行品味匹配，为你精选${genre.name}类型推荐对。`;
  const enDesc = `Discover movie recommendations similar to classic ${genre.name} films. AI-powered taste matching based on ${theme.en}.`;

  // Build the JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: zhTitle,
    description: zhDesc,
    url: `${SITE}${pagePath}`,
    isPartOf: {
      "@type": "WebSite",
      name: "Kim's Video",
      url: SITE + '/',
    },
    about: {
      "@type": "Thing",
      name: `${genre.name}电影`,
      description: `${genre.name}类型电影推荐合集`,
    },
  };

  // Build pair cards
  let pairsHtml = '';
  for (const pair of genre.pairs) {
    const detailUrl = `/?from=${pair.source.tmdbId}&r=${pair.recommend.tmdbId}&s=${encodeURIComponent(pair.source.title)}&discover=1`;
    const sourceUrl = `/?from=${pair.source.tmdbId}`;
    pairsHtml += `
          <article style="background:#fff;border:4px solid #000;padding:20px;box-shadow:8px 8px 0 0 ${color};margin-bottom:16px;">
            <div style="font-size:16px;font-weight:900;margin-bottom:8px;">
              如果你喜欢《${escapeHtml(pair.source.title)}》（${escapeHtml(pair.source.year)}）→ 《${escapeHtml(pair.recommend.title)}》（${escapeHtml(pair.recommend.year)}）
            </div>
            <p style="color:#444;font-size:14px;line-height:1.7;margin-bottom:8px;">${escapeHtml(pair.reason)}</p>
            <p style="color:#888;font-size:13px;margin-bottom:12px;"><em>${escapeHtml(pair.reasonEn)}</em></p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <a href="${detailUrl}" style="display:inline-block;background:${color};color:#000;padding:8px 16px;font-size:12px;font-weight:900;text-decoration:none;border:2px solid #000;box-shadow:4px 4px 0 0 #000;text-transform:uppercase;">查看详情 →</a>
              <a href="${sourceUrl}" style="display:inline-block;background:#ffff00;color:#000;padding:8px 16px;font-size:12px;font-weight:900;text-decoration:none;border:2px solid #000;box-shadow:4px 4px 0 0 #000;">探索更多「${escapeHtml(pair.source.title)}」推荐 →</a>
            </div>
          </article>`;
  }

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(zhTitle)}</title>
  <meta name="description" content="${escapeHtml(zhDesc)}" />
  <meta name="keywords" content="${escapeHtml(genre.name)}电影,电影推荐,AI推荐,相似电影,${escapeHtml(genre.name)}类型,影视推荐,Kim's Video" />
  <link rel="canonical" href="${SITE}${pagePath}" />
  <meta property="og:title" content="${escapeHtml(zhTitle)}" />
  <meta property="og:description" content="${escapeHtml(zhDesc)}" />
  <meta property="og:url" content="${SITE}${pagePath}" />
  <meta property="og:type" content="website" />

  <!-- hreflang -->
  <link rel="alternate" hreflang="zh" href="${SITE}${pagePath}?lang=zh" />
  <link rel="alternate" hreflang="en" href="${SITE}${pagePath}?lang=en" />
  <link rel="alternate" hreflang="x-default" href="${SITE}${pagePath}" />

  <script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>

  <style>
    body { margin:0; background:#111; color:#fff; font-family:-apple-system,'Microsoft YaHei','PingFang SC',sans-serif; line-height:1.6; }
    .container { max-width:720px; margin:0 auto; padding:20px; }
    a { color:#00ffff; }
    a:hover { opacity:0.8; }
    header { text-align:center; padding:40px 0 20px; border-bottom:4px solid ${color}; margin-bottom:32px; }
    footer { text-align:center; padding:20px 0; border-top:4px solid #ffff00; margin-top:40px; font-size:12px; color:#888; }
    @media (prefers-color-scheme:light) {
      body { background:#f5f5f5; color:#222; }
      a { color:#0066cc; }
    }
  </style>
  <link rel="stylesheet" crossorigin href="${cssHref}">
</head>
<body>
  <div id="root">
    <div class="container" style="padding-bottom:80px;">
      <header>
        <h1 style="font-size:28px;font-weight:900;margin:0;">
          <a href="/" style="color:#fff;text-decoration:none;">KIM'S <span style="color:#00ffff;">VIDEO</span></a> — ${escapeHtml(genre.name)}
        </h1>
        <p style="color:#888;font-size:14px;margin-top:8px;">${escapeHtml(theme.zh)} · ${escapeHtml(theme.en)}</p>
      </header>

      <!-- Cross-genre nav -->
      <nav style="text-align:center;padding:16px;margin-bottom:32px;background:rgba(255,255,255,0.05);border:2px solid ${color};">
        <span style="font-weight:900;color:${color};">其他类型：</span>${crossNav}
      </nav>

      <section style="margin-bottom:24px;">
        <h2 style="font-size:20px;font-weight:900;margin:0 0 12px;color:#ffff00;">${escapeHtml(genre.name)}电影推荐合集</h2>
        <p style="font-size:14px;color:#ccc;line-height:1.8;">基于 AI 品味匹配的${escapeHtml(genre.name)}类型电影推荐。如果你喜欢以下源电影，AI 会根据${escapeHtml(theme.zh)}为你推荐相似作品。</p>
      </section>

      ${pairsHtml}

      <p style="text-align:center;margin-top:24px;">
        <a href="/">← 返回首页开始你自己的推荐</a> ·
        <a href="/discover">浏览全部类型的推荐</a>
      </p>

      <footer>
        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">Data and poster from TMDB</a> | BLOODYREX (C) 2026
      </footer>
    </div>
  </div>

  <script type="module" crossorigin src="${scriptSrc}"></script>
</body>
</html>`;

  const outDir = resolve(dist, 'genre', slug);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'index.html'), html);
}

console.log(`[generate-genre-pages.js] generated ${discover.genres.length} genre pages in dist/genre/`);