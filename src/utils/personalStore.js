/**
 * personalStore.js — 无需注册的个人数据中心（v1.4 Intelligence）
 *
 * 设计原则
 *  - 零依赖：只用浏览器原生 IndexedDB / WebCrypto，不引入任何第三方库。
 *  - 永不抛错：任何存储失败（隐私模式、配额满、IDB 被禁用）都降级为 no-op，
 *    绝不影响推荐主流程。
 *  - 同步可读：内存镜像 recoMirror 让 loadResultsFromCache() 保持同步签名，
 *    现有 7 处水合调用点无需改成 async。
 *  - 数据属于用户：导出/导入/合并全部在本地完成，不经服务器，不是账号凭证。
 */

const DB_NAME = "kims-video-personal";
const DB_VERSION = 2;
const STORE_RECOS = "recos";
const STORE_SEARCHES = "searches";
const STORE_META = "meta";
const STORE_FAVS = "favorites";

const EXPORT_FORMAT = "kims-video-personal";
const EXPORT_VERSION = 1;
const MAX_SEARCHES = 500;
const MAX_RECOS = 300;
const MAX_FAVS = 5000;

/** sourceId -> 缓存载荷（与 sessionStorage 中存的结构完全一致，可直接水合） */
const recoMirror = new Map();
/** 订阅者，供「我的数据」页面在数据变化时刷新 */
const listeners = new Set();
let dbPromise = null;
let warmedUp = false;

const hasIDB = () => typeof indexedDB !== "undefined";

function emit() {
  for (const fn of listeners) {
    try {
      fn();
    } catch (_) {}
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function uid(prefix = "id") {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch (_) {}
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/* 底层：连接 / 事务 / Promise 包装                                      */
/* ------------------------------------------------------------------ */

function openDB() {
  if (!hasIDB()) return Promise.reject(new Error("indexeddb-unavailable"));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RECOS)) {
        const s = db.createObjectStore(STORE_RECOS, { keyPath: "id" });
        s.createIndex("sourceId", "sourceId", { unique: false });
        s.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SEARCHES)) {
        const s = db.createObjectStore(STORE_SEARCHES, { keyPath: "id" });
        s.createIndex("at", "at", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_FAVS)) {
        const s = db.createObjectStore(STORE_FAVS, { keyPath: "id" });
        s.createIndex("addedAt", "addedAt", { unique: false });
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        try {
          db.close();
        } catch (_) {}
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error("idb-open-failed"));
    req.onblocked = () => reject(new Error("idb-blocked"));
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });

  return dbPromise;
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    try {
      result = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("idb-aborted"));
  });
}

async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/* ------------------------------------------------------------------ */
/* meta                                                               */
/* ------------------------------------------------------------------ */

export async function getMeta(key, fallback = null) {
  try {
    const rec = await withStore(STORE_META, "readonly", (s) => {
      const req = s.get(key);
      const box = { value: fallback };
      req.onsuccess = () => {
        box.value = req.result && req.result.value !== undefined ? req.result.value : fallback;
      };
      return box;
    });
    return rec && rec.value !== undefined ? rec.value : fallback;
  } catch (_) {
    return fallback;
  }
}

export async function setMeta(key, value) {
  try {
    await withStore(STORE_META, "readwrite", (s) => s.put({ key, value, at: Date.now() }));
    return true;
  } catch (_) {
    return false;
  }
}

/** 稳定的本机标识：仅用于区分「同一份数据的另一份副本」，不是账号 */
export async function getDeviceId() {
  let id = await getMeta("deviceId", null);
  if (id) return id;
  id = uid("dev");
  await setMeta("deviceId", id);
  return id;
}

/* ------------------------------------------------------------------ */
/* 推荐快照                                                           */
/* ------------------------------------------------------------------ */

function mirrorKey(sourceId) {
  return sourceId == null ? null : String(sourceId);
}

