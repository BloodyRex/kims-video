// tests/e2e/personal-store-e2e.test.js — migrated from __e2e_entry.js.
// Exercises the REAL src/utils/personalStore.js against real IndexedDB in headless Chrome.
// Flushes progress to #out after every step so a hang is visible.
// Bundled by esbuild into an IIFE for the e2e host page.
import * as ps from "../../src/utils/personalStore.js";

const out = document.getElementById("out");
const res = [];
function flush() { out.textContent = res.join("\n"); }
const step = (s) => { res.push("STEP  " + s); flush(); };
const ok = (n, c, extra = "") => { res.push((c ? "PASS  " : "FAIL  ") + n + (c ? "" : " | " + extra)); flush(); };

(async () => {
  try {
    step("module loaded; warmUp=" + typeof ps.warmUp);
    await ps.warmUp();
    step("warmUp done; listRecos=" + typeof ps.listRecos);

    await ps.saveReco({ sourceId: "e2e-src-1", payload: { primaryMovie: { title: "E2E One", year: 2026 }, recommendations: [{ title: "r1" }, { title: "r2" }] }, locale: "zh", modelTag: "e2e" });
    step("saveReco 1 done");
    await ps.saveReco({ sourceId: "e2e-src-2", payload: { primaryMovie: { title: "E2E Two", year: 2025 }, recommendations: [{ title: "r3" }] }, locale: "zh", modelTag: "e2e" });
    step("saveReco 2 done");
    await ps.addSearch({ scope: "ai_search", query: "e2e-query-alpha" });
    await ps.addSearch({ scope: "tmdb_search", query: "e2e-query-beta", tmdbId: 12345 });
    step("addSearch x2 done");

    const recos0 = await ps.listRecos();
    const searches0 = await ps.listSearches();
    ok("seed recos == 2", recos0.length === 2, "got " + recos0.length);
    ok("seed searches == 2", searches0.length === 2, "got " + searches0.length);
    step("seed verified; creating migration code");

    const { code, compressed, bytes } = await ps.createMigrationCode();
    step("createMigrationCode done");
    ok("code has KV1:/KV1G: prefix", /^KV1G?:/.test(code), code.slice(0, 8));
    ok("bytes > 0", bytes > 0, "bytes=" + bytes);
    const body = code.startsWith("KV1G:") ? code.slice(5) : code.slice(4);
    let b64ok = true; try { atob(body); } catch (e) { b64ok = false; }
    ok("payload is valid base64 (worker-decodable)", b64ok);
    res.push("INFO  prefix=" + code.slice(0, 5) + " bytes=" + bytes + " compressed=" + compressed); flush();

    await ps.wipeAll();
    step("wipeAll done");
    ok("wipe -> recos == 0", (await ps.listRecos()).length === 0);
    ok("wipe -> searches == 0", (await ps.listSearches()).length === 0);

    const imp = await ps.importMigrationCode(code);
    step("importMigrationCode done: " + JSON.stringify(imp));
    ok("import ok:true", imp.ok === true, JSON.stringify(imp));
    ok("import restored recos == 2", (await ps.listRecos()).length === 2, JSON.stringify(imp));
    ok("import restored searches == 2", (await ps.listSearches()).length === 2, JSON.stringify(imp));
    ok("restored payload intact", (await ps.listRecos()).some((r) => r.payload?.primaryMovie?.title === "E2E One"));

    const imp2 = await ps.importMigrationCode(code);
    ok("re-import ok:true (merge, idempotent)", imp2.ok === true, JSON.stringify(imp2));
    ok("re-import recos stay == 2", (await ps.listRecos()).length === 2);

    await ps.wipeAll();
    ok("final wipe recos == 0", (await ps.listRecos()).length === 0);

    out.textContent = "RESULT_START\n" + res.join("\n") + "\nRESULT_END\n" + (res.some((l) => l.startsWith("FAIL")) ? "OVERALL_FAIL" : "OVERALL_PASS");
  } catch (e) {
    out.textContent = "RESULT_START\n" + res.join("\n") + "\nERR " + (e && (e.stack || e.message || e)) + "\nRESULT_END\nOVERALL_FAIL";
  }
})();
