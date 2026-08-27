// Temp diagnostic: run real handleIntelTV against live TMDB (via worker code import)
import { readFileSync } from "fs";
const src = readFileSync(new URL("../workers-1.4.js", import.meta.url), "utf8");
globalThis.caches = { default: { match: async () => null, put: async () => {}, delete: async () => {} } };
const env = { TMDB_API_READ_ACCESS_TOKEN: process.env.TMDB, DISCOVER_KV: null, SUBSCRIBE_KV: null };
const src2 = src + "\n;globalThis.__intelTV = handleIntelTV;";
await import("data:text/javascript," + encodeURIComponent(src2));
const res = await globalThis.__intelTV(env);
console.log("ongoing len:", (res.ongoing || []).length);
(res.ongoing || []).forEach((s) =>
  console.log("  ONGOING:", s.title, "| S" + s.season, "| air", s.latestAirDate || "-")
);
process.exit(0);