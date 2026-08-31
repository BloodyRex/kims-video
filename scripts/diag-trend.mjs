// TMP: confirm whether the WORKER's fetched tvTrendingWeek (3 pages) actually contains 207333.
// Patch intelFetchPages to log ids / check trending pages content for 207333.
import { readFileSync } from "fs";
globalThis.fetch = async (url, opts) => origFetch(url, opts);
const origFetch = globalThis.fetch;
globalThis.caches = { default: { match: async () => null, put: async () => {}, delete: async () => {} } };
const suffix = `
;const _origPages = globalThis.intelFetchPages;
;globalThis.intelFetchPages = async (token, path, params, pages) => {
;  const out = await _origPages(token, path, params, pages);
;  if (path === "/trending/tv/week") {
;    const hasSol = (out||[]).some(x => x.id === 207333);
;    const withCn = (out||[]).filter(x => /[\\u4e00-\\u9fff]/.test(x.name||""));
;    console.log("  [trending fetched] total="+(out||[]).length+" | contains207333="+hasSol+" | withCnName="+withCn.length);
;    const sol = (out||[]).find(x=>x.id===207333);
;    if (sol) console.log("    sol name="+JSON.stringify(sol.name)+" cnOv="+/[\\u4e00-\\u9fff]/.test(sol.overview||"")+" pop="+sol.popularity);
;    if (withCn.length) console.log("    cn-named: "+withCn.map(x=>x.name).join(" | "));
;  }
;  return out;
;};
;globalThis.__intelTV = handleIntelTV;`;
const src = readFileSync(new URL("../workers-1.4.js", import.meta.url), "utf8");
const env = { TMDB_API_READ_ACCESS_TOKEN: process.env.TMDB, DISCOVER_KV: null, SUBSCRIBE_KV: null };
await import("data:text/javascript," + encodeURIComponent(src + suffix));
const res = await globalThis.__intelTV(env);
console.log("ongoing count:", (res.ongoing||[]).length, "| contains207333:", !!(res.ongoing||[]).find(s=>s.tmdbId===207333));
process.exit(0);