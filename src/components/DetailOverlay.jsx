import React, { useEffect } from "react";

/**
 * DetailOverlay — site-wide standard for detail views (2026-08-24).
 *
 * Renders children as a full-screen overlay ABOVE the page content instead of
 * replacing it. The list below stays mounted, so closing the overlay restores
 * the exact scroll position / tab / filter state with zero refetch — fixes the
 * "数据加载失败" dead-end when a refetch failed after returning from detail.
 *
 * Interactions: click backdrop / ESC key / onClose all close.
 * Body scroll is locked while open.
 */
export default function DetailOverlay({ children, onClose }) {
  // Lock background scroll while the overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Close on ESC
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="min-h-full max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        {children}
      </div>
    </div>
  );
}
