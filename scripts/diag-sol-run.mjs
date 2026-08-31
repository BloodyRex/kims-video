// TMP: run the FULL handleIntelTV candidate chain locally (with real token) and
// trace WHERE 百年孤独 (207333) lands at each stage. Mirrors workers-1.4.js logic.
// We re-implement the ongoing filter + tier assignment + intelSelectDiverse to see its rank.
import { readFileSync } from "fs";
let count = 0;
const origFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => { count++; return origFetch(url, opts); };
globalThis.caches = { default: { match: async () => null, put: async () => {}, delete: async () => {} } };
const src = readFileSync(new URL("../workers-1.4.js", import.meta.url), "utf8");
const src2 = src + "\n;globalThis.__intelTV = handleIntelTV;";
const env = { TMDB_API_READ_ACCESS_TOKEN: process.env.TMDB, DISCOVER_KV: null, SUBSCRIBE_KV: null };
await import("data:text/javascript," + encodeURIComponent(src2));
const res = await globalThis.__intelTV(env);
const SOL = 207333;
console.log("TOTAL fetches:", count);
console.log("ongoing count:", (res.ongoing||[]).length, "| contains 207333:", !!(res.ongoing||[]).find(s=>s.tmdbId===SOL));
console.log("--- ongoing titles ---");
(res.ongoing||[]).forEach((s,i)=>console.log(String(i+1).padStart(2)+" | "+String(s.title||"").padEnd(24)+" | S"+(s.season??"?")+"-E"+(s.episode??"?")+" | last="+(s.latestAirDate||"-")));
if (!(res.ongoing||[]).some(s=>s.tmdbId===SOL)) {
  console.log("\n>>> 百年孤独 NOT in ongoing. Check premieres/upcoming/other sections:");
  ["premieresThisWeek","upcoming"].forEach(k => {
    const arr = res[k]||[];
    const hit = arr.find(s=>s.tmdbId===SOL);
    console.log(`  ${k} (${arr.length}): contains solitude = ${!!hit}`);
  });
}
process.exit(0);