# BFI London Film Festival 2026 — 官方页面离线快照（原始数据源）

本目录是 **原始官方页面** 的存档，适配器 `scripts/festivals/adapters/bfi.mjs` 优先从这里解析，
**不联网**；只有快照缺失时才回退 `fetchText`（CI 上会 403，属预期）。

## 为什么必须存档

| 事实 | 证据 |
|---|---|
| `whatson.bfi.org.uk` 对非浏览器客户端返回 **HTTP 403**（Cloudflare「Just a moment」） | 本机 curl / Node fetch 403；CI runner 同样 403 |
| 真实浏览器可正常取到 200 | 采集时浏览器渲染成功 |
| 因此 CI **不能**直连抓取，也不能在 CI 里跑浏览器自动化 | 流水线契约：CI 只读快照 |

存档让数据 **可复现、可重解析、可追溯**：任何一次改版都能用同一份页面回放验证解析器，
体现「保留数据来源 / 更新失败不覆盖旧数据」的要求。

## 内容与采集口径

- 文件命名 = 官方页面的 `permalink`；`<permalink>.html` 与 `DAY_URL(permalink)` 一一对应。
- `20261007.html` … `20261018.html`：**届期 12 天**（2026-10-07 至 2026-10-18）的逐日官方日程页，一页一天。
- `programme-changes-lff.html`：官方「节目变更」页（散文列表，非日程表格）。
- 采集方式：真实浏览器打开官方 URL 后保存完整 HTML（含内联 `searchResults` 数组与 `searchHeaders` 98 列）。
- 只读公开列表页；不访问 `/WebAPI/`，不采集 `/Common/` 下的 widget JS。

## 刷新方法（本地，需要真实浏览器）

1. 对每个日期打开
   `https://whatson.bfi.org.uk/lff/Online/default.asp?BOparam::WScontent::loadArticle::permalink=<YYYYMMDD>`
2. 另存为 `data/festivals/raw/bfi/<YYYYMMDD>.html`；
   「节目变更」页另存为 `data/festivals/raw/bfi/programme-changes-lff.html`。
3. `node scripts/festivals/run.mjs --only=bfi-2026 --force`（此时不会联网）
4. `node scripts/festivals/verify.mjs`

## 清理策略

节展（2026-10-18）结束并稳定后，可把本目录移到归档分支/外部存储；
届时 `run.mjs` 会因为缺快照而对该来源告警，`normalize.validate()` 的
「SCHEDULE 源失败即拒绝写入」规则保证**不会用空数据覆盖已发布排片**。
删除前请确认 `public/api/festivals/bfi-2026.json` 已落盘为最终状态。
