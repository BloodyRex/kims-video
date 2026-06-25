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

// Build genre nav list for the top of the page
let genreNavHtml = '';
for (const genre of discover.genres) {
  const slug = GENRE_SLUGS[genre.name] || genre.name;
  genreNavHtml += ` <a href="#${slug}" style="color:#ffff00;text-decoration:none;font-weight:900;font-size:14px;">${genre.name}</a> ·`;
}
genreNavHtml = genreNavHtml.replace(/·$/, '');

// Build FAQ items for JSON-LD
let faqItemsJson = [];
let genreSectionsHtml = '';

for (const genre of discover.genres) {
  const color = GENRE_COLORS[genre.name] || '#ff00ff';
  const slug = GENRE_SLUGS[genre.name] || genre.name;
  const theme = GENRE_THEMES[genre.name] || { zh: "主题与情感体验", en: "themes and emotional experience" };

  let pairsHtml = '';
  for (const pair of genre.pairs) {
    const detailUrl = `/?from=${pair.source.tmdbId}&r=${pair.recommend.tmdbId}&s=${encodeURIComponent(pair.source.title)}&discover=1`;
    const sourceResultUrl = `/?from=${pair.source.tmdbId}`;

    // FAQ item for JSON-LD
    faqItemsJson.push({
      "@type": "Question",
      name: `如果你喜欢《${pair.source.title}》（${pair.source.year}），有什么类似的电影推荐？`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `推荐《${pair.recommend.title}》（${pair.recommend.year}）。${pair.reason}`
      }
    });
    faqItemsJson.push({
      "@type": "Question",
      name: `I liked ${pair.source.titleEn} (${pair.source.year}), what similar movie should I watch?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `Try ${pair.recommend.titleEn} (${pair.recommend.year}). ${pair.reasonEn}`
      }
    });

    pairsHtml += `
          <article style="background:#fff;border:4px solid #000;padding:20px;box-shadow:8px 8px 0 0 ${color};margin-bottom:16px;">
            <div style="font-size:16px;font-weight:900;margin-bottom:8px;">
              如果你喜欢《${escapeHtml(pair.source.title)}》（${escapeHtml(pair.source.year)}）→ 《${escapeHtml(pair.recommend.title)}》（${escapeHtml(pair.recommend.year)}）
            </div>
            <p style="color:#444;font-size:14px;line-height:1.7;margin-bottom:12px;">${escapeHtml(pair.reason)}</p>
            <p style="color:#888;font-size:13px;line-height:1.6;margin-bottom:12px;"><em>${escapeHtml(pair.reasonEn)}</em></p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <a href="${detailUrl}" style="display:inline-block;background:${color};color:#000;padding:8px 16px;font-size:12px;font-weight:900;text-decoration:none;border:2px solid #000;box-shadow:4px 4px 0 0 #000;text-transform:uppercase;">查看详情 →</a>
              <a href="${sourceResultUrl}" style="display:inline-block;background:#ffff00;color:#000;padding:8px 16px;font-size:12px;font-weight:900;text-decoration:none;border:2px solid #000;box-shadow:4px 4px 0 0 #000;">更多「${escapeHtml(pair.source.title)}」推荐 →</a>
            </div>
          </article>`;
  }

  genreSectionsHtml += `
        <section id="${slug}" style="margin-bottom:48px;">
          <h2 style="display:inline-block;background:${color};color:#fff;font-size:20px;font-weight:900;padding:8px 16px;border:4px solid #000;box-shadow:6px 6px 0 0 #000;margin-bottom:24px;text-shadow:2px 2px 0 rgba(0,0,0,0.3);">
            <a href="/genre/${slug}" style="color:#fff;text-decoration:none;">${genre.name}</a>
          </h2>
          <div>${pairsHtml}</div>
        </section>`;
}

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqItemsJson
};

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI 电影推荐发现页 | Discover 相似电影合集 | Kim's Video</title>
  <meta name="description" content="探索基于 AI 的电影推荐组合，发现与你喜欢电影相似的科幻、剧情与悬疑作品。涵盖科幻、悬疑、恐怖、动画、战争、犯罪、剧情、奇幻八大类型。" />
  <meta name="keywords" content="电影推荐,AI推荐,相似电影,Discover,冷门推荐,科幻电影,悬疑电影" />
  <link rel="canonical" href="${SITE}/discover" />
  <meta property="og:title" content="AI 电影推荐发现页 | Kim's Video" />
  <meta property="og:description" content="探索基于 AI 的电影推荐组合，发现与你喜欢电影相似的科幻、剧情与悬疑作品。" />
  <meta property="og:url" content="${SITE}/discover" />
  <meta property="og:type" content="website" />

  <!-- hreflang -->
  <link rel="alternate" hreflang="zh" href="${SITE}/discover?lang=zh" />
  <link rel="alternate" hreflang="en" href="${SITE}/discover?lang=en" />
  <link rel="alternate" hreflang="x-default" href="${SITE}/discover" />

  <!-- FAQ Structured Data -->
  <script type="application/ld+json">${JSON.stringify(faqSchema, null, 2)}</script>

  <style>
    body { margin:0; background:#111; color:#fff; font-family:-apple-system,'Microsoft YaHei','PingFang SC',sans-serif; line-height:1.6; }
    .container { max-width:800px; margin:0 auto; padding:20px; }
    a { color:#00ffff; }
    a:hover { opacity:0.8; }
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
      <header style="text-align:center;padding:40px 0 20px;border-bottom:4px solid #ff00ff;margin-bottom:40px;">
        <h1 style="font-size:28px;font-weight:900;margin:0 0 8px;">KIM'S VIDEO — DISCOVER</h1>
        <p style="color:#888;font-size:14px;">每一部你热爱的电影，都通往另一场未知的冒险。</p>
      </header>

      <!-- Genre navigation -->
      <nav style="text-align:center;padding:16px;margin-bottom:32px;background:rgba(255,255,255,0.05);border:2px solid #ffff00;">
        <span style="font-weight:900;color:#ffff00;">类型导航：</span>${genreNavHtml}
      </nav>

      <section style="background:rgba(0,0,0,0.6);border:2px solid #00ffff;padding:24px;margin-bottom:40px;">
        <h2 style="font-size:20px;font-weight:900;margin:0 0 12px;">AI 电影推荐发现页</h2>
        <p style="font-size:14px;color:#ccc;line-height:1.8;">本页面基于用户输入的电影，使用 AI 进行情绪、主题与风格匹配，生成相似电影推荐组合。</p>
        <p style="font-size:14px;color:#ccc;line-height:1.8;">覆盖类型包括：科幻、剧情、悬疑、动画、犯罪与独立电影等。</p>
        <p style="font-size:14px;color:#ccc;line-height:1.8;">每一组推荐都是基于情绪相似性 + 主题延展 + 风格对照生成的结果。</p>
      </section>

      ${genreSectionsHtml}

      <section style="background:rgba(0,0,0,0.6);border:2px solid #ff00ff;padding:24px;margin-bottom:40px;">
        <h2 style="font-size:18px;font-weight:900;margin:0 0 12px;">关于本页的推荐逻辑</h2>
        <p style="font-size:14px;color:#ccc;line-height:1.8;">本系统通过分析电影的类型标签、剧情结构与观众情绪反馈，构建跨影片的相似性网络。</p>
        <p style="font-size:14px;color:#ccc;line-height:1.8;">推荐结果并不依赖单一评分，而是综合叙事结构与观影体验进行匹配。</p>
        <p style="margin-top:16px;"><a href="/">返回首页</a></p>
      </section>

      <footer style="text-align:center;padding:20px 0;border-top:4px solid #ffff00;font-size:12px;color:#888;">
        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" style="color:#00ffff;">Data and poster from TMDB</a> | BLOODYREX (C) 2026
      </footer>
    </div>
  </div>

  <script type="module" crossorigin src="${scriptSrc}"></script>
</body>
</html>`;

const outDir = resolve(dist, 'discover');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'index.html'), html);
console.log(`[generate-discover-page.js] ✓ dist/discover/index.html generated (FAQ + hreflang)`);