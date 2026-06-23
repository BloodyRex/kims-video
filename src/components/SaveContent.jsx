import React from "react";
import { Icons } from "./Icons";
import { posterProxy } from "../utils/url";

const SaveContent = ({ recommendations, primaryMovie, secondaryMovie }) => {
  const posterWidth = 100;
  const posterHeight = 150;

  return (
    <div
      className="bg-[#111]"
      style={{
        width: "800px",
        padding: "30px",
        fontFamily: "-apple-system, 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif",
        backgroundImage:
          "radial-gradient(circle at 25% 35%, rgba(255, 0, 255, 0.45) 0%, transparent 50%),radial-gradient(circle at 75% 35%, rgba(0, 255, 255, 0.45) 0%, transparent 50%),radial-gradient(circle at 50% 75%, rgba(255, 255, 0, 0.35) 0%, transparent 55%)",
      }}
    >
      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-[#ffff00] p-2 border-4 border-black transform -rotate-6 flex items-center">
            <Icons.Play className="text-black transform rotate-90" />
          </div>
          <h1
            className="text-3xl font-black text-white pixel-font uppercase tracking-widest whitespace-nowrap"
            style={{ textShadow: "3px 3px 0 #ff00ff" }}
          >
            KIM'S <span className="text-[#00ffff]">VIDEO</span>
          </h1>
        </div>
        <span className="pixel-font text-[10px] text-[#00ffff]">
          bloodyrex.xyz
        </span>
      </div>
      <div
        style={{ height: "3px", backgroundColor: "#ff00ff", marginBottom: "24px" }}
      />

      {/* ── Title ── */}
      <div className="mb-6">
        <h2
          style={{
            fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
            fontSize: "22px",
            color: "white",
            textShadow: "3px 3px 0 #ff00ff",
            margin: 0,
          }}
        >
          TARGETS ACQUIRED
        </h2>
        <p className="bg-[#00ffff] text-black font-bold px-3 pt-0 pb-2 border-2 border-black inline-flex items-center mt-2 text-sm">
          <span
            style={{
              transform: "translateY(4px)",
              display: "inline-block",
              fontFamily:
                "-apple-system, 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif",
              letterSpacing: "0.12em",
            }}
          >
            {`AI驱动，基于影视喜好，《  ${primaryMovie.title}》${secondaryMovie.title ? `和《${secondaryMovie.title}》` : ""}基因突变匹配结果`}
          </span>
        </p>
      </div>

      {/* ── 5张推荐卡片（紧凑横长条） ── */}
      <div className="flex flex-col gap-3">
        {recommendations.map((rec, idx) => {
          const isNiche = idx >= 2 && idx <= 3;
          const isControversial = idx === 4;
          const badge = isControversial
            ? { text: "⚡ 争议之选", bg: "#ff4444" }
            : isNiche
            ? { text: "🕵️ 独家冷门", bg: "#00dd00" }
            : { text: "🔥 精选热门", bg: "#ffff00" };

          return (
            <div
              key={`save-${idx}`}
              className="bg-white border-[3px] border-black flex"
              style={{
                boxShadow: "6px 6px 0 0 #ffff00",
                position: "relative",
              }}
            >
              {/* 编号竖条 */}
              <div
                style={{
                  width: "36px",
                  minWidth: "36px",
                  backgroundColor: "#000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
                    fontSize: "16px",
                    color: "#ff00ff",
                    fontWeight: "bold",
                  }}
                >
                  0{idx + 1}
                </span>
              </div>

              {/* 海报 */}
              <div
                style={{
                  width: `${posterWidth}px`,
                  minWidth: `${posterWidth}px`,
                  paddingTop: "12px",
                  alignSelf: "flex-start",
                }}
              >
                {rec.poster ? (
                  <div style={{ height: `${posterHeight}px`, overflow: "hidden" }}>
                    <img
                      src={posterProxy(rec.poster)}
                      alt={rec.title}
                      crossOrigin="anonymous"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      height: `${posterHeight}px`,
                      backgroundColor: "#333",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
                      fontSize: "8px",
                      color: "#888",
                    }}
                  >
                    NO POSTER
                  </div>
                )}
              </div>

              {/* 内容信息 */}
              <div className="flex-1 p-3 min-w-0 flex flex-col justify-between">
                <div>
                  {/* 标签行 */}
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs font-black px-2 pt-0 pb-1.5 border-2 border-black inline-flex items-center"
                      style={{
                        backgroundColor: badge.bg,
                        color: "#000",
                        transform: "translateY(0px)",
                      }}
                    >
                      <span
                        style={{
                          transform: "translateY(4px)",
                          display: "inline-block",
                        }}
                      >
                        {badge.text}
                      </span>
                    </span>
                    <span
                      className="text-xs font-black px-2 pt-0 pb-1.5 bg-black text-white border-2 border-black inline-flex items-center"
                      style={{
                        fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
                        fontSize: "8px",
                        lineHeight: "10px",
                        transform: "translateY(0px)",
                      }}
                    >
                      <span
                        style={{
                          transform: "translateY(4px)",
                          display: "inline-block",
                        }}
                      >
                        {rec.year} | {rec.type}
                      </span>
                    </span>
                  </div>
                  {/* 标题 */}
                  <div className="font-black text-black text-base leading-tight">
                    {rec.title}
                  </div>
                  {rec.originalTitle && (
                    <div className="text-sm text-[#ff00ff] italic font-bold">
                      {rec.originalTitle}
                    </div>
                  )}
                  {rec.director && (
                    <div className="text-xs text-gray-500 font-bold mt-0.5">
                      导演: {rec.director}
                    </div>
                  )}
                </div>
                {/* 推荐理由 */}
                <div className="mt-1.5 pt-0 pb-0.5 px-2 bg-gray-100 border-[2px] border-black text-xs text-gray-800 leading-snug">
                  <span style={{ transform: "translateY(2px)", display: "inline-block" }}>
                    {rec.reason}
                  </span>
                </div>
              </div>

              {/* 右上角大型编号 */}
              <span
                style={{
                  position: "absolute",
                  top: "0px",
                  right: "8px",
                  fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
                  fontSize: "53px",
                  color: "#ff00ff",
                  fontWeight: "bold",
                  opacity: "0.15",
                  lineHeight: "1",
                  transform: "rotate(45deg)",
                  pointerEvents: "none",
                }}
              >
                0{idx + 1}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div
        className="mt-5 p-2.5 bg-black border-2 border-[#ff00ff] text-center"
        style={{
          fontSize: "8px",
          color: "#00ffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            transform: "translateY(2px)",
            fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
            letterSpacing: "0.15em",
          }}
        >
          bloodyrex.xyz | Kim's Video — AI Movie Recommender
        </span>
      </div>
    </div>
  );
};

export default SaveContent;
