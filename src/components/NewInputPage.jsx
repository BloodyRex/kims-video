import React from "react";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";

/**
 * NewInputPage — AI 搜索输入界面（2026-08 新主页设计）
 * 移植自 kim_s_video_application.html 的 renderInput。
 * 主参考作品（必填）+ 附加参考作品（可选）+ 开始剖析基因。
 */
const NewInputPage = ({
  primaryMovie, setPrimaryMovie,
  secondaryMovie, setSecondaryMovie,
  primarySuggestions, secondarySuggestions,
  isSearchingPrimary, isSearchingSecondary,
  showPrimaryDropdown, setShowPrimaryDropdown,
  showSecondaryDropdown, setShowSecondaryDropdown,
  error,
  onGenerateQuestions,
  onSelectMovie,
  onBack,
  currentYear,
  locale,
}) => {
  const { t } = useLocale();
  const zh = locale === "zh";

  return (
    <div className="max-w-2xl mx-auto bg-white border-8 border-black p-8 shadow-[16px_16px_0_0_rgba(0,0,0,1)] relative retro-container">
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#ff00ff] rounded-full mix-blend-multiply filter blur-2xl opacity-50 pointer-events-none"></div>
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#00ffff] rounded-full mix-blend-multiply filter blur-2xl opacity-50 pointer-events-none"></div>

      <div className="mb-8 text-center relative z-10 flex justify-between items-center">
        <button
          onClick={onBack}
          className="bg-black text-white px-3 py-1 font-bold text-xs border-2 border-[#ffff00] hover:bg-[#ffff00] hover:text-black transition-colors"
        >
          &lt;&lt; {zh ? "返回主导航" : "Back"}
        </button>
        <h2
          className="text-2xl font-black text-black uppercase whitespace-nowrap pixel-font"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "clamp(0.8rem, 3vw, 1.2rem)" }}
        >
          AI <span className="text-[#ff00ff]">SEARCH</span>
        </h2>
        <div className="w-16"></div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500 border-4 border-black text-white font-bold flex items-center shadow-[4px_4px_0_0_#000]">
          <div className="w-6 h-6 mr-2 flex-shrink-0 text-black"><Icons.Info /></div>
          <p className="pixel-font text-xs">{error}</p>
        </div>
      )}

      <div className="space-y-6 relative z-10">
        {/* 主参考作品 */}
        <div className="bg-[#f0f0f0] p-5 border-4 border-black shadow-[6px_6px_0_0_#ff00ff]">
          <label className="block text-black font-black mb-3 flex items-center uppercase pixel-font text-lg">
            <span className="mr-2 text-[#ff00ff]"><Icons.Star /></span>
            {zh ? "主参考作品" : "Primary Reference"}
            <span className="text-red-500 ml-1">*</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-4 relative">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder={zh ? "例如：星际穿越" : "e.g. Interstellar"}
                value={primaryMovie.title}
                onChange={(e) => {
                  setPrimaryMovie({ ...primaryMovie, title: e.target.value });
                  setShowPrimaryDropdown(true);
                }}
                onFocus={() => primaryMovie.title && setShowPrimaryDropdown(true)}
                onBlur={() => setTimeout(() => setShowPrimaryDropdown(false), 200)}
                className="w-full bg-white border-4 border-black px-4 py-3 text-black font-bold focus:outline-none focus:bg-[#ffff00] transition-colors"
              />
              {showPrimaryDropdown && primaryMovie.title && (
                <div className="absolute top-full left-0 w-full z-50 bg-white border-4 border-black shadow-[8px_8px_0_0_#000] mt-1 max-h-60 overflow-y-auto">
                  {isSearchingPrimary ? (
                    <div className="p-4 flex items-center text-gray-500 font-bold text-sm">
                      <Icons.Loader2 className="w-5 h-5 mr-3" />
                      {zh ? "正在从影库调卷..." : "Searching film archive..."}
                    </div>
                  ) : Array.isArray(primarySuggestions) && primarySuggestions.length > 0 ? (
                    primarySuggestions.map((s, i) => (
                      <div
                        key={i}
                        onClick={() => onSelectMovie(s, "primary")}
                        className="p-4 border-b-2 border-gray-200 hover:bg-[#ff00ff] hover:text-white cursor-pointer transition-colors font-black flex flex-col sm:flex-row sm:justify-between sm:items-center"
                      >
                        <span className="text-base truncate">{s.title}</span>
                        <span className="text-sm opacity-90 whitespace-nowrap mt-1 sm:mt-0">
                          （{s.year}，{s.director}）
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-gray-500 font-bold text-sm">
                      {zh ? "未能匹配到结果，请尝试精确输入。" : "No matches. Try a more precise title."}
                    </div>
                  )}
                </div>
              )}
            </div>
            <input
              type="number"
              min="1895"
              max={currentYear}
              placeholder={zh ? "年份" : "Year"}
              value={primaryMovie.year}
              onChange={(e) => setPrimaryMovie({ ...primaryMovie, year: e.target.value })}
              className="w-full sm:w-40 bg-white border-4 border-black px-4 py-3 text-black font-bold focus:outline-none focus:bg-[#ffff00] transition-colors"
            />
          </div>
        </div>

        {/* 附加参考作品 */}
        <div className="bg-[#f0f0f0] p-5 border-4 border-black border-dashed shadow-[6px_6px_0_0_#00ffff]">
          <label className="block text-gray-600 font-black mb-3 flex items-center uppercase pixel-font">
            <span className="mr-2 text-[#00ffff]"><Icons.Film /></span>
            {zh ? "附加参考作品 (可选)" : "Secondary Reference (Optional)"}
          </label>
          <div className="flex flex-col sm:flex-row gap-4 relative">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder={zh ? "例如：银翼杀手2049" : "e.g. Blade Runner 2049"}
                value={secondaryMovie.title}
                onChange={(e) => {
                  setSecondaryMovie({ ...secondaryMovie, title: e.target.value });
                  setShowSecondaryDropdown(true);
                }}
                onFocus={() => secondaryMovie.title && setShowSecondaryDropdown(true)}
                onBlur={() => setTimeout(() => setShowSecondaryDropdown(false), 200)}
                className="w-full bg-white border-4 border-black px-4 py-3 text-black font-bold focus:outline-none focus:bg-[#ffff00] transition-colors"
              />
              {showSecondaryDropdown && secondaryMovie.title && (
                <div className="absolute top-full left-0 w-full z-50 bg-white border-4 border-black shadow-[8px_8px_0_0_#000] mt-1 max-h-60 overflow-y-auto">
                  {isSearchingSecondary ? (
                    <div className="p-4 flex items-center text-gray-500 font-bold text-sm">
                      <Icons.Loader2 className="w-5 h-5 mr-3" />
                      {zh ? "正在从影库调卷..." : "Searching film archive..."}
                    </div>
                  ) : Array.isArray(secondarySuggestions) && secondarySuggestions.length > 0 ? (
                    secondarySuggestions.map((s, i) => (
                      <div
                        key={i}
                        onClick={() => onSelectMovie(s, "secondary")}
                        className="p-4 border-b-2 border-gray-200 hover:bg-[#00ffff] hover:text-black cursor-pointer transition-colors font-black flex flex-col sm:flex-row sm:justify-between sm:items-center"
                      >
                        <span className="text-base truncate">{s.title}</span>
                        <span className="text-sm opacity-90 whitespace-nowrap mt-1 sm:mt-0">
                          （{s.year}，{s.director}）
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-gray-500 font-bold text-sm">
                      {zh ? "未能匹配到结果，请尝试精确输入。" : "No matches. Try a more precise title."}
                    </div>
                  )}
                </div>
              )}
            </div>
            <input
              type="number"
              min="1895"
              max={currentYear}
              placeholder={zh ? "年份" : "Year"}
              value={secondaryMovie.year}
              onChange={(e) => setSecondaryMovie({ ...secondaryMovie, year: e.target.value })}
              className="w-full sm:w-40 bg-white border-4 border-black px-4 py-3 text-black font-bold focus:outline-none focus:bg-[#ffff00] transition-colors"
            />
          </div>
        </div>

        <button
          onClick={onGenerateQuestions}
          className="w-full py-4 bg-[#ff00ff] hover:bg-[#ff40ff] text-white border-4 border-black font-black text-xl uppercase tracking-widest shadow-[8px_8px_0_0_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)] active:translate-y-2 active:shadow-none transition-all flex items-center justify-center group pixel-font"
        >
          {zh ? "开始剖析基因" : "Start Analysis"}
          <Icons.ChevronRight className="ml-2 group-hover:translate-x-2 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default NewInputPage;