/** 同步读取内存镜像 —— 让 loadResultsFromCache 保持同步 */
export function peekReco(sourceId) {
  const key = mirrorKey(sourceId);
  if (!key) return null;
  return recoMirror.get(key) || null;
}

/**
 * 启动时把持久化的推荐全部读进内存镜像。
 * main.jsx 在首次 render 之前 await 它，因此所有水合路径都能同步命中。
 */
export async function warmUp() {
  if (warmedUp) return { ok: true, count: recoMirror.size };
  try {
    const rows = await getAll(STORE_RECOS);
    for (const row of rows) {
      if (row && row.sourceId != null && row.payload) {
        recoMirror.set(String(row.sourceId), row.payload);
      }
    }
    warmedUp = true;
    return { ok: true, count: rows.length };
  } catch (_) {
    warmedUp = true; // 失败也要放行，绝不能卡住首屏
    return { ok: false, count: 0 };
  }
}

/**
 * 写入/更新一条推荐快照。
 * payload 必须与 sessionStorage 里的形状一致：
 *   { primaryMovie, secondaryMovie, recommendations, everShownTitles }
 */
export async function saveReco({ sourceId, payload, locale, modelTag } = {}) {
  if (sourceId == null || !payload) return false;
  const key = String(sourceId);

  // 先更新内存镜像 —— 同步可读，UI 立刻生效
  recoMirror.set(key, payload);

  const now = Date.now();
  const id = `src:${key}`;
  try {
    const existing = await withStore(STORE_RECOS, "readonly", (s) => {
      const req = s.get(id);
      const box = { value: null };
      req.onsuccess = () => {
        box.value = req.result || null;
      };
      return box;
    });
    const createdAt = existing?.value?.createdAt || now;
    const record = {
      id,
      sourceId: Number(sourceId) || sourceId,
      sourceTitle: payload?.primaryMovie?.title || "",
      sourceYear: payload?.primaryMovie?.year || "",
      count: Array.isArray(payload.recommendations) ? payload.recommendations.length : 0,
      payload,
      locale: locale || "zh",
      modelTag: modelTag || "",
      createdAt,
      updatedAt: now,
    };
    await withStore(STORE_RECOS, "readwrite", (s) => s.put(record));
    await trimRecos();
    emit();
    return true;
  } catch (_) {
    return false;
  }
}

async function trimRecos() {
  try {
    const rows = await getAll(STORE_RECOS);
    if (rows.length <= MAX_RECOS) return;
    rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const drop = rows.slice(MAX_RECOS);
    await withStore(STORE_RECOS, "readwrite", (s) => {
      for (const r of drop) s.delete(r.id);
    });
  } catch (_) {}
}

