import { API_BASE_URL } from "./config";

// No-account personal-data migration (optional cloud relay).
// The offline createMigrationCode() already produces a self-contained "KV1:"/
// "KV1G:" blob. These helpers ship that blob to the worker for cross-device
// transfer WITHOUT pasting megabytes: mint a one-time token, later fetch the
// blob back and hand it to importMigrationCode(). Errors are thrown as
// descriptive Error objects; callers show them via the migrate.* i18n keys.

function base() {
  // API_BASE_URL carries a trailing slash in config; normalize so joins are safe.
  return API_BASE_URL.endsWith("/") ? API_BASE_URL : API_BASE_URL + "/";
}

/**
 * Store a client migration blob on the worker.
 * @param {string} codeBlob the exact string from createMigrationCode()
 * @returns {Promise<{ ok: boolean, code?: string, expiresAt?: number, error?: string }>}
 */
export async function createRemoteMigrationCode(codeBlob) {
  let r;
  try {
    r = await fetch(`${base()}migrate/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: codeBlob }),
    });
  } catch (e) {
    throw new Error("network");
  }
  const j = await r.json().catch(() => ({ ok: false, error: "bad_response" }));
  if (!j || j.ok !== true) {
    throw new Error(j && j.error ? String(j.error) : "create_failed");
  }
  return j; // { ok, code (mig_ token), expiresAt, ttlSeconds, oneTime, ... }
}

/**
 * Redeem a one-time migration token to retrieve the stored blob.
 * @param {string} token the "mig_..." token from createRemoteMigrationCode()
 * @returns {Promise<{ ok: boolean, code?: string }>} `code` is the KV1:/KV1G: blob
 */
export async function fetchRemoteMigrationCode(token) {
  let r;
  try {
    r = await fetch(`${base()}migrate/${encodeURIComponent(String(token).trim())}`, {
      method: "GET",
    });
  } catch (e) {
    throw new Error("network");
  }
  const j = await r.json().catch(() => ({ ok: false, error: "bad_response" }));
  if (!j || j.ok !== true) {
    throw new Error(j && j.error ? String(j.error) : "fetch_failed");
  }
  return j; // { ok, code (blob), oneTime }
}
