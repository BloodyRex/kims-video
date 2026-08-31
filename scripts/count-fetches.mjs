import { readFileSync } from "fs";
// count real outbound fetches by wrapping fetch
let count = 0;
let detailCount = 0;
const origFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  count++;
  if (typeof url === "string" && url.includes("/tv/")) detailCount++;
  return origFetch(url, opts);
};
globalThis.caches = { default: { match: async () => null, put: async () => {}, delete: async () => {} } };
const src = readFileSync(new URL("../workers-1.4.js", import.meta.url), "utf8");
const src2 = src + "\n;globalThis.__intelTV = handleIntelTV;";
const env = { TMDB_API_READ_ACCESS_TOKEN: process.env.TMDB, DISCOVER_KV: null, SUBSCRIBE_KV: null };
await import("data:text/javascript," + encodeURIComponent(src2));
const res = await globalThis.__intelTV(env);
console.log("TOTAL fetches (cold):", count, "| /tv/{id} detail fetches:", detailCount);
console.log("ongoing:", (res.ongoing || []).length, "有S/E:", res.ongoing.filter(s => s.season != null).length);
console.log("--- ongoing S/E breakdown ---");
(res.ongoing || []).forEach((s, i) => {
  console.log(String(i + 1).padStart(2) + " | " + String(s.title || "").padEnd(20) + " | S" + (s.season ?? "?") + "-E" + (s.episode ?? "?"));
});
process.exit(0);