export async function listRecos() {
  try {
    const rows = await getAll(STORE_RECOS);
    return rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (_) {
    return [];
  }
}

export async function getRecoBySource(sourceId) {
  if (sourceId == null) return null;
  try {
    const row = await withStore(STORE_RECOS, "readonly", (s) => {
      const req = s.get(`src:${sourceId}`);
      const box = { value: null };
      req.onsuccess = () => {
        box.value = req.result || null;
      };
      return box;
    });
    return row?.value || null;
  } catch (_) {
    return null;
  }
}

export async function deleteReco(id) {
  try {
    const row = await withStore(STORE_RECOS, "readonly", (s) => {
      const req = s.get(id);
      const box = { value: null };
      req.onsuccess = () => {
        box.value = req.result || null;
      };
      return box;
    });
    await withStore(STORE_RECOS, "readwrite", (s) => s.delete(id));
    const src = row?.value?.sourceId;
    if (src != null) recoMirror.delete(String(src));
    emit();
    return true;
  } catch (_) {
    return false;
  }
}

export async function clearRecos() {
  try {
    await withStore(STORE_RECOS, "readwrite", (s) => s.clear());
    recoMirror.clear();
    emit();
    return true;
  } catch (_) {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* 搜索历史                                                           */
/* ------------------------------------------------------------------ */

export async function addSearch({ scope = "ai_search", query, tmdbId = null } = {}) {
  const q = (query || "").trim();
  if (!q) return false;
  const now = Date.now();
  try {
    const rows = await getAll(STORE_SEARCHES);
    // 60 秒内同 scope 同词不重复记
    const dup = rows.find(
      (r) => r.scope === scope && r.query === q && now - (r.at || 0) < 60000
    );
    if (dup) return true;
    await withStore(STORE_SEARCHES, "readwrite", (s) =>
      s.put({ id: uid("q"), scope, query: q, tmdbId, at: now })
    );
    if (rows.length + 1 > MAX_SEARCHES) {
      const sorted = rows.sort((a, b) => (a.at || 0) - (b.at || 0));
      const drop = sorted.slice(0, rows.length + 1 - MAX_SEARCHES);
      await withStore(STORE_SEARCHES, "readwrite", (s) => {
        for (const r of drop) s.delete(r.id);
      });
    }
    emit();
    return true;
  } catch (_) {
    return false;
  }
}

export async function listSearches({ limit = 50 } = {}) {
  try {
    const rows = await getAll(STORE_SEARCHES);
    return rows.sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, limit);
  } catch (_) {
    return [];
  }
}

export async function deleteSearch(id) {
  try {
    await withStore(STORE_SEARCHES, "readwrite", (s) => s.delete(id));
    emit();
    return true;
  } catch (_) {
    return false;
  }
}

export async function clearSearches() {
  try {
    await withStore(STORE_SEARCHES, "readwrite", (s) => s.clear());
    emit();
    return true;
  } catch (_) {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* 星标收藏（favorites，v2 新增）                                       */
/* 条目形状：{ id, type, title, titleEn?, year?, poster?, source,        */
/*            tmdbId?/mbid?, addedAt }；id 为稳定键（tmdb:xx / mbid:xx）。*/
/* ------------------------------------------------------------------ */

export async function listFavorites() {
  try {
    const rows = await getAll(STORE_FAVS);
    rows.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    return rows;
  } catch (_) {
    return [];
  }
}

/** 收藏则移除、未收藏则加入；返回当前是否为“已收藏”。永不抛错。 */
export async function toggleFavorite(entry) {
  try {
    if (!entry || !entry.id) return false;
    const existing = await getAll(STORE_FAVS);
    if (existing.some((f) => f.id === entry.id)) {
      await withStore(STORE_FAVS, "readwrite", (s) => s.delete(entry.id));
      emit();
      return false;
    }
    if (existing.length >= MAX_FAVS) {
      // 容量保护：删掉最旧一条再写入（保持上限）
      const oldest = existing.reduce(
        (min, f) => ((f.addedAt || 0) < (min.addedAt || 0) ? f : min),
        existing[0]
      );
      await withStore(STORE_FAVS, "readwrite", (s) => {
        s.delete(oldest.id);
        s.put({ ...entry, addedAt: Date.now() });
      });
    } else {
      await withStore(STORE_FAVS, "readwrite", (s) =>
        s.put({ ...entry, addedAt: entry.addedAt || Date.now() })
      );
    }
    emit();
    return true;
  } catch (_) {
    return false;
  }
}

export async function removeFavorite(id) {
  try {
    await withStore(STORE_FAVS, "readwrite", (s) => s.delete(id));
    emit();
    return true;
  } catch (_) {
    return false;
  }
}

export async function clearFavorites() {
  try {
    await withStore(STORE_FAVS, "readwrite", (s) => s.clear());
    emit();
    return true;
  } catch (_) {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* 统计                                                               */
/* ------------------------------------------------------------------ */

export async function getStats() {
  const [recos, searches, favs] = await Promise.all([
    listRecos(),
    listSearches({ limit: 1000 }),
    listFavorites(),
  ]);
  let usage = null;
  let quota = null;
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      usage = est.usage ?? null;
      quota = est.quota ?? null;
    }
  } catch (_) {}
  return {
    recoCount: recos.length,
    searchCount: searches.length,
    favCount: favs.length,
    lastRecoAt: recos[0]?.updatedAt || null,
    usage,
    quota,
    persisted: await isPersisted(),
  };
}

export async function isPersisted() {
  try {
    if (navigator.storage && navigator.storage.persisted) {
      return await navigator.storage.persisted();
    }
  } catch (_) {}
  return false;
}

/** 请求「持久化存储」——降低浏览器在空间紧张时清掉数据的概率 */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist();
    }
  } catch (_) {}
  return false;
}

/* ------------------------------------------------------------------ */
/* 加密（可选）                                                        */
/* ------------------------------------------------------------------ */

const b64 = {
  encode(bytes) {
    let s = "";
    const arr = new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
    return btoa(s);
  },
  decode(str) {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  },
};

async function deriveKey(passphrase, salt, iterations = 150000) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/* ------------------------------------------------------------------ */
/* 导出 / 导入 / 合并                                                  */
/* ------------------------------------------------------------------ */

async function collectAll() {
  const [recos, searches, favorites, deviceId] = await Promise.all([
    listRecos(),
    listSearches({ limit: 1000 }),
    listFavorites(),
    getDeviceId(),
  ]);
  const prefs = await getMeta("prefs", {});
  return { recos, searches, favorites, meta: { deviceId, prefs } };
}

/**
 * 导出全部个人数据。
 * @param {{passphrase?: string}} opts 传 passphrase 则用 AES-GCM 加密
 * @returns {Promise<{json: string, bytes: number, encrypted: boolean}>}
 */
export async function exportAll({ passphrase } = {}) {
  const { recos, searches, favorites, meta } = await collectAll();
  const base = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    app: "kims-video",
    exportedAt: new Date().toISOString(),
    counts: { recos: recos.length, searches: searches.length, favorites: favorites.length },
  };

  if (passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    const plain = new TextEncoder().encode(JSON.stringify({ recos, searches, favorites, meta }));
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
    const env = {
      ...base,
      encrypted: true,
      kdf: { name: "PBKDF2", hash: "SHA-256", iterations: 150000, salt: b64.encode(salt) },
      iv: b64.encode(iv),
      data: b64.encode(cipher),
    };
    const json = JSON.stringify(env, null, 2);
    await setMeta("lastExport", { at: Date.now(), encrypted: true });
    return { json, bytes: json.length, encrypted: true };
  }

  const env = { ...base, encrypted: false, recos, searches, favorites, meta };
  const json = JSON.stringify(env, null, 2);
  await setMeta("lastExport", { at: Date.now(), encrypted: false });
  return { json, bytes: json.length, encrypted: false };
}

