import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../i18n";

const FALLBACK_STYLE = "sci-fi";
const MIN_FRAME_H = 160;
const MAX_FRAME_H = 1600;
const DEFAULT_FRAME_H = 190;

function normalizeStyle(raw) {
  const v = String(raw || "").trim().toLowerCase();
  const allowed = ["sci-fi", "mystery", "horror", "animation", "war", "crime", "drama", "fantasy"];
  return allowed.includes(v) ? v : FALLBACK_STYLE;
}

export default function PixelAvatar({ styleHint = FALLBACK_STYLE, level = 1, startStage, startEnergy, debug = false }) {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const style = normalizeStyle(styleHint);
  const lvl = Math.max(1, Math.min(10, Number(level) || 1));
  // 内嵌页会把「内容真实高度」postMessage 上来，避免固定 760px 时底部档案被裁切
  const [frameH, setFrameH] = useState(DEFAULT_FRAME_H);
  // iOS Safari 无法对非视频元素真全屏，内嵌页改发 pseudo 全屏消息，这里把 iframe 铺满视口
  const [pseudoFs, setPseudoFs] = useState(false);

  useEffect(() => {
    const onMessage = (e) => {
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "pixel-avatar:fullscreen") {
        setPseudoFs(Boolean(data.on));
        return;
      }
      if (data.type !== "pixel-avatar:height") return;
      const next = Number(data.height);
      if (!Number.isFinite(next)) return;
      setFrameH(Math.min(MAX_FRAME_H, Math.max(MIN_FRAME_H, Math.round(next))));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // 伪全屏期间锁住页面滚动，退出时还原
  useEffect(() => {
    if (!pseudoFs) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pseudoFs]);

  const src = useMemo(() => {
    const params = new URLSearchParams();
    params.set("map", style);
    params.set("look", "male");
    params.set("level", String(lvl));
    // st = 开局生物阶段（0-indexed），er = 起始能量比例；缺省时内嵌页按 level 自行推导
    if (Number.isFinite(startStage)) params.set("st", String(Math.max(0, Math.round(startStage))));
    if (Number.isFinite(startEnergy)) params.set("er", String(Math.max(0, Math.min(1, startEnergy))));
    params.set("lang", zh ? "zh" : "en");
    return `/pixel-avatar-v16.html?${params.toString()}`;
  }, [style, lvl, startStage, startEnergy, zh]);

  const debugOpen =
    debug ||
    (typeof window !== "undefined" && /[?&]pxdebug=1/.test(window.location.search));

  return (
    <section
      className="relative w-full border-4 border-black bg-black text-white overflow-hidden"
      aria-label={zh ? "像素游戏" : "Pixel Game"}
      style={
        pseudoFs
          ? { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 2147483000, borderWidth: 0 }
          : undefined
      }
    >
      <iframe
        src={src}
        title={zh ? "像素游戏" : "Pixel Game"}
        className="block w-full"
        style={{ height: pseudoFs ? "100vh" : `${frameH}px`, border: "0" }}
        allow="fullscreen; accelerometer; gyroscope"
        allowFullScreen
        loading="eager"
      />
    </section>
  );
}