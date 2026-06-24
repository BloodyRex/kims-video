import React, { useState, useEffect } from "react";
import { Icons } from "./Icons";
import { useLocale } from "../i18n";

const Loading = ({ step }) => {
  const { t, tArray } = useLocale();
  const quotes = tArray('loading.quotes');
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    if (!quotes.length) return;
    setDisplayText(quotes[Math.floor(Math.random() * quotes.length)]);

    let timer;
    const next = () => {
      setDisplayText(quotes[Math.floor(Math.random() * quotes.length)]);
      const delay = 2500 + Math.random() * 1000;
      timer = setTimeout(next, delay);
    };
    timer = setTimeout(next, 2500 + Math.random() * 1000);

    return () => clearTimeout(timer);
  }, [quotes]);

  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 border-8 border-black bg-[#ff00ff] animate-pulse transform rotate-45"></div>
        <div className="absolute inset-2 border-4 border-black bg-[#00ffff] animate-pulse delay-75 transform -rotate-12"></div>
        <div className="relative z-10 text-black animate-bounce">
          <Icons.Film />
        </div>
      </div>
      <h3 className={`font-black text-black bg-[#ffff00] px-4 py-2 border-4 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] uppercase tracking-wider pixel-font text-center max-w-xl leading-relaxed ${locale === "en" ? "text-xs sm:text-sm" : "text-base sm:text-lg"}`}>
        {displayText}
      </h3>
      <p className="text-white bg-black px-3 py-1 border-2 border-[#ff00ff] pixel-font text-sm animate-pulse">
        LOADING.DAT ...
      </p>
      {step === "loading_results" && (
        <p className="text-gray-500 pixel-font text-[10px] mt-2">
          {t('loading.eta')}
        </p>
      )}
    </div>
  );
};

export default Loading;
