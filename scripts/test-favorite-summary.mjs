// Favourites detail-summary checks — run: node scripts/test-favorite-summary.mjs
// Loads the real Cards.jsx module through Vite SSR (no test framework, no new deps).
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const server = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
try {
  const { makeEntry, pickSummary, matchesDetailType } = await server.ssrLoadModule('/src/components/Cards.jsx');

  // 1. New favourites keep the summary/highlight text captured at save time.
  const entry = makeEntry(
    { tmdbId: 123, summary: '中文简介', summaryEn: 'English summary', highlight: '推荐亮点', highlightEn: 'Highlight EN' },
    'movie'
  );
  assert.equal(entry.summary, '中文简介');
  assert.equal(entry.summaryEn, 'English summary');
  assert.equal(entry.highlight, '推荐亮点');
  assert.equal(entry.highlightEn, 'Highlight EN');
  assert.equal(entry.tmdbId, 123);
  assert.equal(entry.id, 'tmdb:123');
  const bare = makeEntry({ tmdbId: 9, summary: '', highlight: '' }, 'movie');
  assert.equal(bare.summary, undefined);
  assert.equal(bare.highlight, undefined);

  // 2. Saved summary wins over the fetched overview (zh + en).
  assert.equal(pickSummary({ summary: '中文简介' }, 'zh', { overview: '抓到的简介' }), '中文简介');
  assert.equal(pickSummary({ summaryEn: 'English summary' }, 'en', { overview: '抓到的简介' }), 'English summary');
  assert.equal(pickSummary({ highlight: '亮点' }, 'zh'), '亮点');
  assert.equal(pickSummary({ highlightEn: 'Highlight' }, 'en'), 'Highlight');

  // 3. Legacy movie/TV favourites (no saved summary) fall back to the fetched overview.
  assert.equal(pickSummary({ tmdbId: 5 }, 'zh', { overview: '抓到的简介' }), '抓到的简介');
  assert.equal(pickSummary({ tmdbId: 5 }, 'zh', { overview: '抓到的剧集简介' }), '抓到的剧集简介');

  // 4. Music favourites with no description source degrade to empty (no crash, no wrong text).
  assert.equal(pickSummary({ mbid: 'abc' }, 'zh', {}), '');
  assert.equal(pickSummary({ mbid: 'abc', summary: '专辑简介' }, 'zh', {}), '专辑简介');

  // 5. The detail endpoint searches movies first — a TV id collision must not render a movie.
  assert.equal(matchesDetailType('tv', '电影'), false);
  assert.equal(matchesDetailType('tv', 'Movie'), false);
  assert.equal(matchesDetailType('tv', '剧集'), true);
  assert.equal(matchesDetailType('tv', 'TV Series'), true);
  assert.equal(matchesDetailType('movie', '电影'), true);
  assert.equal(matchesDetailType('movie', 'Movie'), true);
  assert.equal(matchesDetailType('movie', '剧集'), false);
  assert.equal(matchesDetailType('movie', undefined), false);

  console.log('favorite summary preservation passed');
} finally {
  await server.close();
}
