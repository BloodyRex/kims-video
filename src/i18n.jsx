import React, { createContext, useContext, useState, useCallback } from "react";

const messages = {
  zh: {
    // ---- SplashPage ----
    "splash.desc": "输入你喜欢的影视作品，AI 通过渐进式问答精准分析你的审美口味，为你推荐量身定制的电影与剧集。",
    "splash.feature1.title": "双作品输入",
    "splash.feature1.desc": "可输入 1-2 部参考作品，AI 分析共同特征与差异，精准定位你的品味坐标。",
    "splash.feature2.title": "渐进式问答",
    "splash.feature2.desc": "基于参考作品动态生成 6-8 个分层问题，快速收敛到你的偏好区间。",
    "splash.feature3.title": "精准智能推荐",
    "splash.feature3.desc": "DeepSeek 驱动：2 部精选热门 + 2 部独家冷门 + 1 部争议之选。",
    "splash.feature4.title": "分享与保存",
    "splash.feature4.desc": "推荐结果可通过链接分享，一键保存为高清 PNG 图片。",
    "splash.contact": "Contact:",
    "splash.start": "开始探索",
    "splash.got_it": "知道了",

    // ---- App ----
    "app.info": "说明",

    // ---- InputPage ----
    "input.primary_label": "主参考作品",
    "input.secondary_label": "附加参考作品 (可选)",
    "input.primary_placeholder": "例如：星际穿越",
    "input.secondary_placeholder": "例如：银翼杀手2049",
    "input.year_placeholder": "年份",
    "input.year_hint": "年份必填，支持手动修改",
    "input.searching": "正在从豆瓣影库调卷...",
    "input.no_results": "未能匹配到结果，请尝试精确输入。",
    "input.submit": "开始剖析基因",
    "input.suggestion_format": "（{year}，{director}）",
    "input.quote": "如果我们想看一部电影，我们就必须去寻找它。",

    // ---- ResultsPage ----
    "results.genome_match": "《{primary}》{secondary} 基因碰撞匹配",
    "results.diagnosis": "匹配诊断报告",
    "results.director": "导演: {director}",
    "results.full_info": "完整资料",
    "results.replace_btn": "换一换",
    "results.searching_dots": "寻找中...",
    "results.no_results": "未匹配到结果",
    "results.badge_hot": "🔥 精选热门",
    "results.badge_niche": "🕵️ 独家冷门",
    "results.badge_controversial": "⚡ 争议之选",

    // ---- MovieDetail ----
    "detail.source_prefix": "这部推荐源自你对《{title}》({year}) 的偏好",
    "detail.back": "← 返回结果页",
    "detail.share": "分享此页",
    "detail.reboot": "REBOOT",
    "detail.taste_match": "◆ 品味匹配",
    "detail.view_tmdb": "在 TMDB 查看完整资料 ↗",
    "detail.no_poster": "无海报",
    "detail.load_error": "无法加载电影资料",
    "detail.runtime": "⏱ {minutes} 分钟",
    "detail.director": "导演: {director}",

    // ---- Loading ----
    "loading.generating": "正在检索稀有胶片库...",
    "loading.eta": "一般需要 3-8s",
    "loading.quote": "电影不死，它们只是在等待被寻找。",

    // ---- Share / Alert ----
    "share.text": "AI为我推荐了电影！基于《{primary}》{secondary}，来看看你的品味基因检测报告 →",
    "share.copied": "链接已复制到剪贴板，分享给朋友吧！",
    "share.prompt": "复制以下链接分享：",

    // ---- Errors ----
    "error.required": "主参考影视作品的名称和首映年份为必填项！",
    "error.year": "请输入有效的年份。",
    "error.qa_failed": "生成问答失败，请重试。",
    "error.rec_failed": "生成推荐失败，请重试。",
    "error.gen_failed": "生成失败，请重试。",

    // ---- SaveContent ----
    "save.recommended_for": "基于《{title}》的推荐",
    "save.hot": "热门精选",
    "save.niche": "冷门发现",
    "save.controversial": "争议之选",
    "save.subtitle": "AI驱动，基于影视喜好，《{primary}》{secondary}基因突变匹配结果",
    "save.footer": "bloodyrex.xyz | Kim's Video — AI Movie Recommender",

    // ---- DiscoverPage ----
    "discover.title": "DISCOVER",
    "discover.desc": "每一部你热爱的电影，都通往另一场未知的冒险。浏览这些精选推荐对，点击即可查看完整影片资料。",
    "discover.view_detail": "查看详情",
    "discover.if_like": "如果你喜欢",
    "discover.arrow": "→",
  },
  en: {
    // ---- SplashPage ----
    "splash.desc": "Tell us what you love. AI-powered progressive Q&A pinpoints your taste and recommends films & shows tailored to you.",
    "splash.feature1.title": "Dual Input",
    "splash.feature1.desc": "Enter 1-2 reference works. AI analyzes commonalities and differences to pinpoint your taste coordinates.",
    "splash.feature2.title": "Adaptive Q&A",
    "splash.feature2.desc": "6-8 progressive questions dynamically generated from your picks, quickly converging on your preferences.",
    "splash.feature3.title": "Precision Picks",
    "splash.feature3.desc": "Powered by DeepSeek: 2 popular hits + 2 hidden gems + 1 controversial wildcard.",
    "splash.feature4.title": "Share & Save",
    "splash.feature4.desc": "Share recommendations via link or save as a high-res PNG image.",
    "splash.contact": "Contact:",
    "splash.start": "EXPLORE",
    "splash.got_it": "GOT IT",

    // ---- App ----
    "app.info": "INFO",

    // ---- InputPage ----
    "input.primary_label": "Primary Reference",
    "input.secondary_label": "Additional Reference (Optional)",
    "input.primary_placeholder": "e.g. Interstellar",
    "input.secondary_placeholder": "e.g. Blade Runner 2049",
    "input.year_placeholder": "Year",
    "input.year_hint": "Year required, editable",
    "input.searching": "Searching the movie vault...",
    "input.no_results": "No matches found. Try a more precise title.",
    "input.submit": "ANALYZE DNA",
    "input.suggestion_format": "（{year}，{director}）",
    "input.quote": "If we want to watch a movie, we have to go looking for it.",

    // ---- ResultsPage ----
    "results.genome_match": "《{primary}》{secondary} Genome Match",
    "results.diagnosis": "MATCH DIAGNOSIS",
    "results.director": "Dir: {director}",
    "results.full_info": "FULL INFO",
    "results.replace_btn": "REPLACE",
    "results.searching_dots": "Searching...",
    "results.no_results": "No results found",
    "results.badge_hot": "🔥 Popular Pick",
    "results.badge_niche": "🕵️ Hidden Gem",
    "results.badge_controversial": "⚡ Wild Card",

    // ---- MovieDetail ----
    "detail.source_prefix": "Recommended based on your love for 《{title}》({year})",
    "detail.back": "← Back to Results",
    "detail.share": "Share",
    "detail.reboot": "REBOOT",
    "detail.taste_match": "◆ TASTE MATCH",
    "detail.view_tmdb": "View on TMDB ↗",
    "detail.no_poster": "NO POSTER",
    "detail.load_error": "Unable to load movie data",
    "detail.runtime": "⏱ {minutes} min",
    "detail.director": "Dir: {director}",

    // ---- Loading ----
    "loading.generating": "Searching the rare film vault...",
    "loading.eta": "Usually takes 3-8s",
    "loading.quote": "Movies never die, they just wait to be found.",

    // ---- Share / Alert ----
    "share.text": "AI picked movies for me! Based on 《{primary}》{secondary}, check out my taste DNA report →",
    "share.copied": "Link copied to clipboard, share it with friends!",
    "share.prompt": "Copy this link to share:",

    // ---- Errors ----
    "error.required": "The title and year of the primary reference are required!",
    "error.year": "Please enter a valid year.",
    "error.qa_failed": "Failed to generate questions. Please try again.",
    "error.rec_failed": "Failed to generate recommendations. Please try again.",
    "error.gen_failed": "Generation failed. Please try again.",

    // ---- SaveContent ----
    "save.recommended_for": "Recommended for fans of {title}",
    "save.hot": "Popular Pick",
    "save.niche": "Hidden Gem",
    "save.controversial": "Wild Card",
    "save.subtitle": "AI-powered recommendations based on 《{primary}》{secondary}",
    "save.footer": "bloodyrex.xyz | Kim's Video — AI Movie Recommender",

    // ---- DiscoverPage ----
    "discover.title": "DISCOVER",
    "discover.desc": "Every film you love leads to another adventure. Browse curated pairings and click to explore full details.",
    "discover.view_detail": "DETAILS",
    "discover.if_like": "If you like",
    "discover.arrow": "→",
  },
};

function interpolate(str, params = {}) {
  return str.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? params[key] : `{${key}}`
  );
}

function t(locale, key, params) {
  const msg = messages[locale]?.[key] ?? messages.en?.[key] ?? key;
  return interpolate(msg, params);
}

const LocaleContext = createContext(null);

function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    const urlLang = new URLSearchParams(window.location.search).get("lang");
    if (urlLang === "zh" || urlLang === "en") return urlLang;
    const stored = localStorage.getItem("kims_video_lang");
    if (stored === "zh" || stored === "en") return stored;
    return navigator.language?.startsWith("zh") ? "zh" : "en";
  });

  const setLocale = useCallback((newLocale) => {
    setLocaleState(newLocale);
    localStorage.setItem("kims_video_lang", newLocale);
    const url = new URL(window.location);
    url.searchParams.set("lang", newLocale);
    window.history.replaceState(null, "", url);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "zh" ? "en" : "zh");
  }, [locale, setLocale]);

  const translate = useCallback(
    (key, params) => t(locale, key, params),
    [locale]
  );

  return (
    <LocaleContext.Provider
      value={{ locale, setLocale, toggleLocale, t: translate }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

export { LocaleProvider, useLocale };
