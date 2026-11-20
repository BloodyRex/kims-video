// Shared KV/R2 cache utilities — extracted from workers-1.4.js
// 所有 Worker 共用的 KV/R2 读取与安全 JSON 处理

// ── 安全的 JSON 解析 ────────────────────────────────────────────────
function safeJSONParse(raw) {
  if (typeof raw !== "string") return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ── 安全的 JSON 字符串化 ────────────────────────────────────────────
function safeJSONStringify(obj) {
  try { return JSON.stringify(obj); } catch { return String(obj); }
}

// ── KV 缓存读取器工厂（已绑定 env）───────────────────────────────────
// 使用方式：const kvCache = useKVCache(env.SUBSCRIBE_KV);
// 返回 { get, put, del, list } 四个方法
function useKVCache(kv) {
  if (!kv) return null;
  return {
    // 单键 GET，带 json 解析
    async get(key, defaultValue = null) {
      try {
        const raw = await kv.get(key);
        if (raw === null) return defaultValue;
        return safeJSONParse(raw);
      } catch { return defaultValue; }
    },
    // 单键 PUT，带 JSON 自动 stringify
    async put(key, value, opts = {}) {
      const payload = typeof value === "object" ? safeJSONStringify(value) : String(value);
      const metadata = opts.httpMetadata || {};
      if (opts.expirationTtl) {
        // Cloudflare KV custom TTL
        payload.customMetadata = { exp: Date.now() / 1000 + opts.expirationTtl };
      }
      await kv.put(key, payload, { httpMetadata: metadata });
    },
    // 单键 DELETE
    async del(key) {
      try { await kv.delete(key); } catch {}
    },
    // 前缀列表 + 游标分页
    async list(opts = {}) {
      try {
        const result = await kv.list({ limit: 1000, ...opts });
        return result;
      } catch { return { keys: [], list_complete: true, cursor: null }; }
    }
  };
}

// ── R2 缓存读取器工厂（已绑定 env）───────────────────────────────────
function useR2Cache(r2) {
  if (!r2) return null;
  return {
    async get(key) {
      try {
        const obj = await r2.get(key);
        if (!obj) return null;
        const metadata = obj.httpMetadata || {};
        return {
          body: await obj.arrayBuffer(),
          httpMetadata: metadata
        };
      } catch { return null; }
    },
    async put(key, bytes, opts = {}) {
      const metadata = {
        httpMetadata: {
          contentType: opts.contentType || "application/octet-stream",
          cacheControl: opts.cacheControl || "public, max-age=86400"
        },
        customMetadata: opts.customMetadata || {}
      };
      await r2.put(key, bytes, { httpMetadata: metadata });
    },
    async delete(key) {
      try { await r2.delete(key); } catch {}
    }
  };
}

// ── mapLimit：并发受限 map（沿用 1076 行实现）───────────────────────
// 保持请求计数不变，仅移除队列等待，避免单次 invoke 超过 1000 预算
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit || 1, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(runners);
  return out;
}

// ── Export ────────────────────────────────────────────────────────────
module.exports = {
  safeJSONParse,
  safeJSONStringify,
  useKVCache,
  useR2Cache,
  mapLimit
};