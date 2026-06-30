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

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildDetailPage(pair, genreName) {
  const { source, recommend, reason, reasonEn } = pair;
  const from = source.tmdbId;
  const r = recommend.tmdbId;
  const pagePath = `/d/${from}-${r}`;

  const pageTitle = `喜欢《${source.title}》？《${recommend.title}》可能是你的下一部电影 | Kim's Video`;
  const desc = `如果你喜欢《${source.title}》（${source.year}），AI 根据品味匹配推荐《${recommend.title}》（${recommend.year}）。${reason}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Movie',
        '@id': `${SITE}${pagePath}#movie`,
        name: recommend.title,
        alternateName: recommend.titleEn,
        datePublished: recommend.year,
        sameAs: [`https://www.themoviedb.org/movie/${r}`],
      },
      {
        '@type': 'WebPage',
        '@id': `${SITE}${pagePath}#webpage`,
        url: `${SITE}${pagePath}`,
        name: pageTitle,
        description: desc,
        about: { '@id': `${SITE}${pagePath}#movie` },
        isPartOf: {
          '@type': 'WebSite',
          name: "Kim's Video",
          url: SITE + '/',
        },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: "Kim's Video", item: SITE + '/' },
            { '@type': 'ListItem', position: 2, name: source.title, item: `${SITE}/?from=${from}` },
            { '@type': 'ListItem', position: 3, name: recommend.title },
          ],
        },
      },
    ],
  };

  return '<!DOCTYPE html>\n' +
'<html lang="zh-CN">\n' +
'<head>\n' +
'  <meta charset="UTF-8" />\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
`  <title>${escapeHtml(pageTitle)}</title>\n` +
`  <meta name="description" content="${escapeHtml(desc)}" />\n` +
`  <meta name="keywords" content="电影推荐,AI推荐,${escapeHtml(source.title)},${escapeHtml(recommend.title)},${escapeHtml(genreName)},影视推荐,Kim's Video" />\n` +
`  <link rel="canonical" href="${SITE}${pagePath}" />\n` +
'\n' +
'  <!-- Open Graph -->\n' +
`  <meta property="og:title" content="${escapeHtml(pageTitle)}" />\n` +
`  <meta property="og:description" content="${escapeHtml(desc)}" />\n` +
`  <meta property="og:url" content="${SITE}${pagePath}" />\n` +
'  <meta property="og:type" content="website" />\n' +
'  <meta property="og:site_name" content="Kim\'s Video" />\n' +
'\n' +
'  <!-- Twitter Card -->\n' +
'  <meta name="twitter:card" content="summary" />\n' +
`  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />\n` +
`  <meta name="twitter:description" content="${escapeHtml(desc)}" />\n` +
'\n' +
'  <!-- hreflang -->\n' +
`  <link rel="alternate" hreflang="zh" href="${SITE}${pagePath}?lang=zh" />\n` +
`  <link rel="alternate" hreflang="en" href="${SITE}${pagePath}?lang=en" />\n` +
`  <link rel="alternate" hreflang="x-default" href="${SITE}${pagePath}" />\n` +
'\n' +
'  <!-- JSON-LD Structured Data -->\n' +
`  <script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>\n` +
'\n' +
'  <style>\n' +
'    body { margin:0; background:#111; color:#fff; font-family:-apple-system,\'Microsoft YaHei\',\'PingFang SC\',sans-serif; line-height:1.6; }\n' +
'    .container { max-width:720px; margin:0 auto; padding:20px; }\n' +
'    a { color:#00ffff; }\n' +
'    a:hover { opacity:0.8; }\n' +
'    .movie-card { background:rgba(255,255,255,0.05); border:2px solid #ff00ff; padding:24px; margin-bottom:24px; }\n' +
'    .movie-card h2 { font-size:24px; font-weight:900; margin:0 0 8px; color:#ffff00; }\n' +
'    .movie-card .year { font-size:14px; color:#888; margin-bottom:16px; }\n' +
'    .movie-card .reason { font-size:15px; color:#ccc; line-height:1.9; }\n' +
'    .source-tag { display:inline-block; background:#ffff00; color:#000; padding:4px 12px; font-size:12px; font-weight:900; margin-bottom:16px; }\n' +
'    .cta { display:inline-block; background:#ff00ff; color:#fff; padding:12px 24px; font-size:14px; font-weight:900; text-decoration:none; margin-top:16px; border:2px solid #00ffff; }\n' +
'    .cta:hover { background:#00ffff; color:#000; }\n' +
'    header { text-align:center; padding:40px 0 20px; border-bottom:4px solid #ffff00; margin-bottom:32px; }\n' +
'    footer { text-align:center; padding:20px 0; border-top:4px solid #ff00ff; margin-top:40px; font-size:12px; color:#888; }\n' +
'    @media (prefers-color-scheme:light) {\n' +
'      body { background:#f5f5f5; color:#222; }\n' +
'      a { color:#0066cc; }\n' +
'      .movie-card { background:#fff; border-color:#ff00ff; }\n' +
'      .movie-card h2 { color:#ff00ff; }\n' +
'      .movie-card .reason { color:#444; }\n' +
'      .source-tag { background:#ff00ff; color:#fff; }\n' +
'      .cta { background:#ff00ff; color:#fff; }\n' +
'    }\n' +
'  </style>\n' +
`    <style>
    @font-face{font-family:'Press Start 2P';font-style:normal;font-weight:400;font-display:swap;src:url(https://fonts.gstatic.com/s/pressstart2p/v16/e3t4euO8T-267oIAQAu6jDQyK3nYivN04w.woff2) format('woff2');unicode-range:U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F}@font-face{font-family:'Press Start 2P';font-style:normal;font-weight:400;font-display:swap;src:url(https://fonts.gstatic.com/s/pressstart2p/v16/e3t4euO8T-267oIAQAu6jDQyK3nRivN04w.woff2) format('woff2');unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}@font-face{font-family:'Press Start 2P';font-style:normal;font-weight:400;font-display:swap;src:url(https://fonts.gstatic.com/s/pressstart2p/v16/e3t4euO8T-267oIAQAu6jDQyK3nWivN04w.woff2) format('woff2');unicode-range:U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF}@font-face{font-family:'Press Start 2P';font-style:normal;font-weight:400;font-display:swap;src:url(https://fonts.gstatic.com/s/pressstart2p/v16/e3t4euO8T-267oIAQAu6jDQyK3nbivN04w.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}@font-face{font-family:'Press Start 2P';font-style:normal;font-weight:400;font-display:swap;src:url(https://fonts.gstatic.com/s/pressstart2p/v16/e3t4euO8T-267oIAQAu6jDQyK3nVivM.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
  </style>
  <link rel="stylesheet" crossorigin href="${cssHref}">\n` +
