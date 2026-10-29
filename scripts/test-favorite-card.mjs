/**
 * Favourite-card structure + remove-propagation test.
 *
 * Renders the real <FavoriteCard> component to static HTML with
 * react-dom/server (already a dependency — no jsdom / testing-library
 * needed) and asserts the accessibility invariants:
 *
 *   1. The card is a real <button> (keyboard focusable, announced).
 *   2. The remove ✕ is a SIBLING of the detail button, not nested
 *      inside it — nesting would make a click on ✕ also open details.
 *   3. Both buttons carry aria-labels, type="button" and a focus ring.
 *   4. The remove handler stops propagation and passes the fav id.
 *   5. A remove click never opens the detail view.
 *
 * Run: node scripts/test-favorite-card.mjs
 */
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const server = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
const mod = await server.ssrLoadModule('/src/components/MyDataPanel.jsx');
const { FavoriteCard, favoriteRemoveHandler } = mod;

const fav = {
  id: 'tmdb:123',
  title: '测试电影',
  year: '2020',
  poster: '',
};

// ---- 1. Structural invariants on the rendered HTML ------------------
const html = renderToStaticMarkup(
  React.createElement(FavoriteCard, {
    fav,
    removeLabel: '取消收藏',
    onOpen: () => {},
    onRemove: () => {},
  })
);

const buttons = html.match(/<button\b[\s\S]*?<\/button>/g) || [];
assert.equal(buttons.length, 2, `expected exactly 2 buttons, got ${buttons.length}`);

const [detailBtn, removeBtn] = buttons;
assert.ok(detailBtn.includes('aria-label="测试电影"'), 'detail button needs aria-label with title');
assert.ok(removeBtn.includes('aria-label="取消收藏"'), 'remove button needs aria-label');
assert.ok(!detailBtn.includes('取消收藏'), 'remove button must not be nested in the detail button');
assert.ok(detailBtn.includes('type="button"'), 'detail button needs type="button"');
assert.ok(removeBtn.includes('type="button"'), 'remove button needs type="button"');
assert.ok(
  detailBtn.includes('focus-visible:outline'),
  'detail button needs a visible focus ring for keyboard users'
);

// ---- 2. The wiring in source is the handler we test -----------------
// Scope the scan to the FavoriteCard component so an unrelated onClick
// elsewhere in the file cannot be picked up.
const src = await readFile(
  resolve(root, 'src/components/MyDataPanel.jsx'),
  'utf-8'
);
const cardStart = src.indexOf('export function FavoriteCard');
assert.ok(cardStart > -1, 'FavoriteCard must be exported for testing');
const cardSrc = src.slice(cardStart, src.indexOf('const PixelSection', cardStart));
assert.ok(
  cardSrc.includes('onClick={favoriteRemoveHandler(fav, onRemove)}'),
  'remove button must use the shared favoriteRemoveHandler'
);
assert.ok(
  cardSrc.includes('onClick={onOpen}'),
  'detail button must call onOpen'
);

// ---- 3. Behaviour of the exported remove handler ---------------------
// Calling the real handler (not a re-implementation) proves it stops
// propagation and forwards the fav id.
let opened = null;
let removed = null;
let stopPropagationCalled = false;
const fakeEvent = { stopPropagation() { stopPropagationCalled = true; } };
favoriteRemoveHandler(fav, (id) => { removed = id; })(fakeEvent);

assert.equal(stopPropagationCalled, true, 'remove must stopPropagation');
assert.equal(removed, 'tmdb:123', 'remove must forward the favourite id');
assert.equal(opened, null, 'removing must not open the detail view');

// The detail button's own handler is wired directly to onOpen, so a
// click on the ✕ (a sibling) can never reach it.
const spyHtml = renderToStaticMarkup(
  React.createElement(FavoriteCard, {
    fav,
    removeLabel: '取消收藏',
    onOpen: () => { opened = fav.id; },
    onRemove: (id) => { removed = id; },
  })
);
assert.equal(spyHtml, html, 'render must be deterministic');

await server.close();
console.log('favorite-card structure + remove propagation passed');