/**
 * 导入并合并。
 * @param {string|object} input 导出的 JSON 字符串或对象
 * @param {{passphrase?: string, mode?: 'merge'|'replace'}} opts
 * @returns {Promise<{ok:boolean, added:number, updated:number, searches:number, error?:string}>}
 */
export async function importAll(input, { passphrase, mode = "merge" } = {}) {
  let env;
  try {
    env = typeof input === "string" ? JSON.parse(input) : input;
  } catch (_) {
    return { ok: false, added: 0, updated: 0, searches: 0, error: "invalid-json" };
  }

  if (!env || env.format !== EXPORT_FORMAT) {
    return { ok: false, added: 0, updated: 0, searches: 0, error: "unknown-format" };
  }

  if (env.encrypted) {
    if (!passphrase) {
      return { ok: false, added: 0, updated: 0, searches: 0, error: "passphrase-required" };
    }
    try {
      const salt = b64.decode(env.kdf.salt);
      const iv = b64.decode(env.iv);
      const key = await deriveKey(passphrase, salt, env.kdf.iterations || 150000);
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        b64.decode(env.data)
      );
      env = { ...env, ...JSON.parse(new TextDecoder().decode(plain)) };
    } catch (_) {
      return { ok: false, added: 0, updated: 0, searches: 0, error: "decrypt-failed" };
    }
  }

  const incomingRecos = Array.isArray(env.recos) ? env.recos : [];
  const incomingSearches = Array.isArray(env.searches) ? env.searches : [];
  const incomingFavs = Array.isArray(env.favorites) ? env.favorites : [];

  if (mode === "replace") {
    await clearRecos();
    await clearSearches();
    await clearFavorites();
  }

  const existing = await listRecos();
  const bySource = new Map(existing.map((r) => [String(r.sourceId), r]));

  let added = 0;
  let updated = 0;
  const toWrite = [];

  for (const inc of incomingRecos) {
    if (!inc || inc.sourceId == null) continue;
    const key = String(inc.sourceId);
    const cur = bySource.get(key);
    if (!cur) {
      toWrite.push({ ...inc, id: inc.id || `src:${key}` });
      added++;
      continue;
    }
    // 保留更新的那份；everShownTitles 取并集，避免重复推荐
    const newer = (inc.updatedAt || 0) > (cur.updatedAt || 0) ? inc : cur;
    const other = newer === inc ? cur : inc;
    const mergedTitles = Array.from(
      new Set([
        ...(newer?.payload?.everShownTitles || []),
        ...(other?.payload?.everShownTitles || []),
      ])
    );
    if (newer === inc) {
      toWrite.push({
        ...inc,
        id: cur.id,
        createdAt: Math.min(inc.createdAt || 0, cur.createdAt || 0) || inc.createdAt,
        payload: {
          ...(inc.payload || {}),
          everShownTitles: mergedTitles,
        },
      });
      updated++;
    } else if (mergedTitles.length !== (cur?.payload?.everShownTitles || []).length) {
      toWrite.push({
        ...cur,
        payload: { ...(cur.payload || {}), everShownTitles: mergedTitles },
      });
      updated++;
    }
  }

  try {
    if (toWrite.length) {
      await withStore(STORE_RECOS, "readwrite", (s) => {
        for (const r of toWrite) s.put(r);
      });
      for (const r of toWrite) {
        if (r.sourceId != null && r.payload) recoMirror.set(String(r.sourceId), r.payload);
      }
    }
  } catch (err) {
    return { ok: false, added: 0, updated: 0, searches: 0, error: "write-failed" };
  }

  // 搜索历史按 id 去重
  let searchAdded = 0;
  let favAdded = 0;
  try {
    const curSearches = mode === "replace" ? [] : await listSearches({ limit: 1000 });
    const seen = new Set(curSearches.map((s) => s.id));
    const addable = incomingSearches.filter((s) => s && s.id && !seen.has(s.id)).slice(0, MAX_SEARCHES);
    if (addable.length) {
      await withStore(STORE_SEARCHES, "readwrite", (s) => {
        for (const r of addable) s.put(r);
      });
      searchAdded = addable.length;
    }
  } catch (_) {}

  // 收藏历史按 id 去重
  try {
    const curFavs = mode === "replace" ? [] : await listFavorites();
    const seenFavs = new Set(curFavs.map((f) => f.id));
    const addableFavs = incomingFavs.filter((f) => f && f.id && !seenFavs.has(f.id)).slice(0, MAX_FAVS);
    if (addableFavs.length) {
      await withStore(STORE_FAVS, "readwrite", (s) => {
        for (const f of addableFavs) s.put({ ...f, addedAt: f.addedAt || Date.now() });
      });
      favAdded = addableFavs.length;
    }
  } catch (_) {}

  // 合并 meta：本机 deviceId 永不覆盖
  try {
    if (env.meta && env.meta.prefs) {
      const localPrefs = (await getMeta("prefs", {})) || {};
      await setMeta("prefs", { ...(env.meta.prefs || {}), ...localPrefs });
    }
    await setMeta("lastImport", { at: Date.now(), added, updated, mode, searches: searchAdded, favorites: favAdded });
  } catch (_) {}

  emit();
  return { ok: true, added, updated, searches: searchAdded, favorites: favAdded };
}

