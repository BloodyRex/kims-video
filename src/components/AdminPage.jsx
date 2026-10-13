import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";
import { adminLogin, adminFetchResults, adminDeleteResult, adminPatchResult, adminSetAuthorization } from "../services/adminApi";
import { fetchMovieByTmdbId } from "../services/api";
import IntelConfigPanel from "./IntelConfigPanel";

const CATEGORIES = ["科幻", "悬疑", "恐怖", "动画", "战争", "犯罪", "剧情", "奇幻"];

// 电影节列表不再硬编码：从 /api/festivals.json 的 festivals[] 动态派生（与 /festivals 页同源），
// 新增第 8 届时授权面板会自动出现，无需改前端。字段：slug / name.{zh,en} / authorization。

const LANG_BUTTON_STYLE = {
  fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
};

const AdminPage = () => {
  const { locale, toggleLocale } = useLocale();
  const [token, setToken] = useState(() => sessionStorage.getItem("kims_admin_token") || "");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [posterMap, setPosterMap] = useState({});
  const [view, setView] = useState("cards"); // "cards" | "config" | "festivals"
  const [authStatus, setAuthStatus] = useState({});
  const [authLoading, setAuthLoading] = useState({});
  const [authError, setAuthError] = useState("");
  // 电影节列表（Gap 3：动态派生，不再硬编码）+ 首次加载的真实授权状态
  const [festivals, setFestivals] = useState([]);
  const [festivalsLoading, setFestivalsLoading] = useState(false);

  // 从静态 JSON 拉取电影节卡片（slug / name.{zh,en} / authorization）。
  // 与 /festivals 页同源，新增届次无需改前端；失败时静默保持空列表。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFestivalsLoading(true);
      try {
        const r = await fetch("/api/festivals.json");
        if (!r.ok) return;
        const d = await r.json();
        const list = Array.isArray(d?.festivals) ? d.festivals : [];
        if (cancelled) return;
        setFestivals(list);
        // 用公开卡片里的真实 authorization 预填状态，避免面板一律显示 "pending"
        const seeded = {};
        for (const f of list) if (f.slug && f.authorization) seeded[f.slug] = f.authorization;
        setAuthStatus(prev => ({ ...seeded, ...prev }));
      } catch { /* 保持空列表 */ }
      finally { if (!cancelled) setFestivalsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Lazy-load TMDB posters for cards without uploaded thumbnails (same pattern as DiscoverPage, zero LLM tokens)
  useEffect(() => {
    if (!results.length) return;
    const ids = [...new Set(results.map(r => r.sourceMovies?.[0]?.tmdbId).filter(Boolean))];
    if (!ids.length) return;
    let cancelled = false;
    (async () => {
      const map = {};
      for (let i = 0; i < ids.length; i += 5) {
        const batch = ids.slice(i, i + 5);
        await Promise.allSettled(batch.map(async id => {
          const d = await fetchMovieByTmdbId(id, "zh");
          if (d?.poster && !cancelled) map[id] = d.poster;
        }));
      }
      if (!cancelled) setPosterMap(prev => ({ ...prev, ...map }));
    })();
    return () => { cancelled = true; };
  }, [results]);

  // Fetch results on mount if logged in
  useEffect(() => {
    if (token) fetchCards();
  }, [token]);

  const fetchCards = async () => {
    setLoading(true);
    try {
      const data = await adminFetchResults(token);
      if (data.error === "Unauthorized") {
        sessionStorage.removeItem("kims_admin_token");
        setToken("");
        return;
      }
      setResults(data.results || []);
    } catch (e) {
      setError("Failed to fetch");
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoading(true);
    try {
      const data = await adminLogin(password);
      if (data.error) { setLoginError(data.error); return; }
      sessionStorage.setItem("kims_admin_token", data.token);
      setToken(data.token);
      setPassword("");
    } catch { setLoginError("Connection failed"); }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm(locale === "en" ? "Delete this card?" : "确认删除此卡片？")) return;
    try {
      await adminDeleteResult(token, id);
      setResults(prev => prev.filter(r => r.id !== id));
    } catch { setError("Delete failed"); }
  };

  const handleGenreChange = async (id, newGenre) => {
    try {
      await adminPatchResult(token, id, newGenre);
      setResults(prev => prev.map(r => r.id === id ? { ...r, genre: newGenre } : r));
    } catch { setError("Update failed"); }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("kims_admin_token");
    setToken("");
    setResults([]);
  };

  const handleSetAuth = async (editionId, newAuth) => {
    setAuthLoading(prev => ({ ...prev, [editionId]: true }));
    setAuthError("");
    try {
      const res = await adminSetAuthorization(token, editionId, newAuth);
      if (res.error) {
        setAuthError(res.error);
      } else {
        setAuthStatus(prev => ({ ...prev, [editionId]: newAuth }));
      }
    } catch (e) {
      setAuthError(e.message || "Failed");
    }
    setAuthLoading(prev => ({ ...prev, [editionId]: false }));
  };

  // Login screen
  if (!token) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center p-4">
        <div className="bg-white border-8 border-black p-8 shadow-[16px_16px_0_0_rgba(0,0,0,1)] max-w-sm w-full">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="bg-[#ffff00] p-2 border-4 border-black transform -rotate-6">
              <span className="text-black transform rotate-90"><Icons.Play /></span>
            </div>
            <h1 className="text-lg font-black pixel-font uppercase">Admin</h1>
          </div>
          <form onSubmit={handleLogin}>
            <label className="block text-xs font-bold mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full border-4 border-black px-3 py-2 text-sm font-bold mb-3 focus:outline-none focus:bg-[#ffff00]"
              autoFocus
            />
            {loginError && <p className="text-red-600 text-xs font-bold mb-3">{loginError}</p>}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-[#ff00ff] text-white border-4 border-black py-2.5 text-sm font-black pixel-font uppercase shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none hover:bg-[#ff40ff] transition-colors disabled:opacity-50"
            >
              {loading ? "..." : (locale === "en" ? "Login" : "登录")}
            </button>
          </form>
          <Link to="/" className="block text-center mt-4 text-xs text-gray-500 hover:text-black transition-colors">← Back to site</Link>
        </div>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-[#111] text-white pb-20">
      <header className="bg-black border-b-8 border-[#ff00ff] shadow-[0_8px_0_0_rgba(0,255,255,1)]">
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-[#ffff00] p-1.5 border-3 border-black transform -rotate-6">
              <span className="text-black transform rotate-90 text-xs"><Icons.Play /></span>
            </div>
            <h1 className="text-lg font-black pixel-font uppercase">KIM'S VIDEO <span className="text-[#ff00ff]">ADMIN</span></h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleLocale} className="w-7 h-7 bg-[#ff00ff] border-2 border-black text-black flex items-center justify-center font-black text-xs" style={LANG_BUTTON_STYLE}>{locale === "zh" ? "En" : "中"}</button>
            <Link to="/" className="text-xs text-gray-400 hover:text-[#ffff00] transition-colors">← Site</Link>
            <button onClick={fetchCards} className="text-xs bg-[#00ffff] text-black border-2 border-black px-2 py-1 font-bold hover:bg-[#40ffff] transition-colors">Refresh</button>
            <button onClick={handleLogout} className="text-xs bg-red-500 text-white border-2 border-black px-2 py-1 font-bold hover:bg-red-600 transition-colors">{locale === "en" ? "Logout" : "退出"}</button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tab switch */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setView("cards")}
            className={`px-4 py-1.5 text-xs font-black border-2 border-black uppercase transition-colors ${view === "cards" ? "bg-[#ffff00] text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
          >
            {locale === "en" ? "Cards" : "卡片管理"}
          </button>
          <button
            onClick={() => setView("config")}
            className={`px-4 py-1.5 text-xs font-black border-2 border-black uppercase transition-colors ${view === "config" ? "bg-[#00ffff] text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
          >
            {locale === "en" ? "Engine Config" : "参数配置"}
          </button>
          <button
            onClick={() => setView("festivals")}
            className={`px-4 py-1.5 text-xs font-black border-2 border-black uppercase transition-colors ${view === "festivals" ? "bg-[#ff00ff] text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
          >
            {locale === "en" ? "Festivals" : "电影节授权"}
          </button>
        </div>

        {view === "config" ? (
          <IntelConfigPanel token={token} locale={locale} />
        ) : view === "festivals" ? (
          <div className="space-y-4">
            <div className="bg-white border-4 border-black p-4">
              <h2 className="text-sm font-black uppercase mb-3">
                {locale === "en" ? "Festival Authorization" : "电影节授权状态"}
              </h2>
              <p className="text-xs text-gray-600 mb-4">
                {locale === "en"
                  ? "Set authorization status for each festival edition. 'granted' = officially authorized, 'testing' = test mode (allowed to publish), 'pending' = not yet authorized."
                  : "为每个电影节届次设置授权状态。'granted' = 已获正式授权，'testing' = 测试模式（允许发布），'pending' = 尚未授权。"}
              </p>
              {authError && (
                <div className="bg-red-500 border-2 border-black p-2 text-white text-xs font-bold mb-3">{authError}</div>
              )}
              <div className="space-y-2">
                {festivalsLoading && !festivals.length && (
                  <p className="text-xs text-gray-500 py-2">Loading...</p>
                )}
                {!festivalsLoading && !festivals.length && (
                  <p className="text-xs text-gray-500 py-2">
                    {locale === "en" ? "No festivals available." : "暂无电影节数据。"}
                  </p>
                )}
                {festivals.map(f => {
                  const id = f.slug;
                  const current = authStatus[id] || f.authorization || "pending";
                  const label = f.name ? (f.name[locale === "en" ? "en" : "zh"] || f.name.en || id) : id;
                  return (
                    <div key={id} className="flex items-center justify-between gap-3 border-2 border-black p-2 bg-gray-50">
                      <div>
                        <span className="text-xs font-bold">{label}</span>
                        <span className="text-xs text-gray-400 ml-2">{id}</span>
                      </div>
                      <div className="flex gap-1">
                        {["granted", "testing", "pending"].map(status => (
                          <button
                            key={status}
                            onClick={() => handleSetAuth(id, status)}
                            disabled={authLoading[id]}
                            className={`text-xs font-bold border-2 border-black px-2 py-1 transition-colors ${
                              current === status
                                ? status === "granted" ? "bg-green-500 text-white" : status === "testing" ? "bg-[#ffff00] text-black" : "bg-gray-400 text-white"
                                : "bg-white text-gray-600 hover:bg-gray-100"
                            } disabled:opacity-50`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
        <>
        {error && <div className="bg-red-500 border-4 border-black p-3 text-white font-bold text-sm mb-4">{error}</div>}

        <div className="text-sm text-gray-400 mb-4">{results.length} {locale === "en" ? "cards" : "张卡片"}</div>

        {loading && <p className="text-center text-gray-500 py-8">Loading...</p>}

        <div className="space-y-3">
          {results.map((r) => {
            const src1 = r.sourceMovies?.[0];
            return (
              <div key={r.id} className="bg-white text-black border-4 border-black p-4 flex flex-col sm:flex-row gap-4">
                {/* Thumbnail / poster */}
                <div className="flex-shrink-0">
                  {(() => {
                    const src = r.sourceMovies?.[0];
                    const poster = r.thumbnail || (src?.tmdbId ? posterMap[src.tmdbId] : null);
                    return poster ? (
                      <img src={poster} alt="Poster" className="w-24 h-auto border-2 border-black object-cover" loading="lazy" />
                    ) : (
                      <div className="w-24 h-36 bg-gray-300 border-2 border-black flex items-center justify-center text-xs font-bold text-gray-500">{locale === "en" ? "NO IMG" : "无图"}</div>
                    );
                  })()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-2">
                    <span className="font-black text-sm">
                      {src1?.title || "?"}{src1?.year ? ` (${src1.year})` : ""}
                    </span>
                    <span className="text-xs text-gray-500">
                      by <span className="font-bold">{r.contributorName || (locale === "en" ? "Anonymous" : "匿名")}</span>
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(r.createdAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
                    </span>
                    <span className="text-xs text-[#ff00ff] font-bold">♥ {r.likes || 0}</span>
                  </div>
                  <div className="text-xs text-gray-600 mb-2 line-clamp-1">
                    {(r.recommendations || []).map(rec => rec.title).join(", ")}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0 items-start sm:items-end">
                  <select
                    value={r.genre || "剧情"}
                    onChange={e => handleGenreChange(r.id, e.target.value)}
                    className="text-xs font-bold border-2 border-black px-2 py-1 bg-[#ffff00] cursor-pointer"
                  >
                    {CATEGORIES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-xs font-bold border-2 border-black px-3 py-1 bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    {locale === "en" ? "Delete" : "删除"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </>
        )}
    </div>
    </div>
  );
};

export default AdminPage;