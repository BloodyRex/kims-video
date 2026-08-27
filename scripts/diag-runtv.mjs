import { readFileSync } from "fs";
const src = readFileSync(new URL("../workers-1.4.js", import.meta.url), "utf8");
globalThis.caches = { default: { match: async () => null, put: async () => {}, delete: async () => {} } };
const env = { TMDB_API_READ_ACCESS_TOKEN: process.env.TMDB, DISCOVER_KV: null, SUBSCRIBE_KV: null };
const src2 = src + "\n;globalThis.__intelTV = handleIntelTV;";
await import("data:text/javascript," + encodeURIComponent(src2));
const res = await globalThis.__intelTV(env);
console.log("ongoing len:", (res.ongoing || []).length);
(res.ongoing || []).forEach((s) => console.log("  ONGOING:", s.title, "| S" + s.season, "| air", s.latestAirDate || "-"));
// 找百年孤独
const hit = (res.ongoing || []).find((s) => /百年/.test(s.title || ""));
console.log("百年孤独 in ongoing:", hit ? "YES " + hit.title + " S" + hit.season + " air=" + hit.latestAirDate : "NO");
const all = [...(res.premieresThisWeek || []), ...(res.upcoming || [])];
console.log("premieres/upcoming 含百年:", all.filter((s) => /百年/.test(s.title || "")).map((s) => s.title).join() || "无");
process.exit(0);