'</head>\n' +
'<body>\n' +
'  <div id="root">\n' +
'    <div class="container" style="padding-bottom:80px;">\n' +
'      <header>\n' +
'        <h1 style="font-size:28px;font-weight:900;margin:0;">KIM\'S <span style="color:#00ffff;">VIDEO</span></h1>\n' +
'        <p style="color:#888;font-size:13px;margin-top:8px;">AI 影视推荐引擎</p>\n' +
'      </header>\n' +
'\n' +
'      <div class="movie-card" style="text-align:center;">\n' +
`        <span class="source-tag">来源：${escapeHtml(source.title)}（${escapeHtml(source.year)}）</span>\n` +
`        <h2>${escapeHtml(recommend.title)} <span style="font-size:16px;font-weight:400;color:#888;">${escapeHtml(recommend.titleEn)}</span></h2>\n` +
`        <div class="year">${escapeHtml(recommend.year)} \u00b7 ${escapeHtml(genreName)}</div>\n` +
'        <div class="reason">\n' +
'          <p style="font-style:italic;color:#ffff00;font-size:13px;margin-bottom:12px;">推荐理由</p>\n' +
`          <p>${escapeHtml(reason)}</p>\n` +
'        </div>\n' +
'        <p style="font-size:13px;color:#888;margin-top:8px;">\n' +
`          <em>${escapeHtml(reasonEn)}</em>\n` +
'        </p>\n' +
`        <a href="/?from=${from}&r=${r}" class="cta">查看 AI 完整推荐 </a>\n` +
'      </div>\n' +
'\n' +
'      <p style="text-align:center;margin-top:24px;">\n' +
'        <a href="/">← 返回首页开始你自己的推荐</a> ·\n' +
'        <a href="/discover">浏览更多推荐</a>\n' +
'      </p>\n' +
'\n' +
'      <footer>\n' +
'        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">Data and poster from TMDB</a> | BLOODYREX (C) 2026\n' +
'      </footer>\n' +
'    </div>\n' +
'  </div>\n' +
'\n' +
'  <script>\n' +
'    (function() {\n' +
`      var target = '/?from=${from}&r=${r}';\n` +
`      if (window.location.search !== '?from=${from}&r=${r}') {\n` +
'        history.replaceState(null, "", target);\n' +
'      }\n' +
'    })();\n' +
'  </script>\n' +
'\n' +
`  <script type="module" crossorigin src="${scriptSrc}"></script>\n` +
'</body>\n' +
'</html>';
}

const outBase = resolve(dist, 'd');
if (!existsSync(outBase)) mkdirSync(outBase, { recursive: true });

let count = 0;
for (const genre of discover.genres) {
  for (const pair of genre.pairs) {
    const from = pair.source.tmdbId;
    const r = pair.recommend.tmdbId;
    const filename = `${from}-${r}.html`;
    const html = buildDetailPage(pair, genre.name);
    writeFileSync(resolve(outBase, filename), html, 'utf-8');
    count++;
  }
}

console.log(`[generate-detail-pages.js] generated ${count} detail pages in dist/d/`);