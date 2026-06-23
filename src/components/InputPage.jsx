import React from "react";
import { Icons } from "./Icons";

const InputPage = ({
  primaryMovie,
  setPrimaryMovie,
  secondaryMovie,
  setSecondaryMovie,
  primarySuggestions,
  secondarySuggestions,
  isSearchingPrimary,
  isSearchingSecondary,
  showPrimaryDropdown,
  setShowPrimaryDropdown,
  showSecondaryDropdown,
  setShowSecondaryDropdown,
  error,
  onGenerateQuestions,
  onSelectMovie,
  currentYear,
}) => {
  return (
    <div className="max-w-2xl mx-auto bg-white border-8 border-black p-8 shadow-[16px_16px_0_0_rgba(0,0,0,1)] relative retro-container">
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#ff00ff] rounded-full mix-blend-multiply filter blur-2xl opacity-50 pointer-events-none"></div>
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#00ffff] rounded-full mix-blend-multiply filter blur-2xl opacity-50 pointer-events-none"></div>

      <div className="mb-8 text-center relative z-10">
        <h2
          className="text-4xl font-black mb-3 text-black tracking-tighter uppercase whitespace-nowrap"
          style={{
            fontFamily: "'Press Start 2P', 'Courier New', Courier, monospace",
            fontSize: "clamp(1rem, 4vw, 1.5rem)",
          }}
        >
          KIM'S <span className="text-[#ff00ff]">ARCHIVE</span>
        </h2>
        <p className="text-gray-800 font-bold bg-[#ffff00] inline-block px-2 border-2 border-black">
          "如果我们想看一部电影，我们就必须去寻找它。"
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500 border-4 border-black text-white font-bold flex items-center shadow-[4px_4px_0_0_#000]">
          <div className="w-6 h-6 mr-2 flex-shrink-0 text-black">
            <Icons.Info />
          </div>
          <p className="pixel-font">{error}</p>
        </div>
      )}

      <div className="space-y-6 relative z-10">
        {/* 主参考作品 */}
        <div className="bg-[#f0f0f0] p-5 border-4 border-black shadow-[6px_6px_0_0_#ff00ff]">
          <label className="block text-black font-black mb-3 flex items-center uppercase pixel-font text-lg">
            <span className="mr-2 text-[#ff00ff]">
              <Icons.Star />
            </span>{" "}
            主参考作品 <span className="text-red-500 ml-1">*</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-4 relative">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="例如：星际穿越"
                value={primaryMovie.title}
                onChange={(e) => {
                  setPrimaryMovie({
                    ...primaryMovie,
                    title: e.target.value,
                  });
                  setShowPrimaryDropdown(true);
                }}
                onFocus={() =>
                  primaryMovie.title && setShowPrimaryDropdown(true)
                }
                onBlur={() =>
                  setTimeout(() => setShowPrimaryDropdown(false), 200)
                }
                className="w-full bg-white border-4 border-black px-4 py-3 text-black font-bold focus:outline-none focus:bg-[#ffff00] transition-colors"
              />
              {showPrimaryDropdown && primaryMovie.title && (
                <div className="absolute top-full left-0 w-full z-50 bg-white border-4 border-black shadow-[8px_8px_0_0_#000] mt-1 max-h-60 overflow-y-auto">
                  {isSearchingPrimary ? (
                    <div className="p-4 flex items-center text-gray-500 font-bold">
                      <Icons.Loader2 className="w-5 h-5 mr-3" />{" "}
                      正在从豆瓣影库调卷...
                    </div>
                  ) : Array.isArray(primarySuggestions) &&
                    primarySuggestions.length > 0 ? (
                    primarySuggestions.map((s, i) => (
                      <div
                        key={i}
                        onClick={() => onSelectMovie(s, "primary")}
                        className="p-4 border-b-2 border-gray-200 hover:bg-[#ff00ff] hover:text-white cursor-pointer transition-colors font-black flex flex-col sm:flex-row sm:justify-between sm:items-center"
                      >
                        <span className="text-lg truncate">{s.title}</span>
                        <span className="text-sm opacity-90 whitespace-nowrap mt-1 sm:mt-0">
                          （{s.year}，{s.director}）
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-gray-500 font-bold text-sm">
                      未能匹配到结果，请尝试精确输入。
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col items-start gap-1">
              <input
                type="number"
                min="1895"
                max={currentYear}
                placeholder="年份"
                value={primaryMovie.year}
                onChange={(e) =>
                  setPrimaryMovie({
                    ...primaryMovie,
                    year: e.target.value,
                  })
                }
                className="w-full sm:w-40 bg-white border-4 border-black px-4 py-3 text-black font-bold focus:outline-none focus:bg-[#ffff00] transition-colors"
              />
              <span className="text-[10px] text-gray-500 pixel-font">
                年份必填，支持手动修改
              </span>
            </div>
          </div>
        </div>

        {/* 附加参考作品 */}
        <div className="bg-[#f0f0f0] p-5 border-4 border-black border-dashed shadow-[6px_6px_0_0_#00ffff]">
          <label className="block text-gray-600 font-black mb-3 flex items-center uppercase pixel-font">
            <span className="mr-2 text-[#00ffff]">
              <Icons.Film />
            </span>{" "}
            附加参考作品 (可选)
          </label>
          <div className="flex flex-col sm:flex-row gap-4 relative">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="例如：银翼杀手2049"
                value={secondaryMovie.title}
                onChange={(e) => {
                  setSecondaryMovie({
                    ...secondaryMovie,
                    title: e.target.value,
                  });
                  setShowSecondaryDropdown(true);
                }}
                onFocus={() =>
                  secondaryMovie.title && setShowSecondaryDropdown(true)
                }
                onBlur={() =>
                  setTimeout(() => setShowSecondaryDropdown(false), 200)
                }
                className="w-full bg-white border-4 border-black px-4 py-3 text-black font-bold focus:outline-none focus:bg-[#ffff00] transition-colors"
              />
              {showSecondaryDropdown && secondaryMovie.title && (
                <div className="absolute top-full left-0 w-full z-50 bg-white border-4 border-black shadow-[8px_8px_0_0_#000] mt-1 max-h-60 overflow-y-auto">
                  {isSearchingSecondary ? (
                    <div className="p-4 flex items-center text-gray-500 font-bold">
                      <Icons.Loader2 className="w-5 h-5 mr-3" />{" "}
                      正在从豆瓣影库调卷...
                    </div>
                  ) : Array.isArray(secondarySuggestions) &&
                    secondarySuggestions.length > 0 ? (
                    secondarySuggestions.map((s, i) => (
                      <div
                        key={i}
                        onClick={() => onSelectMovie(s, "secondary")}
                        className="p-4 border-b-2 border-gray-200 hover:bg-[#00ffff] hover:text-black cursor-pointer transition-colors font-black flex flex-col sm:flex-row sm:justify-between sm:items-center"
                      >
                        <span className="text-lg truncate">{s.title}</span>
                        <span className="text-sm opacity-90 whitespace-nowrap mt-1 sm:mt-0">
                          （{s.year}，{s.director}）
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-gray-500 font-bold text-sm">
                      未能匹配到结果，请尝试精确输入。
                    </div>
                  )}
                </div>
              )}
            </div>
            <input
              type="number"
              min="1895"
              max={currentYear}
              placeholder="年份"
              value={secondaryMovie.year}
              onChange={(e) =>
                setSecondaryMovie({
                  ...secondaryMovie,
                  year: e.target.value,
                })
              }
              className="w-full sm:w-40 bg-white border-4 border-black px-4 py-3 text-black font-bold focus:outline-none focus:bg-[#ffff00] transition-colors"
            />
          </div>
        </div>

        <button
          onClick={onGenerateQuestions}
          className="w-full py-4 bg-[#ff00ff] hover:bg-[#ff40ff] text-white border-4 border-black font-black text-xl uppercase tracking-widest shadow-[8px_8px_0_0_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)] active:translate-y-2 active:shadow-none transition-all flex items-center justify-center group pixel-font"
        >
          开始剖析基因
          <Icons.ChevronRight className="ml-2 group-hover:translate-x-2 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default InputPage;
