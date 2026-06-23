import React from "react";
import { Icons } from "./Icons";

const SplashPage = ({ onStart, isModal, onClose }) => {
  const content = (
    <div
      className={`${isModal ? "bg-[#111] border-4 border-[#ff00ff] max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" : "min-h-screen"} relative`}
      style={
        isModal
          ? { boxShadow: "12px 12px 0 0 #ffff00" }
          : {
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(255, 0, 255, 0.3) 0%, transparent 50%),radial-gradient(circle at 80% 20%, rgba(0, 255, 255, 0.3) 0%, transparent 50%),radial-gradient(circle at 50% 80%, rgba(255, 255, 0, 0.2) 0%, transparent 50%)",
            }
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
          &quot;Art is above the law.&quot;
        </p>

        <p
          className="text-center text-gray-400 mb-8 text-sm max-w-md mx-auto"
          style={{
            fontFamily: "-apple-system, 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif",
          }}
        >
          输入你喜欢的影视作品，AI 通过渐进式问答精准分析你的审美口味，
          为你推荐量身定制的电影与剧集。
        </p>

        {/* Feature list */}
        <div className="max-w-lg mx-auto w-full space-y-4 mb-8">
          <FeatureCard
            icon={<Icons.Star />}
            title="双作品输入"
            desc="可输入 1-2 部参考作品，AI 分析共同特征与差异，精准定位你的品味坐标。"
            color="#ff00ff"
            isModal={isModal}
          />
          <FeatureCard
            icon={<Icons.MessageCircle />}
            title="渐进式问答"
            desc="基于参考作品动态生成 6-8 个分层问题，快速收敛到你的偏好区间。"
            color="#00ffff"
            isModal={isModal}
          />
          <FeatureCard
            icon={<Icons.Target />}
            title="AI 精准推荐"
            desc="DeepSeek 驱动：2 部精选热门 + 2 部独家冷门 + 1 部争议之选。"
            color="#ffff00"
            isModal={isModal}
          />
          <FeatureCard
            icon={<Icons.Share2 />}
            title="分享与保存"
            desc="推荐结果可通过链接分享，一键保存为高清 PNG 图片。"
            color="#ff00ff"
            isModal={isModal}
          />
        </div>

        {/* Action button */}
        {isModal ? (
          <div className="text-center">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-[#00ffff] hover:bg-[#40ffff] text-black border-4 border-black font-black text-sm uppercase tracking-widest shadow-[6px_6px_0_0_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-[3px_3px_0_0_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all pixel-font"
            >
              知道了
            </button>
          </div>
        ) : (
          <button
            onClick={onStart}
            className="px-12 py-4 bg-[#ff00ff] hover:bg-[#ff40ff] text-white border-4 border-black font-black text-xl uppercase tracking-widest shadow-[10px_10px_0_0_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] active:translate-y-2 active:shadow-none transition-all pixel-font flex items-center gap-3 mx-auto group"
          >
            开始探索
            <Icons.ChevronRight className="group-hover:translate-x-2 transition-transform" />
          </button>
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
      className="min-h-screen bg-[#111] flex items-center justify-center"
      style={{
        backgroundImage:
          "radial-gradient(circle at 25% 25%, rgba(255, 0, 255, 0.15) 0%, transparent 50%),radial-gradient(circle at 75% 25%, rgba(0, 255, 255, 0.15) 0%, transparent 50%),radial-gradient(circle at 50% 75%, rgba(255, 255, 0, 0.12) 0%, transparent 50%)",
      }}
    >
      {content}
    </div>
  );
};

const FeatureCard = ({ icon, title, desc, color, isModal }) => (
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
      <h3
        className="font-black mb-1"
        style={{
          fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
          fontSize: isModal ? "9px" : "clamp(9px, 1.4vw, 11px)",
        }}
      >
        {title}
      </h3>
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

export default SplashPage;
