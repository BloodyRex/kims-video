// TMP: isolate WHERE 207333 is dropped. Re-run handleIntelTV but monkey-patch
// intelSelectDiverse to log every call + the item order + whether 207333 is in tier1/tier2.
import { readFileSync } from "fs";
const origFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => origFetch(url, opts);
globalThis.caches = { default: { match: async () => null, put: async () => {}, delete: async () => {} } };
const suffix = `
;const _origSel = globalThis.intelSelectDiverse;
;globalThis.intelSelectDiverse = function(items, count, reserved, opts, today){
;  const isSol = (x) => (x.id === 207333 || x.tmdbId === 207333);
;  const hasSol = (items||[]).some(isSol);
;  if (hasSol) {
;    const sol = (items||[]).find(isSol);
;    const idx = (items||[]).indexOf(sol);
;    console.log("  [intelSelectDiverse] count="+count+" | items="+items.length+" | 207333 at idx="+idx+" | pop="+sol.popularity+" | trendingOnly="+(sol._trendingOnly)+" | release="+sol.release_date+" | lastEp="+(sol.last_episode_to_air? "Y":"N"));
;  }
;  const out = _origSel(items, count, reserved, opts, today);
;  if (hasSol) console.log("    -> RESULT contains 207333: "+(out||[]).some(isSol));
;  return out;
;};
;globalThis.__intelTV = handleIntelTV;`;
const src = readFileSync(new URL("../workers-1.4.js", import.meta.url), "utf8");
const env = { TMDB_API_READ_ACCESS_TOKEN: process.env.TMDB, DISCOVER_KV: null, SUBSCRIBE_KV: null };
await import("data:text/javascript," + encodeURIComponent(src + suffix));
const res = await globalThis.__intelTV(env);
console.log("ongoing count:", (res.ongoing||[]).length, "contains 207333:", !!(res.ongoing||[]).find(s=>s.tmdbId===207333));
process.exit(0);