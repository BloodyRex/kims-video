import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "../i18n";

/* ========================================================================
   P0 — 像素分身 (PixelAvatar)
   ----------------------------------------------------------------
   统一骨架规范（所有部件 viewBox="0 0 120 120"）：
     - 头部中心 (60, 35)
     - 肩宽 x=40~80，腰线 y=60，手臂连接点 (40,50)/(80,50)，腿部起点 y=60
   9 层分层（从下到上）：
     1 背景装饰 / 2 后置配饰 / 3 腿部与下装 / 4 身体与躯干 /
     5 上装与袖子 / 6 手臂与手部 / 7 脸部与五官 / 8 头发 / 9 前置配饰
   主题色：CSS 变量 --skin / --hair / --primary / --secondary / --outline
   确定性随机：LCG，相同 seed + 相同偏好必得相同结果
   ======================================================================== */

/* ---------- seeded random (LCG + fmix32 雪崩混合) ----------
   注意：纯 LCG 用相邻 seed（如 rerollCount 0/1/2）时首个输出几乎不变，
   会导致「换一换」连续点击形象不变，故先用 fmix32 打散 seed。 */
function fmix32(h) {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
function createSeededRandom(seed) {
  let s = fmix32((seed >>> 0) || 1);
  return () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickFrom(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/* ---------- 颜色主题（按外观与风格）---------- */
const APPEARANCE_THEMES = {
  male:   { skin: "#e8c39e", hair: "#2b2233", primary: "#00ffff", secondary: "#ff00ff", outline: "#000000" },
  female: { skin: "#f0c49a", hair: "#4a2c4a", primary: "#ff00ff", secondary: "#00ffff", outline: "#000000" },
  neutral:{ skin: "#d8c3a5", hair: "#5a4a42", primary: "#ffff00", secondary: "#00ff00", outline: "#000000" },
};

const STYLE_THEMES = {
  "sci-fi":    { primary: "#00ffff", secondary: "#ff00ff", bg: "#050510", accent: "#00ffff" },
  mystery:   { primary: "#a020f0", secondary: "#ffffff", bg: "#120a1e", accent: "#ff0055" },
  horror:    { primary: "#ff0000", secondary: "#220000", bg: "#1a0505", accent: "#ff0055" },
  animation: { primary: "#00ff00", secondary: "#ffff00", bg: "#0a0a12", accent: "#00ff00" },
  war:       { primary: "#4a5a3a", secondary: "#8a9a7a", bg: "#1a1e15", accent: "#ff0055" },
  crime:     { primary: "#ffffff", secondary: "#000000", bg: "#0a0a0a", accent: "#ffff00" },
  drama:     { primary: "#8b4a3a", secondary: "#d2a679", bg: "#1e1512", accent: "#ff0055" },
  fantasy:   { primary: "#00ff88", secondary: "#ffd700", bg: "#0a1a12", accent: "#00ff88" },
};

const STYLE_NAMES = ["sci-fi", "mystery", "horror", "animation", "war", "crime", "drama", "fantasy"];
const APPEARANCES = ["male", "female", "neutral"];

/* ---------- 资产：像素网格（Pixel Grid）----------
   坐标系：viewBox 0 0 120 120，人物中心线 x=60，所有矩形对齐 2px 网格。
   骨架（肩宽 x=32..88、腰线 y=86、腿部起点 y=84）由 BODY 统一提供，
   资产只负责「覆盖在骨架之上」的色块，因此任意组合都不会错位。

   安全区约定（保证组合不乱）：
   - 额头/刘海下沿 y ≤ 36          → 眼睛从 y=38 起，永不被头发遮挡
   - 眼睛 x=48..54 / 66..72        → 关于 x=60 严格对称
   - 上衣覆盖 y=56..88            → 不侵入头部（y<56）
   - 袖子覆盖 y=58..72            → 手部 y=72..84 保持肤色可见
   每个部件内部用 var(--*) 引用主题色，描边统一 var(--outline)。 */

const SKIN_OUT = `stroke="var(--outline)" strokeWidth="2"`;

const ASSETS = {
  hair: {
    /* 短发：顶部盖板 + 齐额刘海 + 两鬓，刘海下沿 y=36，不遮眼 */
    short: {
      male:   `<rect x="40" y="20" width="40" height="10" fill="var(--hair)" ${SKIN_OUT}/><rect x="44" y="30" width="32" height="6" fill="var(--hair)"/><rect x="38" y="28" width="6" height="16" fill="var(--hair)" ${SKIN_OUT}/><rect x="76" y="28" width="6" height="16" fill="var(--hair)" ${SKIN_OUT}/>`,
      female: `<rect x="38" y="18" width="44" height="12" fill="var(--hair)" ${SKIN_OUT}/><rect x="42" y="30" width="36" height="6" fill="var(--hair)"/><rect x="34" y="26" width="8" height="22" fill="var(--hair)" ${SKIN_OUT}/><rect x="78" y="26" width="8" height="22" fill="var(--hair)" ${SKIN_OUT}/>`,
      neutral:`<rect x="40" y="20" width="40" height="10" fill="var(--hair)" ${SKIN_OUT}/><rect x="44" y="30" width="32" height="6" fill="var(--hair)"/><rect x="38" y="28" width="6" height="14" fill="var(--hair)" ${SKIN_OUT}/><rect x="76" y="28" width="6" height="14" fill="var(--hair)" ${SKIN_OUT}/>`,
    },
    /* 长发：顶部盖板 + 刘海 + 垂至肩头的长发（沿脸部两侧下垂，不遮脸） */
    long: {
      male:   `<rect x="38" y="18" width="44" height="12" fill="var(--hair)" ${SKIN_OUT}/><rect x="42" y="30" width="36" height="6" fill="var(--hair)"/><rect x="32" y="28" width="10" height="40" fill="var(--hair)" ${SKIN_OUT}/><rect x="78" y="28" width="10" height="40" fill="var(--hair)" ${SKIN_OUT}/>`,
      female: `<rect x="36" y="16" width="48" height="14" fill="var(--hair)" ${SKIN_OUT}/><rect x="42" y="30" width="36" height="6" fill="var(--hair)"/><rect x="30" y="26" width="12" height="46" fill="var(--hair)" ${SKIN_OUT}/><rect x="78" y="26" width="12" height="46" fill="var(--hair)" ${SKIN_OUT}/><rect x="30" y="70" width="12" height="6" fill="var(--hair)"/><rect x="78" y="70" width="12" height="6" fill="var(--hair)"/>`,
      neutral:`<rect x="38" y="18" width="44" height="12" fill="var(--hair)" ${SKIN_OUT}/><rect x="42" y="30" width="36" height="6" fill="var(--hair)"/><rect x="32" y="28" width="10" height="36" fill="var(--hair)" ${SKIN_OUT}/><rect x="78" y="28" width="10" height="36" fill="var(--hair)" ${SKIN_OUT}/>`,
    },
    /* 碎短发：不规则发撮，顶部有像素尖角，风格更利落 */
    pixie: {
      male:   `<rect x="42" y="22" width="36" height="8" fill="var(--hair)" ${SKIN_OUT}/><rect x="38" y="26" width="8" height="18" fill="var(--hair)" ${SKIN_OUT}/><rect x="46" y="30" width="10" height="6" fill="var(--hair)"/><rect x="64" y="30" width="10" height="6" fill="var(--hair)"/>`,
      female: `<rect x="40" y="20" width="40" height="10" fill="var(--hair)" ${SKIN_OUT}/><rect x="36" y="26" width="10" height="22" fill="var(--hair)" ${SKIN_OUT}/><rect x="74" y="26" width="10" height="22" fill="var(--hair)" ${SKIN_OUT}/><rect x="50" y="18" width="6" height="6" fill="var(--hair)" ${SKIN_OUT}/><rect x="64" y="18" width="6" height="6" fill="var(--hair)" ${SKIN_OUT}/>`,
      neutral:`<rect x="42" y="20" width="36" height="10" fill="var(--hair)" ${SKIN_OUT}/><rect x="38" y="26" width="8" height="18" fill="var(--hair)" ${SKIN_OUT}/><rect x="74" y="26" width="8" height="18" fill="var(--hair)" ${SKIN_OUT}/><rect x="56" y="16" width="8" height="6" fill="var(--hair)" ${SKIN_OUT}/>`,
    },
  },
  /* 上装：覆盖 y=56..88（含袖子 y=58..72），不侵入头部，手部保持露出 */
  outfit: {
    casual: {
      male:   `<rect x="32" y="58" width="10" height="14" fill="var(--primary)" ${SKIN_OUT}/><rect x="78" y="58" width="10" height="14" fill="var(--primary)" ${SKIN_OUT}/><rect x="40" y="56" width="40" height="32" fill="var(--primary)" ${SKIN_OUT}/><rect x="56" y="56" width="8" height="6" fill="var(--skin)"/><rect x="44" y="70" width="32" height="4" fill="var(--secondary)" stroke="none"/><rect x="44" y="78" width="32" height="2" fill="var(--outline)" stroke="none"/>`,
      female: `<rect x="34" y="58" width="8" height="14" fill="var(--secondary)" ${SKIN_OUT}/><rect x="78" y="58" width="8" height="14" fill="var(--secondary)" ${SKIN_OUT}/><rect x="40" y="56" width="40" height="30" fill="var(--secondary)" ${SKIN_OUT}/><rect x="58" y="56" width="4" height="6" fill="var(--skin)"/><rect x="44" y="68" width="32" height="4" fill="var(--primary)" stroke="none"/><rect x="40" y="86" width="40" height="8" fill="var(--secondary)" ${SKIN_OUT}/>`,
      neutral:`<rect x="32" y="58" width="10" height="14" fill="var(--primary)" ${SKIN_OUT}/><rect x="78" y="58" width="10" height="14" fill="var(--primary)" ${SKIN_OUT}/><rect x="40" y="56" width="40" height="32" fill="var(--primary)" ${SKIN_OUT}/><rect x="52" y="66" width="16" height="10" fill="var(--secondary)" stroke="none"/>`,
    },
    formal: {
      male:   `<rect x="32" y="58" width="10" height="14" fill="var(--secondary)" ${SKIN_OUT}/><rect x="78" y="58" width="10" height="14" fill="var(--secondary)" ${SKIN_OUT}/><rect x="40" y="56" width="40" height="32" fill="var(--secondary)" ${SKIN_OUT}/><polygon points="48,56 60,74 72,56" fill="#f5f5f5" stroke="var(--outline)" strokeWidth="2"/><polygon points="56,56 64,56 60,64" fill="var(--primary)" stroke="var(--outline)" strokeWidth="1.5"/><rect x="58" y="64" width="4" height="20" fill="var(--primary)" stroke="none"/>`,
      female: `<rect x="34" y="58" width="8" height="14" fill="var(--secondary)" ${SKIN_OUT}/><rect x="78" y="58" width="8" height="14" fill="var(--secondary)" ${SKIN_OUT}/><rect x="40" y="56" width="40" height="30" fill="var(--secondary)" ${SKIN_OUT}/><polygon points="50,56 60,72 70,56" fill="#f5f5f5" stroke="var(--outline)" strokeWidth="2"/><rect x="57" y="62" width="6" height="4" fill="var(--primary)" stroke="none"/><rect x="40" y="86" width="40" height="8" fill="var(--secondary)" ${SKIN_OUT}/>`,
      neutral:`<rect x="32" y="58" width="10" height="14" fill="var(--secondary)" ${SKIN_OUT}/><rect x="78" y="58" width="10" height="14" fill="var(--secondary)" ${SKIN_OUT}/><rect x="40" y="56" width="40" height="32" fill="var(--secondary)" ${SKIN_OUT}/><polygon points="52,56 60,70 68,56" fill="#f5f5f5" stroke="var(--outline)" strokeWidth="2"/><rect x="58" y="62" width="4" height="18" fill="var(--primary)" stroke="none"/>`,
    },
    cyber: {
      male:   `<rect x="30" y="54" width="14" height="10" fill="var(--primary)" ${SKIN_OUT}/><rect x="76" y="54" width="14" height="10" fill="var(--primary)" ${SKIN_OUT}/><rect x="32" y="60" width="10" height="14" fill="var(--primary)" ${SKIN_OUT}/><rect x="78" y="60" width="10" height="14" fill="var(--primary)" ${SKIN_OUT}/><rect x="40" y="56" width="40" height="32" fill="var(--primary)" ${SKIN_OUT}/><rect x="44" y="66" width="32" height="3" fill="var(--secondary)" stroke="none"/><rect x="44" y="78" width="32" height="3" fill="var(--secondary)" stroke="none"/><rect x="56" y="70" width="8" height="6" fill="var(--secondary)" stroke="var(--outline)" strokeWidth="1.5"/>`,
      female: `<rect x="32" y="54" width="12" height="10" fill="var(--primary)" ${SKIN_OUT}/><rect x="76" y="54" width="12" height="10" fill="var(--primary)" ${SKIN_OUT}/><rect x="34" y="60" width="8" height="14" fill="var(--primary)" ${SKIN_OUT}/><rect x="78" y="60" width="8" height="14" fill="var(--primary)" ${SKIN_OUT}/><rect x="40" y="56" width="40" height="30" fill="var(--secondary)" ${SKIN_OUT}/><rect x="44" y="64" width="32" height="3" fill="var(--primary)" stroke="none"/><rect x="44" y="76" width="32" height="3" fill="var(--primary)" stroke="none"/><rect x="40" y="86" width="40" height="8" fill="var(--secondary)" ${SKIN_OUT}/>`,
      neutral:`<rect x="30" y="54" width="12" height="10" fill="var(--primary)" ${SKIN_OUT}/><rect x="78" y="54" width="12" height="10" fill="var(--primary)" ${SKIN_OUT}/><rect x="32" y="60" width="10" height="14" fill="var(--primary)" ${SKIN_OUT}/><rect x="78" y="60" width="10" height="14" fill="var(--primary)" ${SKIN_OUT}/><rect x="40" y="56" width="40" height="32" fill="var(--primary)" ${SKIN_OUT}/><rect x="46" y="72" width="28" height="3" fill="var(--secondary)" stroke="none"/><rect x="58" y="58" width="4" height="12" fill="var(--secondary)" stroke="none"/>`,
    },
  },
  /* 前置配饰：墨镜横跨眼部（y=36..44），帽子扣在头顶（y=14..28），叠在头发之上 */
  accessory: {
    glasses: {
      male:   `<rect x="44" y="36" width="14" height="8" fill="#111111" stroke="var(--outline)" strokeWidth="2"/><rect x="62" y="36" width="14" height="8" fill="#111111" stroke="var(--outline)" strokeWidth="2"/><rect x="58" y="38" width="4" height="3" fill="var(--outline)" stroke="none"/><rect x="46" y="38" width="4" height="2" fill="var(--secondary)" stroke="none"/><rect x="64" y="38" width="4" height="2" fill="var(--secondary)" stroke="none"/>`,
      female: `<rect x="44" y="36" width="14" height="8" fill="#1a0d1a" stroke="var(--outline)" strokeWidth="2"/><rect x="62" y="36" width="14" height="8" fill="#1a0d1a" stroke="var(--outline)" strokeWidth="2"/><rect x="58" y="38" width="4" height="3" fill="var(--outline)" stroke="none"/><rect x="46" y="38" width="5" height="2" fill="var(--primary)" stroke="none"/><rect x="64" y="38" width="5" height="2" fill="var(--primary)" stroke="none"/>`,
      neutral:`<rect x="46" y="36" width="12" height="8" fill="#111111" stroke="var(--outline)" strokeWidth="2"/><rect x="62" y="36" width="12" height="8" fill="#111111" stroke="var(--outline)" strokeWidth="2"/><rect x="58" y="38" width="4" height="3" fill="var(--outline)" stroke="none"/>`,
    },
    hat: {
      male:   `<rect x="40" y="12" width="40" height="12" fill="var(--primary)" stroke="var(--outline)" strokeWidth="2"/><rect x="34" y="24" width="52" height="5" fill="var(--secondary)" stroke="var(--outline)" strokeWidth="2"/><rect x="56" y="12" width="8" height="12" fill="var(--secondary)" stroke="none"/>`,
      female: `<polygon points="60,8 84,22 36,22" fill="var(--secondary)" stroke="var(--outline)" strokeWidth="2"/><rect x="34" y="22" width="52" height="6" fill="var(--primary)" stroke="var(--outline)" strokeWidth="2"/>`,
      neutral:`<rect x="42" y="14" width="36" height="10" fill="var(--primary)" stroke="var(--outline)" strokeWidth="2"/><rect x="38" y="24" width="44" height="4" fill="var(--secondary)" stroke="var(--outline)" strokeWidth="2"/>`,
    },
    none: {
      male:   `<g />`,
      female: `<g />`,
      neutral:`<g />`,
    },
  },
};

/* ---------- 骨架（统一网格，所有外观共享）----------
   自下而上：腿/鞋 → 躯干 → 手臂 → 脖子 → 头 → 发型 → 五官 → 配饰。
   全部为 2px 对齐的直角矩形，避免任何曲线穿帮。 */
const BODY = {
  neck:   `<rect x="56" y="52" width="8" height="6" fill="var(--skin)" stroke="var(--outline)" strokeWidth="2"/>`,
  torso:  `<rect x="42" y="56" width="36" height="30" fill="var(--skin)" stroke="var(--outline)" strokeWidth="2"/>`,
  arms:   `<rect x="32" y="58" width="10" height="26" fill="var(--skin)" stroke="var(--outline)" strokeWidth="2"/><rect x="78" y="58" width="10" height="26" fill="var(--skin)" stroke="var(--outline)" strokeWidth="2"/>`,
  legs:   `<rect x="46" y="86" width="10" height="14" fill="#2a2a35" stroke="var(--outline)" strokeWidth="2"/><rect x="64" y="86" width="10" height="14" fill="#2a2a35" stroke="var(--outline)" strokeWidth="2"/><rect x="42" y="100" width="16" height="8" fill="#16161e" stroke="var(--outline)" strokeWidth="2"/><rect x="62" y="100" width="16" height="8" fill="#16161e" stroke="var(--outline)" strokeWidth="2"/><rect x="46" y="102" width="8" height="2" fill="var(--secondary)" stroke="none"/><rect x="66" y="102" width="8" height="2" fill="var(--secondary)" stroke="none"/>`,
  face:   `<rect x="42" y="26" width="36" height="30" fill="var(--skin)" stroke="var(--outline)" strokeWidth="2"/>`,
  eyes:   `<rect x="48" y="38" width="6" height="6" fill="var(--outline)" stroke="none"/><rect x="50" y="38" width="2" height="2" fill="#ffffff" stroke="none"/><rect x="66" y="38" width="6" height="6" fill="var(--outline)" stroke="none"/><rect x="68" y="38" width="2" height="2" fill="#ffffff" stroke="none"/><rect x="48" y="34" width="6" height="2" fill="var(--outline)" stroke="none"/><rect x="66" y="34" width="6" height="2" fill="var(--outline)" stroke="none"/><rect x="46" y="44" width="4" height="2" fill="#ff5577" opacity="0.55" stroke="none"/><rect x="70" y="44" width="4" height="2" fill="#ff5577" opacity="0.55" stroke="none"/>`,
  mouth:  `<rect x="56" y="48" width="8" height="2" fill="var(--outline)" stroke="none"/><rect x="58" y="50" width="4" height="2" fill="var(--outline)" stroke="none"/>`,
};

/* ---------- 8 种风格背景（CSS 像素块 + 装饰元素）---------- */
const BG_STYLES = {
  "sci-fi": {
    gradient: "repeating-linear-gradient(0deg, #050510 0px, #050510 4px, #0a0a20 4px, #0a0a20 8px)",
    decor: `<circle cx="60" cy="30" r="10" fill="none" stroke="#00ffff" strokeWidth="1" opacity="0.4"/><rect x="20" y="80" width="80" height="4" fill="#00ffff" opacity="0.3"/><rect x="20" y="92" width="80" height="4" fill="#00ffff" opacity="0.3"/>`,
  },
  "mystery": {
    gradient: "repeating-linear-gradient(45deg, #120a1e 0px, #120a1e 4px, #1a0e2a 4px, #1a0e2a 8px)",
    decor: `<circle cx="90" cy="25" r="6" fill="#a020f0" opacity="0.3"/><circle cx="30" cy="90" r="8" fill="#ffffff" opacity="0.2"/><path d="M10 10 Q60 40 110 10" fill="none" stroke="#a020f0" strokeWidth="1" opacity="0.3"/>`,
  },
  "horror": {
    gradient: "repeating-linear-gradient(0deg, #1a0505 0px, #1a0505 4px, #2a0a0a 4px, #2a0a0a 8px)",
    decor: `<circle cx="80" cy="40" r="14" fill="none" stroke="#ff0055" strokeWidth="2" opacity="0.5"/><circle cx="80" cy="40" r="6" fill="#ff0055" opacity="0.8"/><path d="M0 80 Q60 60 120 80" fill="none" stroke="#440000" strokeWidth="2"/>`,
  },
  "animation": {
    gradient: "repeating-linear-gradient(135deg, #0a0a12 0px, #0a0a12 4px, #1a1a2a 4px, #1a1a2a 8px)",
    decor: `<circle cx="50" cy="40" r="10" fill="#00ff00" opacity="0.3"/><circle cx="90" cy="60" r="6" fill="#ffff00" opacity="0.4"/><path d="M20 100 L40 80 L60 100 L80 80 L100 100" fill="none" stroke="#00ff00" strokeWidth="2" opacity="0.3"/>`,
  },
  "war": {
    gradient: "repeating-linear-gradient(45deg, #1a1e15 0px, #1a1e15 4px, #2a3a25 4px, #2a3a25 8px)",
    decor: `<path d="M0 100 L30 70 L60 100 L90 70 L120 100" fill="none" stroke="#4a5a3a" strokeWidth="3"/><rect x="40" y="90" width="40" height="4" fill="#8a9a7a" opacity="0.5"/>`,
  },
  "crime": {
    gradient: "repeating-linear-gradient(0deg, #0a0a0a 0px, #0a0a0a 4px, #1a1a1a 4px, #1a1a1a 8px)",
    decor: `<path d="M0 20 L120 20 M0 40 L120 40 M0 80 L120 80 M0 100 L120 100" stroke="#ffffff" strokeWidth="1" opacity="0.2"/><circle cx="10" cy="10" r="3" fill="#ffff00" opacity="0.8"/>`,
  },
  "drama": {
    gradient: "repeating-linear-gradient(135deg, #1e1512 0px, #1e1512 4px, #3a2a22 4px, #3a2a22 8px)",
    decor: `<path d="M20 100 Q60 60 100 100" fill="none" stroke="#8b4a3a" strokeWidth="2" opacity="0.4"/><circle cx="60" cy="40" r="8" fill="#d2a679" opacity="0.3"/>`,
  },
  "fantasy": {
    gradient: "repeating-linear-gradient(45deg, #0a1a12 0px, #0a1a12 4px, #1a3a2a 4px, #1a3a2a 8px)",
    decor: `<circle cx="60" cy="30" r="12" fill="#00ff88" opacity="0.2"/><path d="M40 100 Q60 40 80 100" fill="none" stroke="#00ff88" strokeWidth="2" opacity="0.3"/><circle cx="90" cy="20" r="4" fill="#ffd700" opacity="0.8"/>`,
  },
};

/* ---------- 组件 ---------- */
export default function PixelAvatar() {
  const { t, locale } = useLocale();
  const zh = locale === "zh";

  const [appearance, setAppearance] = useState("neutral");
  const [lockedTags, setLockedTags] = useState(new Set());
  const [rerollCount, setRerollCount] = useState(0);

  // 确定性 seed：appearance + lockedTags + rerollCount
  const seed = useMemo(() => {
    let h = 0;
    const str = appearance + "|" + Array.from(lockedTags).sort().join(",") + "|" + rerollCount;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h >>> 0;
  }, [appearance, lockedTags, rerollCount]);

  // 抽取结果必须 memo：rng 是有状态生成器，若在 render 体内直接抽取，
  // 任何无关的 re-render 都会消耗新值，导致形象无故漂移。
  const { style, hairStyle, outfitStyle, accessoryStyle } = useMemo(() => {
    const r = createSeededRandom(seed);
    return {
      style: pickFrom(r, STYLE_NAMES),
      hairStyle: pickFrom(r, ["short", "long", "pixie"]),
      outfitStyle: pickFrom(r, ["casual", "formal", "cyber"]),
      accessoryStyle: pickFrom(r, ["glasses", "hat", "none"]),
    };
  }, [seed]);

  const theme = useMemo(() => {
    const base = APPEARANCE_THEMES[appearance];
    const styleTheme = STYLE_THEMES[style];
    return {
      skin: base.skin,
      hair: base.hair,
      primary: styleTheme.primary,
      secondary: styleTheme.secondary,
      outline: base.outline,
      bg: styleTheme.bg,
      accent: styleTheme.accent,
    };
  }, [appearance, style]);

  const bgStyle = BG_STYLES[style] ?? BG_STYLES["sci-fi"];

  // 锁定标签切换（P0 预留：UI 可用，P1 接入真实标签池）
  const toggleLock = useCallback((tag) => {
    setLockedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const handleReroll = useCallback(() => {
    setRerollCount((c) => c + 1);
  }, []);

  const handleAppearance = useCallback((next) => {
    setAppearance(next);
  }, []);

  const motionReduced = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const avatarStyle = useMemo(() => ({
    "--skin": theme.skin,
    "--hair": theme.hair,
    "--primary": theme.primary,
    "--secondary": theme.secondary,
    "--outline": theme.outline,
    "--bg": theme.bg,
  }), [theme]);

  return (
    <section
      className="mt-6 mb-8 border-4 border-[#ff00ff] bg-black text-white"
      style={{ boxShadow: "12px 12px 0 0 #00ffff", ...avatarStyle }}
      aria-label={t("pixel.avatar.title")}
    >
      <div className="p-4 sm:p-6 flex flex-col items-center gap-4">
        {/* 标题 + 外观切换（小型控件，置于换一换旁边） */}
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[#ffff00] font-mono text-xs px-2 py-1 border border-white/40 bg-black/80">SEC.06</span>
            <h3 className="text-sm sm:text-base font-black pixel-font text-white uppercase tracking-tight">
              {t("pixel.avatar.title")}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* 外观切换：男性/女性/中性 */}
            {APPEARANCES.map((app) => {
              const labelKey = `pixel.avatar.appearance_${app}`;
              return (
                <button
                  key={app}
                  type="button"
                  onClick={() => handleAppearance(app)}
                  aria-pressed={appearance === app}
                  aria-label={t(labelKey)}
                  className={`w-8 h-8 border-2 text-[10px] font-black pixel-font uppercase tracking-wider flex items-center justify-center transition-colors ${
                    appearance === app
                      ? "border-[#ffff00] bg-[#ffff00] text-black shadow-[3px_3px_0_0_#00ffff]"
                      : "border-white/30 bg-black/60 text-white hover:border-[#ffff00]"
                  }`}
                >
                  {app.charAt(0).toUpperCase()}
                </button>
              );
            })}
            {/* 换一换 */}
            <button
              type="button"
              onClick={handleReroll}
              aria-label={t("pixel.avatar.reroll")}
              className="border-4 border-black bg-[#00ffff] text-black px-3 py-2 sm:px-4 sm:py-3 font-black pixel-font uppercase tracking-wider text-xs sm:text-sm shadow-[4px_4px_0_0_#ff00ff] hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_#ff00ff] active:translate-y-1 active:shadow-none transition-all"
            >
              {t("pixel.avatar.reroll")}
            </button>
          </div>
        </div>

        {/* SVG 人物舞台 */}
        <div
          className={`relative w-64 h-64 sm:w-80 sm:h-80 rounded-lg border-4 border-black bg-[var(--bg)] shadow-[6px_6px_0_0_var(--accent)] overflow-hidden transition-colors duration-300 ${
            motionReduced ? "" : "animate-[breathe_4s_ease-in-out-infinite]"
          }`}
          style={{ "--bg": theme.bg }}
        >
          {/* 背景层（像素块 + 装饰） */}
          <div className="absolute inset-0" style={{ background: bgStyle.gradient }}>
            <svg
              className="absolute inset-0 w-full h-full opacity-60"
              viewBox="0 0 120 120"
              preserveAspectRatio="none"
              dangerouslySetInnerHTML={{ __html: bgStyle.decor }}
            />
          </div>

          {/* 人物分层（从下到上） */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-full h-full"
              viewBox="0 0 120 120"
              style={{
                transition: motionReduced ? "none" : "transform 0.3s ease",
              }}
            >
              {/* 图层顺序（自下而上）：腿鞋 → 躯干 → 脖子 → 头 → 手臂 → 服装 → 发型 → 五官 → 配饰
                  关键：发型必须在五官之前绘制（否则头发色块盖住眼睛和嘴）；
                  手臂在躯干之后、服装之前（服装袖子盖住手臂上段，手部露出）。 */}
              <g dangerouslySetInnerHTML={{ __html: BODY.legs }} />
              <g dangerouslySetInnerHTML={{ __html: BODY.torso }} />
              <g dangerouslySetInnerHTML={{ __html: BODY.neck }} />
              <g dangerouslySetInnerHTML={{ __html: BODY.face }} />
              <g dangerouslySetInnerHTML={{ __html: BODY.arms }} />
              <g
                dangerouslySetInnerHTML={{
                  __html: ASSETS.outfit[outfitStyle][appearance],
                }}
              />
              <g
                dangerouslySetInnerHTML={{
                  __html: ASSETS.hair[hairStyle][appearance],
                }}
              />
              <g dangerouslySetInnerHTML={{ __html: BODY.eyes }} />
              <g dangerouslySetInnerHTML={{ __html: BODY.mouth }} />
              <g
                dangerouslySetInnerHTML={{
                  __html: ASSETS.accessory[accessoryStyle][appearance],
                }}
              />
            </svg>
          </div>

          {/* 下方标签：当前风格与外观 */}
          <div className="absolute bottom-2 left-2 right-2 flex justify-between px-2">
            <span className="text-[10px] sm:text-xs font-black text-[#00ffff] bg-black/80 px-2 py-0.5 border border-[#00ffff]">
              {t(`pixel.avatar.style_${style}`) || style}
            </span>
            <span className="text-[10px] sm:text-xs font-black text-[#ffff00] bg-black/80 px-2 py-0.5 border border-[#ffff00]">
              {appearance === "male" ? t("pixel.avatar.appearance_male") : appearance === "female" ? t("pixel.avatar.appearance_female") : t("pixel.avatar.appearance_neutral")}
            </span>
          </div>
        </div>

        {/* 引导文案（无历史数据时的默认探索者提示） */}
        <p className="text-[10px] sm:text-xs text-gray-300 font-bold text-center max-w-md px-2">
          {zh
            ? "默认探索者形象。收藏影片后，分身将根据你的观影偏好生成匹配的风格与配饰。"
            : "Default explorer. Your avatar will match your taste after you collect films."}
        </p>
      </div>
    </section>
  );
}
