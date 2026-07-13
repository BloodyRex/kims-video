import { useState, useCallback } from "react";
import { Icons } from "./Icons";

const PLATFORMS = [
  {
    id: "github",
    label: { zh: "GitHub 仓库", en: "GitHub" },
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.73.083-.73 1.205.085 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z"/>
      </svg>
    ),
    href: "https://github.com/BloodyRex/kims-video",
    external: true,
  },
  {
    id: "twitter",
    label: { zh: "Twitter / X", en: "Twitter / X" },
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    shareUrl: (url, title) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: "weibo",
    label: { zh: "微博", en: "Weibo" },
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#E6162D">
        <path d="M10.098 20.323c-3.977.391-7.414-1.406-7.672-4.02-.259-2.609 2.759-5.047 6.74-5.441 3.979-.394 7.413 1.404 7.671 4.018.259 2.6-2.759 5.049-6.739 5.443zM7.895 14.18c-2.955.546-4.026 3.2-2.39 5.926 1.637 2.726 5.272 4.535 8.286 3.93 2.956-.545 4.026-3.198 2.39-5.926-1.637-2.726-5.272-4.474-8.286-3.93z" opacity="0.6"/>
        <circle cx="10.2" cy="17.86" r="1.57" opacity="0.6"/>
        <path d="M20.095 6.107c.373.583-.122 1.33-.698 1.643-.575.313-2.215.18-2.215.18s1.69 1.044 1.317 2.085c-.372 1.04-1.873 1.58-1.873 1.58s2.215.399 2.215 1.66c0 1.26-.886 1.873-.886 1.873s3.63 1.731 2.568 5.92c-1.062 4.188-6.165 6.235-11.466 5.408-5.301-.828-9.065-4.67-8.26-8.685.805-4.015 3.256-5.445 3.256-5.445s-1.104.248-1.717.031c-.613-.217-1.06-.886-.852-1.564.208-.678 1.129-1.209 1.129-1.209s-1.098-.43-.758-1.105c.34-.676 1.5-.976 1.5-.976s-1.6-.735-1.163-1.488c.436-.753 2.5-.83 2.5-.83S6.81 2.49 8.564 2.17c5.04-.916 9.372 2.935 9.372 2.935s1.784-.999 2.159-.998z" opacity="0.6"/>
      </svg>
    ),
    shareUrl: (url, title) => `https://service.weibo.com/share/share.php?title=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: "telegram",
    label: { zh: "Telegram", en: "Telegram" },
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#0088cc">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    shareUrl: (url, title) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    id: "wechat",
    label: { zh: "微信", en: "WeChat" },
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#07C160">
        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.134 0 .24-.11.24-.245 0-.06-.024-.12-.04-.178l-.325-1.233a.49.49 0 0 1 .178-.554C23.028 18.48 24 16.82 24 14.98c0-3.21-3.187-5.882-7.062-6.122zm-2.18 2.655c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.36 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z"/>
      </svg>
    ),
    qr: true,
  },
  {
    id: "copy",
    label: { zh: "复制链接", en: "Copy Link" },
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    ),
    copy: true,
  },
];

function getPageTitle(locale, pathname) {
  if (pathname === "/" || pathname.startsWith("/?")) {
    return locale === "zh" ? "Kim's Video - AI 电影推荐" : "Kim's Video - AI Movie Recommender";
  }
  if (pathname.startsWith("/intelligence")) {
    return locale === "zh" ? "Kim's Video 每日影音情报" : "Kim's Video Daily Intelligence";
  }
  if (pathname.startsWith("/discover")) {
    return locale === "zh" ? "Kim's Video 精选推荐" : "Kim's Video Curated Picks";
  }
  return "Kim's Video";
}

export default function ShareButton({ locale = "zh" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = window.location.href;
  const title = getPageTitle(locale, window.location.pathname);

  const handleOpen = useCallback((e) => {
    e.stopPropagation();
    setIsOpen((o) => !o);
  }, []);

  const handlePlatform = useCallback((platform) => {
    if (platform.qr) {
      setShowQr(true);
      setIsOpen(false);
      return;
    }
    if (platform.copy) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        // Fallback
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
      setIsOpen(false);
      return;
    }
    const shareUrl = platform.shareUrl ? platform.shareUrl(url, title) : platform.href;
    window.open(shareUrl, "_blank", "noopener,noreferrer,width=600,height=500");
    setIsOpen(false);
  }, [url, title]);

  // Close on outside click
  const handleOverlayClick = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <div className="relative inline-block">
      {/* FAB Button */}
      <button
        onClick={handleOpen}
        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-[#ff00ff] border-2 border-black shadow-[2px_2px_0_0_#000] hover:bg-[#ff40ff] active:translate-y-0.5 active:shadow-none transition-all"
        aria-label="Share"
      >
        <Icons.Share2 className="text-black w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>

      {/* Share Panel */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={handleOverlayClick} />
          <div className="absolute bottom-full right-0 mb-2 z-50 bg-black border-2 sm:border-4 border-[#ff00ff] shadow-[4px_4px_0_0_#000] p-1.5 sm:p-2 min-w-[160px] sm:min-w-[180px]">
            <p className="text-[9px] sm:text-[10px] text-[#ff00ff] uppercase font-bold tracking-wider px-2 pb-1 border-b border-[#ff00ff]/30 mb-1">
              {locale === "zh" ? "分享此页面" : "SHARE THIS PAGE"}
            </p>
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePlatform(p)}
                className="w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 text-white hover:bg-white/10 transition-colors text-xs sm:text-sm group"
              >
                <span className="w-5 h-5 flex items-center justify-center">{p.icon()}</span>
                <span className="font-bold text-xs uppercase tracking-wider">{p.label[locale] || p.label.en}</span>
                {p.external && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-auto text-gray-600 group-hover:text-white">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                )}
                {p.copy && (
                  <span className="ml-auto text-[10px] text-gray-500">
                    {copied ? (locale === "zh" ? "已复制" : "Copied!") : ""}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* QR Code Modal */}
      {showQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowQr(false)}>
          <div className="bg-black border-4 border-[#ff00ff] shadow-[4px_4px_0_0_#000] p-6 text-center max-w-[280px]" onClick={(e) => e.stopPropagation()}>
            <p className="text-[#ff00ff] font-bold text-sm uppercase tracking-wider mb-3">
              {locale === "zh" ? "微信扫码分享" : "Scan with WeChat"}
            </p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`}
              alt="QR Code"
              className="mx-auto border-2 border-white"
              width="200"
              height="200"
            />
            <p className="text-gray-400 text-xs mt-3">
              {locale === "zh" ? "截图或扫码后，在微信中分享给好友" : "Screenshot or scan, then share in WeChat"}
            </p>
            <button
              onClick={() => setShowQr(false)}
              className="mt-4 bg-black border-2 border-[#ff00ff] text-[#ff00ff] px-6 py-1 text-sm font-bold hover:bg-[#ff00ff] hover:text-black transition-colors"
            >
              {locale === "zh" ? "关闭" : "CLOSE"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
