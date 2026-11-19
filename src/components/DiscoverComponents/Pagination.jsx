import React from "react";

export function Pagination({ 
  zh, 
  safePage, 
  totalPages, 
  setPage, 
  buildPages 
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 pt-8 pb-4 flex items-center justify-center gap-1.5 flex-wrap">
      <button onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1}
        className="px-3 py-1.5 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-30 disabled:active:translate-y-0 disabled:active:shadow-[2px_2px_0_0_#000] bg-white text-black hover:bg-gray-100">
        {zh ? "← 上一页" : "← PREV"}
      </button>
      {buildPages(safePage, totalPages).map((p, i, arr) => (
        <React.Fragment key={p}>
          {i > 0 && p - arr[i - 1] > 1 && <span className="text-gray-500 text-xs font-black px-0.5">…</span>}
          <button onClick={() => setPage(p)}
            className={`w-8 h-8 text-xs font-black pixel-font border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all ${
              p === safePage ? "bg-[#ffff00] text-black" : "bg-white text-black hover:bg-gray-100"
            }`}>
            {p}
          </button>
        </React.Fragment>
      ))}
      <button onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages}
        className="px-3 py-1.5 text-[10px] sm:text-xs font-black pixel-font uppercase border-2 border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-30 disabled:active:translate-y-0 disabled:active:shadow-[2px_2px_0_0_#000] bg-white text-black hover:bg-gray-100">
        {zh ? "下一页 →" : "NEXT →"}
      </button>
    </div>
  );
}