import React from "react";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";

const SplashPage = ({ onStart, isModal, onClose }) => {
  const { t } = useLocale();
  const content = (
    <div
      className={`${isModal ? "bg-[#111] border-4 border-[#ff00ff] max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" : "min-h-screen"} relative`}
      style={
        isModal
          ? { boxShadow: "12px 12px 0 0 #ffff00" }
          : {}
      }
    >
      {/* Close button (modal only) */}
      {isModal && onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-10 h-10 bg-black border-2 border-[#ff00ff] text-[#ff00ff] flex items-center justify-center hover:bg-[#ff00ff] hover:text-black transition-colors z-10 pixel-font text-lg"
          style={{ fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace" }}
        >
          X
        </button>
      )}

      <div className={`${isModal ? "p-8" : "min-h-screen px-6 py-12 flex flex-col justify-center items-center"}`}>
        {/* Logo */}
        <div className="flex items-center justify-center mb-6">
          <div className="bg-[#ffff00] p-3 border-4 border-black transform -rotate-6 flex items-center">
            <Icons.Play className="text-black" />
          </div>
        </div>

        {/* Title */}
        <h1
          className="text-center mb-3"
          style={{
            fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
            fontSize: isModal ? "clamp(1.2rem, 3vw, 1.8rem)" : "clamp(1.5rem, 5vw, 2.5rem)",
            color: "white",
            textShadow: "4px 4px 0 #ff00ff",
            letterSpacing: "0.08em",
          }}
        >
          KIM'S <span className="text-[#00ffff]">VIDEO</span>
        </h1>

        {/* Tagline */}
        <p
          className="text-center text-[#ffff00] font-black mb-3 px-4"
          style={{
            fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
            fontSize: isModal ? "8px" : "clamp(7px, 1.5vw, 10px)",
            letterSpacing: "0.15em",
          }}
        >
          {t('tagline')}
        </p>

        <p
          className="text-center text-gray-400 mb-8 text-sm max-w-md mx-auto"
          style={{
            fontFamily: "-apple-system, 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif",
          }}
        >
          {t('splash.desc')}
        </p>

        {/* Feature list */}
        <div className="max-w-lg mx-auto w-full space-y-4 mb-8">
          <FeatureCard
            icon={<Icons.Star />}
            title={t('splash.feature1.title')}
            desc={t('splash.feature1.desc')}
            color="#ff00ff"
            isModal={isModal}
          />
          <FeatureCard
            icon={<Icons.MessageCircle />}
            title={t('splash.feature2.title')}
            desc={t('splash.feature2.desc')}
            color="#00ffff"
            isModal={isModal}
          />
          <FeatureCard
            icon={<Icons.Target />}
            title={t('splash.feature3.title')}
            desc={t('splash.feature3.desc')}
            color="#ffff00"
            isModal={isModal}
          />
          <FeatureCard
            icon={<Icons.Share2 />}
            title={t('splash.feature4.title')}
            desc={t('splash.feature4.desc')}
            color="#ff00ff"
            isModal={isModal}
          />
        </div>

        {/* Contact */}
        <div className="text-center mb-6">
          <p className="text-gray-500 text-xs" style={{ fontFamily: "-apple-system, 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif" }}>
            {t('splash.contact')} <span className="text-[#00ffff]">rexhr@yahoo.com</span>
          </p>
        </div>

        {/* Action button */}
        {isModal ? (
          <div className="text-center">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-[#00ffff] hover:bg-[#40ffff] text-black border-4 border-black font-black text-sm uppercase tracking-widest shadow-[6px_6px_0_0_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-[3px_3px_0_0_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all pixel-font"
            >
              {t('splash.got_it')}
            </button>
          </div>
        ) : (
          <button
            onClick={onStart}
            className="px-12 py-4 bg-[#ff00ff] hover:bg-[#ff40ff] text-white border-4 border-black font-black text-xl uppercase tracking-widest shadow-[10px_10px_0_0_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] active:translate-y-2 active:shadow-none transition-all pixel-font flex items-center gap-3 mx-auto group"
          >
            {t('splash.start')}
            <Icons.ChevronRight className="group-hover:translate-x-2 transition-transform" />
          </button>
        )}

        {/* Footer (splash only) */}
        {!isModal && (
          <div className="w-full mt-10 pt-4 border-t-4 border-[#ffff00] text-center">
            <p className="text-gray-500 text-xs" style={{ fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace", letterSpacing: "0.15em" }}>
              BLOODYREX (C) 2026
            </p>
          </div>
        )}
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) onClose();
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className="min-h-screen graffiti-bg flex items-center justify-center"
    >
      {content}
    </div>
  );
};

const FeatureCard = ({ icon, title, desc, color, isModal }) => {
  const { locale } = useLocale();
  return (
  <div
    className="bg-white border-3 border-black flex items-start p-4"
    style={{
      borderWidth: "3px",
      borderStyle: "solid",
      borderColor: "#000",
      boxShadow: `6px 6px 0 0 ${color}`,
    }}
  >
    <div
      className="flex-shrink-0 w-10 h-10 flex items-center justify-center mr-4"
      style={{ color: color }}
    >
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <h2
        className="font-black mb-1.5"
        style={{
          fontFamily: locale === "en" ? "'Press Start 2P', 'Courier New', Courier, monospace" : "-apple-system, 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif",
          fontSize: isModal ? (locale === "en" ? "11px" : "15px") : (locale === "en" ? "clamp(11px, 1.8vw, 14px)" : "clamp(18px, 2.8vw, 24px)"),
          lineHeight: locale === "en" ? 1.6 : 1.3,
          letterSpacing: locale === "en" ? "0.05em" : "0.06em",
        }}
      >
        {title}
      </h2>
      <p
        className="text-gray-700 leading-snug"
        style={{
          fontFamily: "-apple-system, 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif",
          fontSize: isModal ? "13px" : "clamp(13px, 1.6vw, 15px)",
        }}
      >
        {desc}
      </p>
    </div>
  </div>
  );
};

export default SplashPage;
