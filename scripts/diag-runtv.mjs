// CI: run real handleIntelTV against live TMDB after B1/C1 changes
import { readFileSync } from "fs";
const src = readFileSync(new URL("../workers-1.4.js", import.meta.url), "utf8");
globalThis.caches = { default: { match: async () => null, put: async () => {}, delete: async () => {} } };
const env = { TMDB_API_READ_ACCESS_TOKEN: process.env.TMDB, DISCOVER_KV: null, SUBSCRIBE_KV: null };
const src2 = src + "\n;globalThis.__intelTV = handleIntelTV;";
await import("data:text/javascript," + encodeURIComponent(src2));
const res = await globalThis.__intelTV(env);
console.log("ongRES len:", (res.ongoing || []).length);
(res.ongoing || []).forEach((s) => console.log("  ONG:", s.title, "| S" + s.season, "| air", s.latestAirDate || "-"));
console.log("premRES len:", (res.premieresThisWeek || []).length);
console.log("upcRES len:", (res.upcoming || []).length);
(res.upcoming || []).forEach((s) => console.log("  UPC:", s.title, "| S" + s.season, "| lang", s.originalLanguage));
process.exit(0);