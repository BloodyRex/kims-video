import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Icons } from "../Icons";
import { posterUrl } from "../../utils/poster";

export function UserResultCard({ result, posterMap, locale, onLike, onOpenPoster }) {
  const zh = locale === "zh";
  const src = result.sourceMovies?.[0] || {};
  const likes = result.likes || 0;
  const storedLiked = (() => { try { return JSON.parse(localStorage.getItem("kims_liked") || "[]"); } catch { return []; } })();
  const [liked, setLiked] = useState(storedLiked.includes(result.id));
  const [likesLocal, setLikesLocal] = useState(likes + (storedLiked.includes(result.id) ? 1 : 0));

  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (liked) return;
    setLiked(true);
    setLikesLocal(l => l + 1);
    try {
      if (onLike) await onLike(result.id);
      try {
        const likedArr = JSON.parse(localStorage.getItem("kims_liked") || "[]");
        if (!likedArr.includes(result.id)) { likedArr.push(result.id); localStorage.setItem("kims_liked", JSON.stringify(likedArr)); }
      } catch {}
    } catch (e) { console.error("Like failed:", e); }
  };

  return (
    <div className={`bg-white border-4 max-sm:border-2 border-black overflow-hidden shadow-[6px_6px_0_0_rgba(0,0,0,1)] max-sm:shadow-[3px_3px_0_0_rgba(0,0,0,1)] transition-all ${result.thumbnail ? "hover:-translate-y-1 cursor-pointer" : ""}`}
      onClick={() => result.thumbnail && onOpenPoster(result.thumbnail)}>
      <div className="bg-black text-white px-3 py-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-black pixel-font uppercase truncate">{src.title || ""}{src.year ? ` (${src.year})` : ""}</span>
        <span className="text-gray-400 font-bold truncate">{result.contributorName || (zh ? "匿名用户" : "Anonymous")}</span>
      </div>
      <div className="flex p-2 gap-2 overflow-x-auto">
        {result.recommendations.map((rec, i) => {
          const poster = posterMap[rec.tmdbId];
          const detailUrl = `/?from=${src.tmdbId || ""}&r=${rec.tmdbId}&discover=1`;
          const badge = i < 2 ? (zh ? "热门" : "HOT") : i < 4 ? (zh ? "冷门" : "NICHE") : (zh ? "争议" : "WILD");
          const bc = i < 2 ? "bg-[#ff00ff]" : i < 4 ? "bg-[#00ffff]" : "bg-[#ffff00]";
          return (
            <Link key={i} to={detailUrl} onClick={e => e.stopPropagation()} className="flex-shrink-0 w-16 group">
              {poster ? <img src={posterUrl(poster)} alt={rec.title} className="w-16 h-24 object-cover border-2 border-black group-hover:border-[#ff00ff] transition-colors" loading="lazy" /> : <div className="w-16 h-24 bg-gray-800 border-2 border-black flex items-center justify-center text-[8px] text-gray-500 font-bold">?</div>}
              <span className={`block text-[8px] font-black text-center mt-0.5 px-0.5 ${bc} text-black`}>{badge}</span>
            </Link>
          );
        })}
      </div>
      <div className="px-3 pb-2 flex items-center justify-between text-[10px] text-gray-500">
        <span>{new Date(result.createdAt).toLocaleDateString(zh ? "zh-CN" : "en-US", { month: "short", day: "numeric" })}</span>
        <button onClick={handleLike} className={`flex items-center gap-1 font-bold px-1.5 py-0.5 border border-gray-300 hover:bg-gray-100 transition-colors ${liked ? "text-[#ff00ff] border-[#ff00ff]" : ""}`}><span>{liked ? "♥" : "♡"}</span> {likesLocal}</button>
      </div>
    </div>
  );
}