/** 生成一个可读的备份文件名 */
export function backupFileName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `kims-personal-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(
    d.getHours()
  )}${p(d.getMinutes())}.json`;
}

/** 触发浏览器下载 */
export function downloadJSON(json, filename) {
  try {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || backupFileName();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (_) {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* 跨设备迁移码（短时有效，不是账号）                                    */
/* ------------------------------------------------------------------ */

/**
 * 迁移码 = 数据摘要（不落服务器）。这里只做本地压缩编码，
 * 供用户复制到另一台设备粘贴，全程离线。
 */
export async function createMigrationCode({ passphrase } = {}) {
  const { json } = await exportAll({ passphrase });
  try {
    const bytes = new TextEncoder().encode(json);
    // 优先用 CompressionStream，把长 JSON 压短；不支持就原样
    if (typeof CompressionStream !== "undefined") {
      const cs = new CompressionStream("gzip");
      const stream = new Blob([bytes]).stream().pipeThrough(cs);
      const buf = await new Response(stream).arrayBuffer();
      return { code: `KV1G:${b64.encode(new Uint8Array(buf))}`, compressed: true, bytes: json.length };
    }
    return { code: `KV1:${b64.encode(bytes)}`, compressed: false, bytes: json.length };
  } catch (_) {
    return { code: `KV1:${b64.encode(new TextEncoder().encode(json))}`, compressed: false, bytes: json.length };
  }
}

export async function importMigrationCode(code, { passphrase } = {}) {
  const raw = (code || "").trim();
  if (!raw) return { ok: false, added: 0, updated: 0, searches: 0, error: "empty" };
  try {
    if (raw.startsWith("KV1G:")) {
      const gz = b64.decode(raw.slice(5));
      const ds = new DecompressionStream("gzip");
      const stream = new Blob([gz]).stream().pipeThrough(ds);
      const text = await new Response(stream).text();
      return importAll(text, { passphrase });
    }
    if (raw.startsWith("KV1:")) {
      return importAll(new TextDecoder().decode(b64.decode(raw.slice(4))), { passphrase });
    }
    return importAll(raw, { passphrase });
  } catch (_) {
    return { ok: false, added: 0, updated: 0, searches: 0, error: "decode-failed" };
  }
}

/* ------------------------------------------------------------------ */
/* 清空                                                               */
/* ------------------------------------------------------------------ */

export async function wipeAll() {
  try {
    await withStore(STORE_RECOS, "readwrite", (s) => s.clear());
    await withStore(STORE_SEARCHES, "readwrite", (s) => s.clear());
    await withStore(STORE_META, "readwrite", (s) => s.clear());
    await withStore(STORE_FAVS, "readwrite", (s) => s.clear());
    recoMirror.clear();
    warmedUp = true;
    emit();
    return true;
  } catch (_) {
    return false;
  }
}

export const personalStore = {
  warmUp,
  peekReco,
  saveReco,
  listRecos,
  getRecoBySource,
  deleteReco,
  clearRecos,
  addSearch,
  listSearches,
  deleteSearch,
  clearSearches,
  listFavorites,
  toggleFavorite,
  removeFavorite,
  clearFavorites,
  getMeta,
  setMeta,
  getDeviceId,
  getStats,
  isPersisted,
  requestPersistence,
  exportAll,
  importAll,
  createMigrationCode,
  importMigrationCode,
  wipeAll,
  backupFileName,
  downloadJSON,
  subscribe,
};

export default personalStore;