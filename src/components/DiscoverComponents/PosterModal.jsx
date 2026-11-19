import React from "react";

export function PosterModal({ thumbnail, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 bg-[#ff00ff] border-2 border-black text-white font-black flex items-center justify-center hover:bg-black hover:text-[#ff00ff] transition-colors z-10">×</button>
        <img src={thumbnail} alt="Full recommendation poster" className="max-w-full max-h-[85vh] border-4 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)]" />
      </div>
    </div>
  );
}