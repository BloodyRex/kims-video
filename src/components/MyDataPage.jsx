import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";
import {
  listRecos, listSearches, deleteReco, clearRecos,
  deleteSearch, clearSearches, getStats,
  exportAll, importAll, createMigrationCode, importMigrationCode,
  wipeAll, getDeviceId, requestPersistence, downloadJSON,
} from "../utils/personalStore";
import { createRemoteMigrationCode, fetchRemoteMigrationCode } from "../services/migrationApi";
import SiteFooter from "./SiteFooter";

const ic = (name, cls) => {
  const C = Icons[name] || Icons.Target;
  return <C {...(cls ? { className: cls } : {})} />;
};

function fmtBytes(n) {
  if (n == null) return "—";
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  return (n / 1048576).toFixed(1) + " MB";
}
function fmtTime(ts, locale) {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleString(locale); } catch { return ""; }
}

export default function MyDataPage() {
  const { t, locale } = useLocale();
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState({ recoCount: 0, searchCount: 0, usage: null, quota: null, persisted: false });
  const [recos, setRecos] = useState([]);
  const [searches, setSearches] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [exportPass, setExportPass] = useState("");
  const [importPass, setImportPass] = useState("");
  const [migratePass, setMigratePass] = useState("");
  const [migrateCode, setMigrateCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 7000);
  };

  const reload = useCallback(async () => {
    const [s, r, q, d] = await Promise.all([
      getStats(), listRecos(), listSearches({ limit: 200 }), getDeviceId(),
    ]);
    setStats(s); setRecos(r); setSearches(q); setDeviceId(d); setReady(true);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const Card = ({ icon, title, action, children }) => (
    <section className="bg-white border-4 border-black shadow-[6px_6px_0_0_#000] mb-5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#ffff00] border-b-4 border-black">
        {icon ? <span className="text-black shrink-0">{ic(icon)}</span> : null}
        <h2 className="pixel-font text-[11px] sm:text-xs font-black uppercase tracking-wider flex-1">{title}</h2>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );

  const doRequestPersistence = async () => {
    try {
      const ok = await requestPersistence();
      flash("ok", t("mydata.persist." + (ok ? "ok" : "fail")));
      reload();
    } catch { flash("err", t("mydata.persist.fail")); }
  };
  const doDeleteReco = async (id) => {
    if (!window.confirm(t("mydata.delete.confirm"))) return;
    await deleteReco(id); if (expanded === id) setExpanded(null); reload();
  };
  const doClearRecos = async () => {
    if (!window.confirm(t("mydata.clear_recos.confirm"))) return;
    await clearRecos(); setExpanded(null); reload();
  };
  const doDeleteSearch = async (id) => {
    if (!window.confirm(t("mydata.delete.confirm"))) return;
    await deleteSearch(id); reload();
  };
  const doClearSearches = async () => {
    if (!window.confirm(t("mydata.clear_searches.confirm"))) return;
    await clearSearches(); reload();
  };
  const doExport = async () => {
    setBusy(true);
    try {
      const res = await exportAll({ passphrase: exportPass || undefined });
      downloadJSON(res.json);
      flash("ok", t("mydata.export.ok", { recos: stats.recoCount, searches: stats.searchCount }));
    } catch { flash("err", t("mydata.migrate.bad_code")); }
    setBusy(false);
  };
  const doImportFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const res = await importAll(text, { passphrase: importPass || undefined, mode: "merge" });
      if (res.ok) { flash("ok", t("mydata.import.ok", { added: res.added, updated: res.updated, searches: res.searches })); reload(); }
      else flash("err", res.error || t("mydata.migrate.bad_code"));
    } catch { flash("err", t("mydata.migrate.bad_code")); }
    setBusy(false);
    e.target.value = "";
  };
  const doImportCode = async () => {
    const code = migrateCode.trim();
    if (!code) return;
    setBusy(true);
    try {
      let payload = code;
      if (code.startsWith("mig_")) {
        const r = await fetchRemoteMigrationCode(code);
        payload = r.code;
      }
      const res = await importMigrationCode(payload, { passphrase: migratePass || undefined });
      if (res.ok) { flash("ok", t("mydata.import.ok", { added: res.added, updated: res.updated, searches: res.searches })); setMigrateCode(""); setCopied(false); reload(); }
      else flash("err", res.error || t("mydata.migrate.bad_code"));
    } catch (e) {
      if (code.startsWith("mig_")) flash("err", t("mydata.migrate.remote_fail", { msg: (e && e.message) || "network" }));
      else flash("err", t("mydata.migrate.bad_code"));
    }
    setBusy(false);
  };
  const doMigrate = async () => {
    try {
      const res = await createMigrationCode({ passphrase: migratePass || undefined });
      setMigrateCode(res.code); setCopied(false);
      flash("ok", t("mydata.migrate.done"));
    } catch { flash("err", t("mydata.migrate.bad_code")); }
  };
  const doMigrateRemote = async () => {
    setBusy(true);
    try {
      const local = await createMigrationCode({ passphrase: migratePass || undefined });
      const res = await createRemoteMigrationCode(local.code);
      setMigrateCode(res.code); setCopied(false);
      flash("ok", t("mydata.migrate.remote_done"));
    } catch (e) {
      flash("err", t("mydata.migrate.remote_fail", { msg: (e && e.message) || "network" }));
    }
    setBusy(false);
  };
  const doCopyCode = async () => {
    if (!migrateCode) return;
    try { await navigator.clipboard.writeText(migrateCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setCopied(false); }
  };
  const doWipe = async () => {
    if (!window.confirm(t("mydata.danger.confirm"))) return;
    await wipeAll(); setMigrateCode(""); reload();
    flash("ok", t("mydata.danger.done"));
  };

  return (
    <div className={`min-h-screen graffiti-bg text-black pb-32 locale-${locale}`}>
      <header className="relative z-10 flex flex-col items-center py-4 mb-4 bg-black border-b-8 border-[#ff00ff] shadow-[0_8px_0_0_rgba(0,255,255,1)]">
        <Link to="/" className="flex items-center justify-center hover:opacity-80 transition-opacity">
          <div className="bg-[#ffff00] p-2 border-4 border-black mr-4 transform -rotate-6">
            <span className="text-black transform rotate-90"><Icons.Play /></span>
          </div>
          <h1 className="text-lg sm:text-2xl font-black text-white pixel-font uppercase tracking-widest drop-shadow-[4px_4px_0_#ff00ff] whitespace-nowrap" style={{ fontFamily: "'Press Start 2P','Courier New',Courier,monospace" }}>
            KIM'S <span className="text-[#00ffff]">VIDEO</span>
          </h1>
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-4">
        <button onClick={() => window.history.back()} className="pixel-font text-[10px] font-bold border-4 border-black bg-white px-3 py-2 shadow-[3px_3px_0_0_#000] mb-4 hover:-translate-y-0.5 transition-transform inline-flex items-center gap-1">
          {t("mydata.back")}
        </button>

        <h1 className="pixel-font text-lg sm:text-2xl font-black text-black uppercase tracking-wider mb-1 drop-shadow-[3px_3px_0_#ff00ff]">{t("mydata.title")}</h1>
        <p className="text-gray-600 text-xs sm:text-sm mb-5 max-w-2xl">{t("mydata.subtitle")}</p>

        {msg && (
          <div className={`border-4 border-black shadow-[4px_4px_0_0_#000] px-3 py-2 mb-4 text-xs font-bold ${msg.type === "ok" ? "bg-[#00ffff]" : "bg-[#ff00ff] text-white"}`}>
            {msg.text}
          </div>
        )}

        <Card icon="Info" title={t("mydata.stats.title")}>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="border-4 border-black bg-white p-2 shadow-[3px_3px_0_0_#000]">
              <div className="pixel-font text-xl sm:text-2xl font-black text-[#ff00ff]">{stats.recoCount}</div>
              <div className="text-[10px] pixel-font font-bold">{t("mydata.stats.recos")}</div>
            </div>
            <div className="border-4 border-black bg-white p-2 shadow-[3px_3px_0_0_#000]">
              <div className="pixel-font text-xl sm:text-2xl font-black text-[#00ffff]">{stats.searchCount}</div>
              <div className="text-[10px] pixel-font font-bold">{t("mydata.stats.searches")}</div>
            </div>
            <div className="border-4 border-black bg-white p-2 shadow-[3px_3px_0_0_#000]">
              <div className="text-xs sm:text-sm font-bold">{fmtBytes(stats.usage)}</div>
              <div className="text-[10px] text-gray-500 font-bold">{t("mydata.stats.size")}{stats.quota ? " / " + fmtBytes(stats.quota) : ""}</div>
            </div>
            <div className="border-4 border-black bg-white p-2 shadow-[3px_3px_0_0_#000]">
              <div className={`text-xs sm:text-sm font-black ${stats.persisted ? "text-green-600" : "text-red-600"}`}>{stats.persisted ? t("mydata.stats.persisted") : t("mydata.stats.not_persisted")}</div>
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap gap-2 mb-5">
          <span className="pixel-font text-[11px] font-bold border-4 border-black bg-[#00ffff] px-3 py-2 shadow-[4px_4px_0_0_#000]">
            <span className="inline-flex items-center gap-1">{ic("Target")}{t("panel.persist.on")}</span>
          </span>
        </div>

        <Card icon="Film" title={`${t("mydata.recos.title")}${recos.length ? " · " + recos.length : ""}`}
          action={recos.length ? (
            <button onClick={doClearRecos} className="pixel-font text-[10px] font-bold border-2 border-black px-2 py-1 bg-[#ff00ff] text-white hover:opacity-80 transition-opacity shrink-0">{t("mydata.recos.clear")}</button>
          ) : null}>
          {!ready ? (
            <div className="py-6 text-center text-gray-400"><span className="inline-block animate-spin">{ic("Loader2", "w-5 h-5")}</span></div>
          ) : recos.length === 0 ? (
            <div className="py-6 text-center text-gray-400">
              <div className="mb-3 flex justify-center opacity-30">{ic("Film", "w-9 h-9")}</div>
              <div className="pixel-font text-xs">{t("mydata.recos.empty")}</div>
            </div>
          ) : (
            <div className="divide-y divide-black/15 max-h-[55vh] overflow-y-auto">
              {recos.map((r) => {
                const picks = (r.payload && r.payload.recommendations) || [];
                const open = expanded === r.id;
                return (
                  <div key={r.id} className="py-2">
                    <div className="flex items-start gap-2">
                      <span className="text-[#ff00ff] mt-0.5 shrink-0">{ic("Film", "w-4 h-4")}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-sm sm:text-base truncate">{r.sourceTitle || "—"}</div>
                        <div className="text-[10px] text-gray-500 font-bold">{[r.sourceYear, t("mydata.recos.count", { n: r.count || 0 }), fmtTime(r.updatedAt, locale)].filter(Boolean).join(" · ")}</div>
                      </div>
                      <button onClick={() => setExpanded(open ? null : r.id)} aria-label={open ? t("mydata.recos.collapse") : t("mydata.recos.expand")} className="shrink-0 text-gray-400 hover:text-black">{ic("ChevronRight", open ? "rotate-90 w-4 h-4 transition-transform" : "w-4 h-4 transition-transform")}</button>
                      <button onClick={() => doDeleteReco(r.id)} aria-label={t("mydata.recos.delete")} className="shrink-0 text-red-500 hover:text-red-700 text-lg font-black leading-none px-1">✕</button>
                    </div>
                    {open && picks.length > 0 && (
                      <div className="mt-2 ml-6 space-y-1">
                        {picks.map((p, i) => (
                          <div key={(p && p.id != null ? p.id : i)} className="text-xs text-[#008888] truncate">
                            {i + 1}. {(p && (p.title || p.name)) || "—"}{p && p.year ? ` (${p.year})` : ""}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card icon="Search" title={t("mydata.searches.title")}
          action={searches.length ? (
            <button onClick={doClearSearches} className="pixel-font text-[10px] font-bold border-2 border-black px-2 py-1 bg-[#ff00ff] text-white hover:opacity-80 transition-opacity shrink-0">{t("mydata.searches.clear")}</button>
          ) : null}>
          {searches.length === 0 ? (
            <div className="py-6 text-center text-gray-400">
              <div className="mb-3 flex justify-center opacity-30">{ic("Search", "w-9 h-9")}</div>
              <div className="pixel-font text-xs">{t("mydata.searches.empty")}</div>
            </div>
          ) : (
            <div className="divide-y divide-black/15 max-h-[40vh] overflow-y-auto">
              {searches.map((s) => (
                <div key={s.id} className="flex items-center gap-2 py-2">
                  <span className="text-[#00cccc] shrink-0">{ic("Search", "w-4 h-4")}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{s.query}</div>
                    <div className="text-[10px] text-gray-500">{fmtTime(s.at, locale)}</div>
                  </div>
                  <button onClick={() => doDeleteSearch(s.id)} aria-label={t("mydata.searches.clear")} className="shrink-0 text-red-500 hover:text-red-700 text-lg font-black leading-none px-1">✕</button>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card icon="FileText" title={t("mydata.export.title")}>
          <p className="text-xs text-gray-600 mb-3">{t("mydata.export.desc")}</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="password" value={exportPass} onChange={(e) => setExportPass(e.target.value)} placeholder={t("mydata.export.pass_ph")}
              className="flex-1 border-4 border-black bg-white px-3 py-2 text-sm focus:outline-none focus:ring-4 ring-[#00ffff]" />
            <button onClick={doExport} disabled={busy} className="pixel-font text-[11px] font-bold border-4 border-black bg-[#ffff00] px-3 py-2 shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0_0_#000] transition-all disabled:opacity-40 shrink-0">
              {busy ? <span className="inline-flex items-center gap-1">{ic("Loader2", "w-4 h-4 animate-spin")}{t("mydata.export.btn")}</span> : t("mydata.export.btn")}
            </button>
          </div>
        </Card>

        <Card icon="FileText" title={t("mydata.import.title")}>
          <p className="text-xs text-gray-600 mb-3">{t("mydata.import.desc")}</p>
          <input type="password" value={importPass} onChange={(e) => setImportPass(e.target.value)} placeholder={t("mydata.import.pass_ph")}
            className="w-full border-4 border-black bg-white px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-4 ring-[#00ffff]" />
          <label className="pixel-font text-[11px] font-bold border-4 border-black bg-[#00ffff] px-3 py-2 shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0_0_#000] transition-all block text-center cursor-pointer">
            {t("mydata.import.file")}
            <input type="file" accept="application/json,.json" onChange={doImportFile} className="hidden" />
          </label>
        </Card>

        <Card icon="Share2" title={t("mydata.migrate.title")}>
          <p className="text-xs text-gray-600 mb-3">{t("mydata.migrate.desc")}</p>
          <input type="password" value={migratePass} onChange={(e) => setMigratePass(e.target.value)} placeholder={t("mydata.import.pass_ph")}
            className="w-full border-4 border-black bg-white px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-4 ring-[#00ffff]" />
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <button onClick={doMigrate} className="pixel-font text-[11px] font-bold border-4 border-black bg-[#ffff00] px-3 py-2 shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0_0_#000] transition-all">{t("mydata.migrate.gen")}</button>
              <button onClick={doMigrateRemote} disabled={busy} className="pixel-font text-[11px] font-bold border-4 border-black bg-[#00ccff] px-3 py-2 shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0_0_#000] transition-all disabled:opacity-40">{t("mydata.migrate.remote_code")}</button>
              {migrateCode && (
                <>
                  <button onClick={doCopyCode} className="pixel-font text-[11px] font-bold border-4 border-black bg-[#00ffff] px-3 py-2 shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0_0_#000] transition-all">{copied ? t("mydata.migrate.copied") : t("mydata.migrate.copy")}</button>
                  <button onClick={doImportCode} disabled={busy} className="pixel-font text-[11px] font-bold border-4 border-black bg-[#ff00ff] text-white px-3 py-2 shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0_0_#000] transition-all disabled:opacity-40">{t("mydata.import.btn")}</button>
                </>
              )}
            </div>
            <p className="text-[10px] text-gray-500 mb-2">{t("mydata.migrate.remote_hint")}</p>
            <textarea value={migrateCode} onChange={(e) => setMigrateCode(e.target.value)} rows={3} placeholder={t("mydata.import.paste_ph")}
              className="w-full border-4 border-black bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:ring-4 ring-[#00ffff]" />
            {migrateCode ? (
              <div className="text-[10px] text-gray-500 font-bold flex items-center justify-between">
                <span>{t("mydata.migrate.len", { n: migrateCode.length })}</span>
              </div>
            ) : null}
          </div>
        </Card>

        <Card title={t("mydata.danger.title")}>
          <p className="text-xs text-gray-600 mb-3">{t("mydata.danger.desc")}</p>
          <button onClick={doWipe} disabled={busy} className="pixel-font text-[11px] font-bold border-4 border-black bg-red-500 text-white px-3 py-2 shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0_0_#000] transition-all disabled:opacity-40">{t("mydata.danger.btn")}</button>
        </Card>
        <SiteFooter />
      </div>
    </div>
  );
}
