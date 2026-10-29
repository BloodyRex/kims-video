import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "../i18n";
import { Icons } from "./Icons";
import { posterProxy } from "../utils/url";
import {
  getStats,
  getDeviceId,
  listRecos,
  listFavorites,
  removeFavorite,
  deleteReco,
  createMigrationCode,
  importMigrationCode,
  wipeAll,
  subscribe,
} from "../utils/personalStore";
import { createRemoteMigrationCode, fetchRemoteMigrationCode } from "../services/migrationApi";
import { IntelDetailModal } from "./Cards";

/**
 * MyDataPanel — 主页（开屏四宫格页）最下方的「我的数据」大框（2026-10-29）
 *
 * 设计口径（Rex）：
 *  - 持久化存储对所有用户默认开启，页面上不再出现开关按钮；
 *  - 不再走 footer 入口，直接内嵌在主页最下方，沿用主页大按钮框的边框 / 硬阴影 / 像素字；
 *  - 顺序固定：我收藏的卡片 → 我的推荐历史 → 存储概览 → 一左一右「转移数据 / 清除数据」；
 *  - 转移 = 二选一弹框（生成迁移码 / 粘贴导入），清除 = 确认 + 返回。
 */

function fmtBytes(n) {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

function fmtTime(ts, locale) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return "";
  }
}

/* 收藏卡片的取消收藏点击处理：先阻断冒泡（否则会连带触发详情弹框），
   再把收藏 id 交给上层。导出成纯函数，方便在无 DOM 环境下断言行为。 */
export function favoriteRemoveHandler(fav, onRemove) {
  return (e) => {
    e.stopPropagation();
    onRemove(fav.id);
  };
}

/* 收藏卡片：可点开的详情按钮 + 平级的取消收藏按钮。
   两个按钮必须是兄弟节点 —— 若把 ✕ 放进详情按钮内部，点击 ✕ 会同时冒泡触发详情。 */
export function FavoriteCard({ fav, removeLabel, onOpen, onRemove }) {
  const poster = posterProxy(fav.poster || "");
  return (
    <div className="relative group border-4 border-black bg-[#111] shadow-[4px_4px_0_0_#ffff00] hover:translate-y-0.5 hover:shadow-[3px_3px_0_0_#ffff00] active:translate-y-1 active:shadow-none transition-all">
      <button
        type="button"
        onClick={onOpen}
        aria-label={fav.title || "—"}
        className="block w-full text-left cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffff00]"
      >
        <div className="relative h-28 sm:h-36 w-full overflow-hidden bg-[#1a1a1a]">
          {poster ? (
            <img src={poster} alt={fav.title || ""} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#ffff00]">
              <Icons.Film className="w-6 h-6" />
            </div>
          )}
        </div>
        <div className="px-1.5 py-1">
          <div className="text-[10px] sm:text-xs font-bold truncate text-white">{fav.title || "—"}</div>
          <div className="text-[9px] text-gray-200 font-mono">{fav.year || ""}</div>
        </div>
      </button>
      <button
        type="button"
        onClick={favoriteRemoveHandler(fav, onRemove)}
        aria-label={removeLabel}
        title={removeLabel}
        className="absolute top-1 right-1 w-6 h-6 bg-black/80 border-2 border-white text-white text-xs font-black leading-none flex items-center justify-center hover:bg-[#ff0055] transition-colors"
      >
        ✕
      </button>
    </div>
  );
}

const PixelSection = ({ icon, title, right, children }) => (
  <div className="mt-6">
    <div className="flex items-end justify-between gap-3 mb-3 border-b-4 border-white/15 pb-2">
      <h4 className="flex items-center gap-2 text-sm sm:text-lg font-black uppercase tracking-wider pixel-font text-white">
        <span className="text-[#ffff00]">{icon}</span>
        {title}
      </h4>
      {right}
    </div>
    {children}
  </div>
);

