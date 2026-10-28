import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";
import personalStore from "./utils/personalStore";

const root = ReactDOM.createRoot(document.getElementById("root"));

function render() {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// 启动时把 IndexedDB 里的推荐读进内存镜像，使 loadResultsFromCache
// 在浏览器重启 / 新标签页后也能同步命中。1.5s 兜底，绝不卡住首屏。
Promise.race([
  personalStore.warmUp().catch(() => null),
  new Promise((resolve) => setTimeout(resolve, 1500)),
]).finally(render);

// Service Worker：让站点可安装（桌面/手机主屏、独立窗口）并缓存应用外壳。
// 仅在生产且浏览器支持 SW 时注册；失败静默降级，不影响页面。
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL || "/";
    navigator.serviceWorker.register(`${base}sw.js`).catch(() => {});
  });
}
