// migrate.worker.test.mjs — drives the REAL workers-1.4.js migration routes
// (POST /migrate/create, GET /migrate/<token>, scheduled() purge) against
// Map-backed R2/KV mocks. Plain assertions, exit code 0/1. No framework.
import worker from "./workers-1.4.js";
import zlib from "node:zlib";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}  ${extra}`); }
};

// ── Map-backed R2 / KV mocks (async methods return promises, as the real bindings do) ──
function makeR2() {
  const store = new Map();
  return {
    store,
    async put(key, value, opts) {
      const text = typeof value === "string" ? value : await value.text();
      store.set(key, { text, customMetadata: (opts && opts.customMetadata) || {} });
    },
    async get(key) {
      const rec = store.get(key);
      if (!rec) return null;
      return {
        customMetadata: rec.customMetadata,
        async arrayBuffer() { const b = new TextEncoder().encode(rec.text); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); },
        async text() { return rec.text; },
        writeHttpMetadata() {},
      };
    },
    async delete(key) { store.delete(key); },
    async list(opts = {}) {
      const prefix = opts.prefix || "";
      const objects = [...store.entries()]
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, v]) => ({ key: k, customMetadata: v.customMetadata }));
      return { objects, truncated: false, cursor: null };
    },
  };
}
function makeKV() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    async list() { return { keys: [] }; },
  };
}
const makeCtx = () => ({ waitUntil(p) { if (p && p.catch) p.catch(() => {}); } });
const makeEnv = (r2 = makeR2()) => ({ DISCOVER_R2: r2, DISCOVER_KV: makeKV(), SUBSCRIBE_KV: makeKV(), ADMIN_PASSWORD: "test" });

// ── client-blob builders (mirror src/utils/personalStore.js wire format) ──
const envelope = () => ({ format: "kims-video-personal", version: 1, createdAt: 1700000000000, deviceId: "dev-test", recos: [], searches: [] });
const kv1 = (obj = envelope()) => "KV1:" + Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
const kv1g = (obj = envelope()) => "KV1G:" + zlib.gzipSync(Buffer.from(JSON.stringify(obj), "utf8")).toString("base64");

const BASE = "https://api.bloodyrex.xyz";
const TOKEN_RE = /^mig_[A-Za-z0-9_-]{16,80}$/;
let curEnv;
const post = (path, body) => worker.fetch(new Request(BASE + path, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }), curEnv, makeCtx());
const get = (path) => worker.fetch(new Request(BASE + path, { method: "GET" }), curEnv, makeCtx());
const J = (r) => r.json();

async function main() {
  // 1. create(KV1) — mint a one-time token
  let env = makeEnv(); curEnv = env;
  const b1 = kv1();
  let r = await post("/migrate/create", { code: b1 }); let j = await J(r);
  ok("create KV1 -> 200", r.status === 200, `status=${r.status} ${JSON.stringify(j)}`);
  ok("create KV1 -> token format mig_<16-80>", TOKEN_RE.test(j.code || ""), `code=${j.code}`);
  ok("create KV1 -> uncompressed v1 oneTime", j.compressed === false && j.version === 1 && j.oneTime === true, JSON.stringify(j));
  ok("create KV1 -> expiresAt ~24h", Math.abs((j.expiresAt - Date.now()) - 86400000) < 5000, `expiresAt=${j.expiresAt}`);
  const tok1 = j.code;
  ok("create KV1 -> stored under migrate/<token>", env.DISCOVER_R2.store.has("migrate/" + tok1));
  ok("create KV1 -> R2 value == client blob", env.DISCOVER_R2.store.get("migrate/" + tok1)?.text === b1);

  // 2. redeem -> blob returned, entry consumed
  r = await get("/migrate/" + tok1); j = await J(r);
  ok("redeem -> 200 ok oneTime", r.status === 200 && j.ok === true && j.oneTime === true, `status=${r.status} ${JSON.stringify(j)}`);
  ok("redeem -> returns exact client blob", j.code === b1);
  ok("redeem -> R2 entry deleted (single-use)", !env.DISCOVER_R2.store.has("migrate/" + tok1));

  // 3. redeem again -> 404 indistinguishable
  r = await get("/migrate/" + tok1); j = await J(r);
  ok("redeem twice -> 404 not_found_or_consumed", r.status === 404 && j.error === "not_found_or_consumed", `status=${r.status} ${JSON.stringify(j)}`);

  // 4. create(KV1G) + redeem round-trip
  r = await post("/migrate/create", { code: kv1g() }); j = await J(r);
  ok("create KV1G -> 200 compressed:true", r.status === 200 && j.compressed === true && j.version === 1, `status=${r.status} ${JSON.stringify(j)}`);
  r = await get("/migrate/" + j.code); j = await J(r);
  ok("redeem KV1G -> 200 startsWith KV1G:", r.status === 200 && (j.code || "").startsWith("KV1G:"), JSON.stringify(j));

  // 5. rejection paths
  r = await post("/migrate/create", { code: "GARBAGE-not-a-blob" }); j = await J(r);
  ok("create bad prefix -> 400 bad_prefix", r.status === 400 && j.error === "bad_prefix", `status=${r.status} ${JSON.stringify(j)}`);
  r = await post("/migrate/create", { code: "KV1:" + "A".repeat(1500001) }); j = await J(r);
  ok("create oversized -> 413 too_large", r.status === 413 && j.error === "too_large", `status=${r.status} ${JSON.stringify(j)}`);
  r = await post("/migrate/create", { code: "KV1:" + Buffer.from("not json").toString("base64") }); j = await J(r);
  ok("create non-JSON -> 400 bad_json", r.status === 400 && j.error === "bad_json", `status=${r.status} ${JSON.stringify(j)}`);
  r = await post("/migrate/create", { code: kv1({ format: "other", version: 1 }) }); j = await J(r);
  ok("create wrong format -> 400 bad_format", r.status === 400 && j.error === "bad_format", `status=${r.status} ${JSON.stringify(j)}`);
  r = await post("/migrate/create", {}); j = await J(r);
  ok("create missing code -> 400 empty", r.status === 400 && j.error === "empty", `status=${r.status} ${JSON.stringify(j)}`);

  // 6. expired redeem -> 410 + cleanup
  env = makeEnv(); curEnv = env;
  const tokExp = "mig_" + "a".repeat(24);
  await env.DISCOVER_R2.put("migrate/" + tokExp, b1, { customMetadata: { exp: String(Date.now() - 1000) } });
  r = await get("/migrate/" + tokExp); j = await J(r);
  ok("redeem expired -> 410 expired", r.status === 410 && j.error === "expired", `status=${r.status} ${JSON.stringify(j)}`);
  ok("redeem expired -> entry deleted", !env.DISCOVER_R2.store.has("migrate/" + tokExp));

  // 7. bad / unknown tokens
  r = await get("/migrate/mig_short"); j = await J(r);
  ok("redeem invalid token -> 400 invalid_token", r.status === 400 && j.error === "invalid_token", `status=${r.status} ${JSON.stringify(j)}`);
  r = await get("/migrate/mig_" + "b".repeat(24)); j = await J(r);
  ok("redeem unknown token -> 404", r.status === 404 && j.error === "not_found_or_consumed", `status=${r.status} ${JSON.stringify(j)}`);

  // 8. scheduled() purge: expired reclaimed, unexpired kept, digest unharmed
  env = makeEnv(); curEnv = env;
  const fresh = "mig_" + "c".repeat(24), stale = "mig_" + "d".repeat(24);
  await env.DISCOVER_R2.put("migrate/" + stale, b1, { customMetadata: { exp: String(Date.now() - 5000) } });
  await env.DISCOVER_R2.put("migrate/" + fresh, b1, { customMetadata: { exp: String(Date.now() + 5000) } });
  await worker.scheduled({}, env, makeCtx());
  ok("scheduled() purges expired blob", !env.DISCOVER_R2.store.has("migrate/" + stale), "stale remained");
  ok("scheduled() keeps unexpired blob", env.DISCOVER_R2.store.has("migrate/" + fresh), "fresh was purged");

  // 9. concurrent redemption -> no data loss, entry cleared
  env = makeEnv(); curEnv = env;
  r = await post("/migrate/create", { code: kv1() }); j = await J(r);
  const tokC = j.code;
  const [r1, r2] = await Promise.all([get("/migrate/" + tokC), get("/migrate/" + tokC)]);
  const [j1, j2] = await Promise.all([J(r1), J(r2)]);
  const oks = [j1, j2].filter((x) => x.ok === true).length;
  const rejected = [j1, j2].filter((x) => x.error === "not_found_or_consumed" || x.error === "already_consumed").length;
  ok("concurrent -> at least one success", oks >= 1, JSON.stringify([j1, j2]));
  ok("concurrent -> every caller resolved (no 5xx)", oks + rejected === 2, JSON.stringify([j1, j2]));
  ok("concurrent -> R2 entry cleared", !env.DISCOVER_R2.store.has("migrate/" + tokC));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(2); });
