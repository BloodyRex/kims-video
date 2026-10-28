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
