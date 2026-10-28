// tests/e2e/run-e2e-cdp.mjs — real-time runner (no --virtual-time-budget, which suspends IDB I/O).
// Serves the repo root, launches headless Chrome with CDP, polls #out until it settles.
// Migrated from __e2e_cdp.mjs (ROOT now derives from import.meta.url; PAGE defaults to /tests/e2e/e2e-host.html).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PAGE = process.env.E2E_PAGE || "/tests/e2e/e2e-host.html";
const TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS || 60000);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".css": "text/css; charset=utf-8" };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const p = path.join(ROOT, url === "/" ? "/index.html" : url);
  fs.readFile(p, (e, buf) => {
    if (e) { res.statusCode = 404; res.end("nf"); return; }
    res.setHeader("Content-Type", TYPES[path.extname(p)] || "application/octet-stream");
    res.end(buf);
  });
});

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

server.listen(0, "127.0.0.1", async () => {
  const port = server.address().port;
  const url = "http://127.0.0.1:" + port + PAGE;
  const profile = path.join(os.tmpdir(), "chr-cdp-" + Date.now());
  const env = { ...process.env };
  delete env.HTTP_PROXY; delete env.HTTPS_PROXY; delete env.ALL_PROXY; delete env.http_proxy; delete env.https_proxy;

  const ch = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--no-proxy-server", "--disable-extensions", "--disable-background-networking",
    "--user-data-dir=" + profile, "--remote-debugging-port=0", "about:blank",
  ], { env });

  let errBuf = "";
  const wsUrl = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("no CDP endpoint in 25s: " + errBuf.slice(-400))), 25000);
    ch.stderr.on("data", (d) => {
      errBuf += d.toString();
      const m = errBuf.match(/ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[0-9a-f-]+/);
      if (m) { clearTimeout(t); resolve(m[0]); }
    });
    ch.on("exit", (c) => { clearTimeout(t); reject(new Error("chrome exited " + c + ": " + errBuf.slice(-400))); });
  });
  console.log("[runner] serving " + url);
  console.log("[runner] CDP " + wsUrl);

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("ws error")); });

  let msgId = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = ++msgId; pending.set(id, { res, rej });
    ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error("cdp timeout " + method)); } }, 20000);
  });

  let sessionId = null, text = "", err = null;
  try {
    const t = await send("Target.createTarget", { url });
    const a = await send("Target.attachToTarget", { targetId: t.targetId, flatten: true });
    sessionId = a.sessionId;
    const deadline = Date.now() + TIMEOUT_MS;
    let stableSince = Date.now(), last = "";
    while (Date.now() < deadline) {
      await sleep(250);
      const r = await send("Runtime.evaluate", { expression: 'document.getElementById("out") ? document.getElementById("out").textContent : "__NO_OUT__"', returnByValue: true }, sessionId);
      text = (r && r.result && r.result.value) || "";
      if (text !== last) { last = text; stableSince = Date.now(); }
      if (/RESULT_END|ONERROR|UNHANDLED_REJECTION|IDB_OPEN_(OK|ERROR|HANG|BLOCKED)|IDB_THROW/.test(text)) break;
      if (Date.now() - stableSince > 12000) break; // no change for 12s -> give up
    }
  } catch (e) { err = e.message; }

  console.log("=== OUT ===");
  console.log(text || "(empty)");
  const r = text.match(/RESULT_START([\s\S]*?)RESULT_END/);
  if (r) {
    const lines = r[1].trim().split("\n");
    const pass = lines.filter((l) => l.startsWith("PASS")).length;
    const fail = lines.filter((l) => l.startsWith("FAIL")).length;
    console.log("SUMMARY: " + pass + " PASS, " + fail + " FAIL");
    if (err) console.log("NOTE: " + err);
    cleanup(fail === 0 && pass > 0 ? 0 : 1);
  } else {
    console.log("SUMMARY: no RESULT block (0 PASS)");
    if (err) console.log("NOTE: " + err);
    cleanup(1);
  }

  function cleanup(code) {
    try { ws.close(); } catch (_) {}
    try { ch.kill("SIGKILL"); } catch (_) {}
    try { server.close(); } catch (_) {}
    setTimeout(() => process.exit(code), 300);
  }
});