const MyDataPanel = () => {
  const { t, locale } = useLocale();
  const zh = locale === "zh";

  const [stats, setStats] = useState(null);
  const [recos, setRecos] = useState([]);
  const [favs, setFavs] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const [modal, setModal] = useState(null); // "transfer" | "clear" | null
  const [descOpen, setDescOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState(null); // { ok:boolean, text:string }
  const [detailFav, setDetailFav] = useState(null);

  const load = useCallback(async () => {
    const [s, r, f, d] = await Promise.all([
      getStats().catch(() => null),
      listRecos().catch(() => []),
      listFavorites().catch(() => []),
      getDeviceId().catch(() => ""),
    ]);
    setStats(s);
    setRecos(r || []);
    setFavs(f || []);
    setDeviceId(d || "");
    setReady(true);
  }, []);

  useEffect(() => {
    load();
    const un = subscribe(() => load());
    return typeof un === "function" ? un : undefined;
  }, [load]);

  // 弹框打开时锁滚动 + Esc 关闭
  useEffect(() => {
    if (!modal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [modal]);

  const openTransfer = () => {
    setModal("transfer");
    setMsg(null);
    setCopied(false);
  };
  const openClear = () => {
    setModal("clear");
    setMsg(null);
  };

  const genCode = async () => {
    setBusy(true);
    setMsg(null);
    try {
      // Step 1: build local blob (always needed; remote caller takes this as input)
      const local = await createMigrationCode();
      const localCode = local?.code || "";
      if (!localCode) {
        setMsg({ ok: false, text: t("mydata.migrate.bad_code") });
        return;
      }
      // Step 2: try cloud relay → returns short 10-char token on success
      try {
        const res = await createRemoteMigrationCode(localCode);
        setCode(res?.code || localCode);
        setMsg({ ok: true, text: t("panel.transfer.done_short") });
        return;
      } catch (_) {
        // fall through to local fallback
      }
      // Step 3: fallback — display long offline blob, surface notice
      setCode(localCode);
      setMsg({ ok: false, text: `${t("mydata.migrate.fallback")}。${t("panel.transfer.done_short")}` });
    } catch (_) {
      setMsg({ ok: false, text: t("mydata.migrate.bad_code") });
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch (_) {
      const ta = document.getElementById("mydata-code-out");
      if (ta) {
        ta.select();
        try {
          document.execCommand("copy");
        } catch (_) {}
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const doImport = async () => {
    if (!paste.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const trimmed = paste.trim();
      // Cloud short token (10 uppercase chars) or mig_ prefix → fetch the real blob first
      const isShortToken = /^[A-Z0-9]{10}$/.test(trimmed) || trimmed.startsWith("mig_");
      const blobToImport = isShortToken ? (await fetchRemoteMigrationCode(trimmed))?.code || trimmed : trimmed;
      const res = await importMigrationCode(blobToImport);
      if (res && res.ok) {
        setMsg({
          ok: true,
          text: t("panel.import.ok", {
            added: res.added || 0,
            updated: res.updated || 0,
            searches: res.searches || 0,
            favorites: res.favorites || 0,
          }),
        });
        setPaste("");
        await load();
      } else {
        setMsg({ ok: false, text: t("mydata.import.fail", { error: (res && res.error) || "invalid" }) });
      }
    } catch (_) {
      setMsg({ ok: false, text: t("mydata.migrate.bad_code") });
    } finally {
      setBusy(false);
    }
  };

  const doWipe = async () => {
    setBusy(true);
    try {
      await wipeAll();
      await load();
      setModal(null);
      setMsg({ ok: true, text: t("panel.clear.done") });
    } catch (_) {
      setMsg({ ok: false, text: t("mydata.migrate.bad_code") });
    } finally {
      setBusy(false);
    }
  };

  const favCount = favs.length;
  const recoCount = recos.length;

  const favTile = useMemo(
      () => (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
          {favs.map((f) => (
            <FavoriteCard
              key={f.id}
              fav={f}
              removeLabel={t("panel.favs.remove")}
              onOpen={() => setDetailFav(f)}
              onRemove={(id) => removeFavorite(id)}
            />
          ))}
        </div>
      ),
      [favs, t]
    );

  return (
    <section
      className="mt-10 mb-6 border-4 border-[#ff00ff] bg-black text-white"
      style={{ boxShadow: "12px 12px 0 0 #00ffff" }}
      aria-label={t("panel.title")}
    >
      {/* 标题条 —— 对齐电影节 banner 区块：品红外框 + 白色主标题(品红硬阴影) + 白色副标题 */}
      <div className="relative px-4 py-3 md:px-6 md:py-4 border-b-4 border-[#ff00ff]/40">
        <div className="flex items-start gap-3 min-w-0">
          <span className="font-mono text-xs px-2 py-1 border-2 border-black bg-[#ff00ff] text-white font-black shrink-0">SEC.05</span>
          <div className="min-w-0">
            <div className="flex items-start gap-2">
              <h3 className="text-3xl md:text-4xl font-black uppercase tracking-tight pixel-font text-white drop-shadow-[3px_3px_0_#ff00ff]">{t("panel.title")}</h3>
              <div className="sm:relative -mt-1">
                <button
                  onClick={isTouch ? () => setDescOpen(!descOpen) : undefined}
                  onMouseEnter={!isTouch ? () => setIsHovered(true) : undefined}
                  onMouseLeave={!isTouch ? () => setIsHovered(false) : undefined}
                  className="w-4 h-4 sm:w-5 sm:h-5 bg-black border-2 border-[#ffff00] text-[#ffff00] flex items-center justify-center hover:bg-[#ffff00] hover:text-black transition-colors z-20 rounded-full pixel-font shrink-0"
                  style={{ fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace", fontSize: "clamp(6px, 1.6vw, 9px)" }}
                  title={t("app.info")}
                  aria-label={t("app.info")}
                >
                  ?
                </button>
                {(descOpen || isHovered) && (
                  <div className="absolute top-full right-2 mt-1 w-max max-w-[calc(100%_-_1rem)] break-words bg-black/90 border-2 border-[#ffff00] text-[#ffff00] px-2 py-1 text-[10px] sm:text-xs font-bold leading-relaxed drop-shadow-[1px_1px_0_#000] z-30 sm:top-0 sm:right-auto sm:left-full sm:mt-0 sm:ml-1.5 sm:max-w-[min(80vw,360px)]">
                    {t("panel.desc")}
                  </div>
                )}
              </div>
            </div>
            <h4 className="text-sm md:text-base font-bold text-[#ffffff] mt-3 mb-3">{t("panel.subtitle")}</h4>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 md:px-6 md:py-6">
        {!ready ? (
          <div className="py-10 flex justify-center text-[#ffff00]">
            <span className="inline-block animate-spin">
              <Icons.Loader2 className="w-6 h-6" />
            </span>
          </div>
        ) : (
          <>
            {/* 1. 我收藏的卡片 */}
            <PixelSection
              icon={<Icons.Star className="w-4 h-4" fill="#ffff00" stroke="#ffff00" />}
              title={t("panel.favs.title")}
              right={
                <span className="text-[10px] sm:text-xs font-black text-[#00ffff] bg-black border-2 border-[#00ffff] px-2 py-0.5 whitespace-nowrap">
                  {t("panel.favs.count", { n: favCount })}
                </span>
              }
            >
              {favCount === 0 ? (
                <p className="py-6 text-center text-xs sm:text-sm text-gray-200 font-bold">{t("panel.favs.empty")}</p>
              ) : (
                favTile
              )}
            </PixelSection>

            {/* 2. 我的推荐历史 */}
            <PixelSection
              icon={<Icons.Film className="w-4 h-4" />}
              title={t("panel.recos.title")}
              right={
                <span className="text-[10px] sm:text-xs font-black text-[#00ffff] bg-black border-2 border-[#00ffff] px-2 py-0.5 whitespace-nowrap">
                  {recoCount}
                </span>
              }
            >
              {recoCount === 0 ? (
                <p className="py-6 text-center text-xs sm:text-sm text-gray-200 font-bold">{t("panel.recos.empty")}</p>
              ) : (
                <div className="divide-y divide-white/15 max-h-[46vh] overflow-y-auto pr-1">
                  {recos.map((r) => {
                    const picks = (r.payload && r.payload.recommendations) || [];
                    const open = expanded === r.id;
                    return (
                      <div key={r.id} className="py-2">
                        <div className="flex items-start gap-2">
                          <span className="text-[#ff00ff] mt-0.5 shrink-0 text-base leading-none">
                            {(r.payload?.primaryMovie?.type === "tv" || r.payload?.primaryMovie?.mediaType === "tv") ? "📺" : "🎬"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-xs sm:text-base truncate">{r.sourceTitle || "—"}</div>
                            <div className="text-[10px] text-gray-200 font-bold">
                              {[r.sourceYear, t("mydata.recos.count", { n: r.count || picks.length || 0 }), fmtTime(r.updatedAt, locale)]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>
                          {picks.length > 0 && (
                            <button
                              onClick={() => setExpanded(open ? null : r.id)}
                              aria-label={open ? t("mydata.recos.collapse") : t("mydata.recos.expand")}
                              className={`shrink-0 text-gray-200 hover:text-[#ffff00] transition-colors ${open ? "rotate-90" : ""}`}
                            >
                              <Icons.ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteReco(r.id)}
                            aria-label={t("mydata.recos.delete")}
                            className="shrink-0 text-[#ff0055] hover:text-white text-lg font-black leading-none px-1"
                            onTouchStart={(e) => {
                              if (window.innerWidth < 768) {
                                e.preventDefault();
                                const id = r.id;
                                setTimeout(() => deleteReco(id), 200);
                              }
                            }}
                          >
                            ✕
                          </button>
                        </div>
                        {open && picks.length > 0 && (
                          <div className="mt-2 ml-6 space-y-1">
                            {picks.map((p, i) => (
                              <div key={p && p.id != null ? p.id : i} className="text-[11px] sm:text-xs text-[#00ffff] truncate">
                                {i + 1}. {(p && (p.title || p.name)) || "—"}
                                {p && p.year ? ` (${p.year})` : ""}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </PixelSection>

            {/* 3. 存储概览 */}
            <PixelSection icon={<Icons.Target className="w-4 h-4" />} title={t("mydata.stats.title")}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="border-4 border-black bg-[#111] p-2.5 shadow-[3px_3px_0_0_#00ffff]">
                  <div className="text-sm sm:text-lg font-black text-white">{favCount}</div>
                  <div className="text-[10px] pixel-font font-bold text-gray-200">{t("panel.favs.short")}</div>
                </div>
                <div className="border-4 border-black bg-[#111] p-2.5 shadow-[3px_3px_0_0_#00ffff]">
                  <div className="text-sm sm:text-lg font-black text-white">{stats?.recoCount ?? recoCount}</div>
                  <div className="text-[10px] pixel-font font-bold text-gray-200">{t("mydata.stats.recos")}</div>
                </div>
                <div className="border-4 border-black bg-[#111] p-2.5 shadow-[3px_3px_0_0_#00ffff]">
                  <div className="text-sm sm:text-lg font-black text-white">
                    {fmtBytes(stats?.usage)}
                    {stats?.quota ? <span className="text-[10px] text-gray-200"> / {fmtBytes(stats.quota)}</span> : null}
                  </div>
                  <div className="text-[10px] pixel-font font-bold text-gray-200">{t("mydata.stats.size")}</div>
                </div>
                <div className="border-4 border-black bg-[#111] p-2.5 shadow-[3px_3px_0_0_#00ffff]">
                  <div className={`text-xs sm:text-sm font-black ${stats?.persisted ? "text-[#00dd00]" : "text-[#ffff00]"}`}>
                    {stats?.persisted ? t("panel.persist.on") : t("panel.persist.pending")}
                  </div>
                  <div className="text-[10px] pixel-font font-bold text-gray-200">{t("panel.persist.label")}</div>
                </div>
              </div>
            </PixelSection>

            {/* 4. 一左一右两个按钮 */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-6">
              <button
                onClick={openTransfer}
                className="border-4 border-black bg-[#ffff00] text-black px-3 py-3 sm:py-4 font-black pixel-font uppercase tracking-wider text-xs sm:text-base shadow-[6px_6px_0_0_#00ffff] hover:translate-y-0.5 hover:shadow-[3px_3px_0_0_#00ffff] active:translate-y-1 active:shadow-none transition-all"
              >
                {t("panel.transfer")}
              </button>
              <button
                onClick={openClear}
                className="border-4 border-black bg-[#ff0055] text-white px-3 py-3 sm:py-4 font-black pixel-font uppercase tracking-wider text-xs sm:text-base shadow-[6px_6px_0_0_#ffff00] hover:translate-y-0.5 hover:shadow-[3px_3px_0_0_#ffff00] active:translate-y-1 active:shadow-none transition-all"
              >
                {t("panel.clear")}
              </button>
            </div>

            {msg && !modal && (
              <p className={`mt-3 text-[11px] sm:text-xs font-bold ${msg.ok ? "text-[#00dd00]" : "text-[#ff0055]"}`}>{msg.text}</p>
            )}
          </>
        )}
      </div>

      {/* 转移数据弹框：二选一 */}
      {modal === "transfer" && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={t("panel.transfer.title")}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="w-full max-w-4xl bg-black border-8 border-[#ff00ff] shadow-[12px_12px_0_0_#00ffff] my-6">
            <div className="flex items-center justify-between gap-3 bg-[#ff00ff] border-b-8 border-black px-4 py-2.5">
              <h3 className="text-base sm:text-xl font-black pixel-font uppercase tracking-wider text-white">{t("panel.transfer.title")}</h3>
              <button
                onClick={() => setModal(null)}
                aria-label={t("panel.close")}
                className="w-7 h-7 bg-black text-white border-2 border-black font-black leading-none hover:bg-[#ffff00] hover:text-black transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-3 sm:p-5">
              <p className="text-[11px] sm:text-xs font-bold text-gray-300 mb-4">{t("panel.transfer.desc")}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 左：传送 */}
                <div className="border-4 border-[#ffff00] bg-[#111] p-3 sm:p-4 flex flex-col">
                  <h4 className="text-sm sm:text-base font-black pixel-font uppercase tracking-wide text-[#ffff00]">
                    {t("panel.transfer.send.title")}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-gray-300 font-bold mt-2 mb-3 flex-1">{t("panel.transfer.send.desc")}</p>
                  <button
                    onClick={genCode}
                    disabled={busy}
                    className="w-full border-4 border-black bg-[#ffff00] text-black py-3 sm:py-4 font-black pixel-font uppercase tracking-wider text-xs sm:text-base shadow-[6px_6px_0_0_#00ffff] hover:translate-y-0.5 hover:shadow-[3px_3px_0_0_#00ffff] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                  >
                    {busy ? t("panel.working") : t("mydata.migrate.gen")}
                  </button>
                  {code && (
                    <div className="mt-3">
                      <textarea
                        id="mydata-code-out"
                        readOnly
                        value={code}
                        rows={4}
                        className={`w-full bg-black border-2 p-2 resize-none break-all ${
                          /^[A-Z0-9]{10}$/.test(code)
                            ? "text-[#00ffff] border-[#00ffff] text-3xl font-mono leading-tight"
                            : "text-[10px] font-mono text-[#00ffff] border-[#00ffff] p-2 break-all"
                        }`}
                      />
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <span className="text-[9px] text-gray-200 font-mono">
                          {t("mydata.migrate.len", { n: code.length })}
                        </span>
                        <button
                          onClick={copyCode}
                          className="text-[10px] font-black pixel-font uppercase px-3 py-1.5 border-2 border-black bg-[#00ffff] text-black hover:opacity-80 transition-opacity"
                        >
                          {copied ? t("mydata.migrate.copied") : t("mydata.migrate.copy")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 右：汇入 */}
                <div className="border-4 border-[#00ffff] bg-[#111] p-3 sm:p-4 flex flex-col">
                  <h4 className="text-sm sm:text-base font-black pixel-font uppercase tracking-wide text-[#00ffff]">
                    {t("panel.transfer.recv.title")}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-gray-300 font-bold mt-2 mb-3">{t("panel.transfer.recv.desc")}</p>
                  <textarea
                    value={paste}
                    onChange={(e) => setPaste(e.target.value)}
                    rows={5}
                    placeholder={t("mydata.import.paste_ph")}
                    className="w-full flex-1 bg-black text-[10px] font-mono text-[#ffff00] border-2 border-white/40 p-2 resize-none placeholder:text-gray-400"
                  />
                  <button
                    onClick={doImport}
                    disabled={busy || !paste.trim()}
                    className="w-full mt-3 border-4 border-black bg-[#00ffff] text-black py-2.5 sm:py-3 font-black pixel-font uppercase tracking-wider text-[11px] sm:text-sm shadow-[4px_4px_0_0_#ff00ff] hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_#ff00ff] active:translate-y-1 active:shadow-none transition-all disabled:opacity-40"
                  >
                    {busy ? t("panel.working") : t("mydata.import.btn")}
                  </button>
                </div>
              </div>

              {msg && (
                <p className={`mt-4 text-[11px] sm:text-xs font-bold ${msg.ok ? "text-[#00dd00]" : "text-[#ff0055]"}`}>{msg.text}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 清除数据弹框：确认 + 返回 */}
      {modal === "clear" && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={t("panel.clear.title")}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="w-full max-w-md bg-black border-8 border-[#ff0055] shadow-[12px_12px_0_0_#ffff00]">
            <div className="bg-[#ff0055] border-b-8 border-black px-4 py-2.5">
              <h3 className="text-sm sm:text-lg font-black pixel-font uppercase tracking-wider text-white">{t("panel.clear.title")}</h3>
            </div>
            <div className="p-4">
              <p className="text-[11px] sm:text-sm text-gray-300 font-bold leading-relaxed">{t("panel.clear.desc")}</p>
              <div className="grid grid-cols-2 gap-3 mt-5">
                <button
                  onClick={doWipe}
                  disabled={busy}
                  className="border-4 border-black bg-[#ff0055] text-white py-3 font-black pixel-font uppercase tracking-wider text-[11px] sm:text-sm shadow-[4px_4px_0_0_#ffff00] hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_#ffff00] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                >
                  {busy ? t("panel.working") : t("panel.clear.confirm")}
                </button>
                <button
                  onClick={() => setModal(null)}
                  className="border-4 border-black bg-white text-black py-3 font-black pixel-font uppercase tracking-wider text-[11px] sm:text-sm shadow-[4px_4px_0_0_#00ffff] hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_#00ffff] active:translate-y-1 active:shadow-none transition-all"
                >
                  {t("panel.clear.back")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 收藏卡片详情弹框 */}
      {detailFav && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailFav(null);
          }}
        >
          <div className="w-full max-w-md">
            <IntelDetailModal
              item={detailFav}
              type={detailFav.type || "movie"}
              locale={locale}
              onClose={() => setDetailFav(null)}
            />
          </div>
        </div>
      )}
    </section>
  );
};

export default MyDataPanel;
