import React from "react";
import { useLocale } from "../i18n";

const QAPage = ({ questions, currentQIndex, onAnswer }) => {
  const { locale } = useLocale();
  const currentQ = questions[currentQIndex];
  const progress = (currentQIndex / questions.length) * 100;
  const isSimple = !currentQ.type || currentQ.type === "simple";

  const displayLabels = currentQ.options?.length > 0
    ? [...currentQ.options]
    : isSimple
      ? locale === "en" ? ["Yes", "Doesn't matter", "No"] : ["是", "无所谓", "否"]
      : locale === "en"
        ? ["Strongly agree", "Somewhat agree", "Neutral", "Somewhat disagree", "Strongly disagree"]
        : ["完全认同", "比较认同", "中立/无感", "不太认同", "完全不认同"];

  const simpleOpts = [
    {
      label: displayLabels[0],
      bg: "bg-[#00ff00]",
      hover: "hover:bg-[#40ff40]",
      icon: "✓",
    },
    {
      label: displayLabels[1],
      bg: "bg-[#ffff00]",
      hover: "hover:bg-[#ffff40]",
      icon: "—",
    },
    {
      label: displayLabels[2],
      bg: "bg-[#ff4444]",
      hover: "hover:bg-[#ff7777]",
      icon: "✗",
    },
  ];

  const deepColors = [
    { bg: "bg-[#00ffff]", hover: "hover:bg-[#40ffff]" },
    { bg: "bg-[#aaff00]", hover: "hover:bg-[#ccff40]" },
    { bg: "bg-[#ffff00]", hover: "hover:bg-[#ffff40]" },
    { bg: "bg-[#ffaa00]", hover: "hover:bg-[#ffcc40]" },
    { bg: "bg-[#ff00ff]", hover: "hover:bg-[#ff40ff]" },
  ];

  const deepOpts = displayLabels.map((label, i) => ({
    label,
    ...deepColors[i % deepColors.length],
  }));

  return (
    <div className="max-w-3xl mx-auto">
      {/* 进度条 */}
      <div className="mb-8 bg-black p-2 border-4 border-white shadow-[8px_8px_0_0_#ff00ff]">
        <div className="flex justify-between text-white mb-2 font-mono uppercase text-sm pixel-font">
          <span>{isSimple ? "QUICK SCAN..." : "DEEP SCAN..."}</span>
          <span>
            LVL {currentQIndex + 1} / {questions.length}
          </span>
        </div>
        <div className="w-full bg-gray-800 h-4 border-2 border-gray-600 p-0.5">
          <div
            className="h-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: isSimple ? "#00ffff" : "#ff00ff",
            }}
          ></div>
        </div>
      </div>

      <div className="bg-white border-8 border-black p-8 md:p-12 shadow-[16px_16px_0_0_#00ffff] relative">
        {/* 大号水印 Q编号 */}
        <div className="absolute top-4 left-4 text-[#ff00ff] font-black text-6xl opacity-20 pointer-events-none select-none transform -rotate-12">
          Q{currentQIndex + 1}
        </div>

        {/* 标签 */}
        <div
          className={`absolute top-4 right-4 text-xs font-black border-2 border-black px-2 py-1 pixel-font ${
            isSimple
              ? "bg-[#00ffff] text-black"
              : "bg-[#ff00ff] text-white"
          }`}
        >
          {isSimple
            ? (locale === "en" ? "QUICK SCAN" : "快速扫描")
            : (locale === "en" ? "DEEP DIVE" : "深度探测")}
        </div>

        {/* 问题文本 */}
        <div className="bg-black text-white p-6 border-4 border-[#ffff00] mb-8 relative z-10 transform rotate-1">
          <h3 className={`font-bold leading-relaxed ${locale === "en" ? "text-sm md:text-base" : "text-xl md:text-2xl"}`}>
            {currentQ.text}
          </h3>
        </div>

        {/* 选项区 */}
        {isSimple ? (
          /* 简单题：横排按钮 */
          <div className="flex flex-row gap-3 relative z-10">
            {simpleOpts.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => onAnswer(opt.label)}
                className={`flex-1 flex flex-col items-center justify-center px-2 py-6 border-4 border-black text-black font-black ${opt.bg} ${opt.hover} shadow-[5px_5px_0_0_#000] hover:translate-y-1 hover:shadow-[2px_2px_0_0_#000] active:translate-y-2 active:shadow-none transition-all`}
              >
                <span className="text-3xl mb-2">{opt.icon}</span>
                <span className={locale === "en" ? "text-xs" : "text-base uppercase"}>{opt.label}</span>
              </button>
            ))}
          </div>
        ) : (
          /* 深度题：纵向列表 */
          <div className="flex flex-col gap-3 relative z-10">
            {deepOpts.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => onAnswer(opt.label)}
                className={`w-full text-left px-6 py-4 border-4 border-black text-black font-black ${opt.bg} ${opt.hover} ${locale === "en" ? "text-xs" : "text-base uppercase"} shadow-[6px_6px_0_0_#000] hover:translate-y-1 hover:shadow-[2px_2px_0_0_#000] active:translate-y-2 active:shadow-none transition-all flex items-center justify-between group`}
              >
                <span>{opt.label}</span>
                <span className="w-5 h-5 border-2 border-black bg-white group-hover:bg-black transition-colors flex-shrink-0"></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QAPage;
