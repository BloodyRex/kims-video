# 阶段 1 — Worker 生图端点 + Seedream 接入（设计稿）

- 前置文档：`docs/WALLPAPER-STAGE0-PLAN.md`、`docs/WALLPAPER-STAGE0-SUMMARY.md`
- 本文档状态：阶段 1 基础结构**已实施**（配置分发 + 校验 + 端点骨架）；真实 Seedream 调用待 `ARK_API_KEY`
- 最后更新：2026-10-14（§6.1 配置分发定稿、§8 本轮实施记录与验证结果）
- 规格核实日期：2026-10-14（火山方舟 Seedream 图片生成 API 官方文档）

## 1. 阶段 1 已交付

| 文件 | 类型 | 状态 |
| --- | --- | --- |
| `scripts/seedream-client.mjs` | 新增 | ✅ 零依赖客户端：`buildPrompt` / `buildRequest` / `validateSize` / `generateImage` |
| `scripts/test-seedream-client.mjs` | 新增 | ✅ 32 项自测，`EXIT=0`（不发真实请求） |
| `config/wallpaper-sizes.json` | 已修正 | ✅ 移除超上限的 3840×2160，重排推荐档 |

## 2. 关键规格修正（与阶段 0 规划的三处冲突）

| 阶段 0 规划 | 官方核实 | 阶段 1 决定 |
| --- | --- | --- |
| 异步轮询获取结果 | **同步返回** | 不做「生成中」状态机，直接 `await` 出图 |
| 尺寸全凭喜好 | 总像素区间 **[921,600, 4,624,220]**、宽高比 [1/16, 16] | 8 档尺寸全部落在区间内（已有脚本验算） |
| 我们自己加水印 | `watermark` 默认 true（右下角「AI生成」） | 免费=provider 水印；付费传 `watermark:false` |

`3840×2160 = 8,294,400` 超出官方上限 **4,624,220**，已从配置移除（见 `removed_sizes`）。

## 3. 端点设计（待写入 `workers-1.4.js`）

```
POST /api/wall/gen      生成预览（免费，含水印）
POST /api/wall/download 下载原图（付费已支付订单）
```

### 3.1 请求体

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `themeId` | string | 对应 `config/wallpaper-themes.json` 的主题 id |
| `sizeKey` | string | `mobile` / `desktop` / 具体 `1920x1080` 形式 |
| `deviceType` | string | `auto` \| `mobile` \| `desktop`，`auto` 走 `userAgent` |

### 3.2 响应体

```json
{ "ok": true, "url": "https://…", "expiresAt": "…", "watermarked": true }
```

错误统一借现有 `jsonResponse` / `errorResponse` 风格，HTTP 200 + `{ok:false, message}`。

## 4. 复用既有 Worker 模式

| 能力 | 复用什么 | 说明 |
| --- | --- | --- |
| CORS | `jsonResponse(data, status, origin)` | 已含 `ALLOWED_ORIGINS` 判断 |
| 限流 | `checkWallpaperRateLimit(env, ip)` | 键 `wallrl:{ip}`，120 次 / 10 分钟，`expirationTtl:600` |
| 鉴权 | `verifyToken` / `jsonResponse` | 与 `wall/collect` 一致 |
| 外部调用 | `fetch` + `Bearer ${env.X_API_KEY}` | 复用 `X_API_KEY`（api.bloodrex.xyz）读法 |
| 生图 | `scripts/wall-worker-helpers.mjs` | 通过 `import` 由 wrangler 打包进 bundle（**非内联**，已实测） |

> ~~Worker 单文件现状：无顶层 `import`，所有代码内联。~~（**已推翻，见 §6.1**）
> wrangler 4.111.0 支持本地 ESM 模块与 JSON import attributes，构建期链入 bundle。
> 因此配置与辅助函数保持 `scripts/`/`config/` 下的真实文件，不存在「两份需手工同步」的问题。

## 5. 环境变量 / Secret

| 名称 | 用途 | 状态 |
| --- | --- | --- |
| `ARK_API_KEY` | 火山方舟 API Key，`wrangler secret put` 注入 | ⏳ 待申请 |
| `WALLDAILY_ORDER_MAIL` | 可选，订单通知邮箱 | ⏳ 待定 |

`ARK_API_KEY` **不得**写入 `wrangler.toml`，不得进 git。

## 6. 集成步骤

1. ~~将 `scripts/seedream-client.mjs` 的四个函数内联到 `workers-1.4.js`~~ → **改为 `import`**，已实施
2. 在 `handleWallDailyWallpaper` 同级的 switch 分支中新增 `api/wall/gen` — ✅ 已实施
3. ~~读 `config/*.json`（`fs` 不可用 → 需 `wrangler.toml` 内联或 KV）~~ → **改为构建期 JSON import attributes**，✅ 已实施
4. 前端 `src/services/api.js` 增加调用函数
5. `node --check workers-1.4.js` 通过后再部署 — ✅ 已通过

> ~~⚠️ 第 3 步是阶段 1 的真正阻塞点~~：**该阻塞点已解除，经实测推翻**，见 §6.1。

### 6.1 配置分发方案定稿（已核实并实施）

构建期 JSON 模块导入，无需改 `wrangler.toml`、无需 `[rules]`、无需 KV。

```
import WALL_THEMES from "./config/wallpaper-themes.json" with { type: "json" };
import WALL_SIZES  from "./config/wallpaper-sizes.json"  with { type: "json" };
```

| 验证项 | 结果 |
| --- | --- |
| `wrangler dev` GET `/api/wall/config` | ✅ 返回 `version` + 20 themes + sizes + constraints |
| 同一进程 GET `/api/intelligence/overview`、POST `/wall/collect` | ✅ 无回归 |
| `node --check workers-1.4.js` | ✅ |
| bundle 大小（dry-run） | 15.58 KiB |

「Worker 无文件系统所以 config 不能复用」这一旧结论**只对 `fs`/运行时读取成立，对构建期 import 不成立**，已删除原 (a)/(b) 两个备选方案。
`config/wallpaper-themes.json` 仍是唯一主题数据源，`wrangler.toml` 未改动。

## 7. 未决项

- [ ] 模型档位定稿：`doubao-seedream-5-0-lite` / `5-0-flash` / `5-0-lg`（价格与分辨率差异待核实）
- [ ] Seedream 计费单价与免费额度
- [ ] 商用许可条款（转售壁纸是否合法）
- [ ] 虎皮椒商户号与回调验签
- [ ] 免费下载用 `response_format:"url"` 后是否需立即转存 R2（URL 仅 24h 有效，R2 才可长期交付）

## 8. 本轮已实施内容（2026-10-14 追加）

> 状态标注：✅ 已核实并实施 / ⏳ 待外部确认 / 💡 设计建议

### 8.1 已实施文件

| 文件 | 改动 |
| --- | --- |
| `workers-1.4.js` | +2 行 JSON import（themes/sizes）；`import` 壁纸辅助函数；新增只读 `GET /api/wall/config`；新增 `POST /api/wall/gen`（无 Key 返回 501，不伪造成功）；CORS 方法扩为 `GET, POST, OPTIONS` |
| `scripts/wall-worker-helpers.mjs` | **新增**。纯函数、零 npm 依赖、零网络调用：`WALL_SEEDREAM_SPEC`、`WALL_PREVIEW_SIZES`、`WALL_FREE_DAILY_LIMIT`、`validateWallPixelRange`、`findTheme`、`pickSizeEntry`、`buildWallGenBody`、`isPaidEntitled`、`decideWallDelivery`、`wallDailyKey`、`normalizeBundle` |
| `scripts/test-wall-worker-helpers.mjs` | **新增**，38 项断言 |
| `scripts/seedream-client.mjs` | 新增 `MODEL_TIERS`（pro/lite）；`sequential_image_generation` 条件发送 |
| `config/wallpaper-sizes.json` | `provider_constraints` 档位化：`official_pixel_range_by_tier`、`official_aspect_range`、`notes`、`verified_on` |
| `.github/workflows/deploy-worker.yml` | `paths` 3 → 6 项 |

### 8.2 部署触发器修复（✅ 已修）

修复前 `paths` 只含 `workers-1.4.js` 与 `wrangler.toml`，**只改主题配置不会触发部署**，与「JSON 为唯一数据源」直接冲突。现已覆盖 `config/wallpaper-themes.json`、`config/wallpaper-sizes.json`、`scripts/seedream-client.mjs`、`scripts/wall-worker-helpers.mjs`。
校验：js-yaml 解析通过，paths=6，`workflow_dispatch`、3 个 secret put 步骤均完整。

### 8.3 像素区间按模型分档（✅ 事实修正）

区间**不是**全模型通用值：

| 档位 | 模型 ID | 总像素区间 | `sequential_image_generation` |
| --- | --- | --- | --- |
| pro | `doubao-seedream-5-0-pro-260628` | [921,600, 4,624,220] | ❌ 不支持 |
| lite | `doubao-seedream-5-0-lite-260128` | [3,686,400, 16,777,216] | ✅ `disabled` |

宽高比两档同为 [1/16, 16]。当前 spec 默认绑 pro（最保守）。⏳ 两档在账号侧是否可用、单价、免费额度仍待确认。

**两处此前写错、本轮已改正的事实**：

1. `3840×2160 = 8,294,400` 只超出 **pro** 上限；在 lite 区间内**仍然合法**。已从配置移除是因为默认档位是 pro，不是因为「全模型非法」。`removed_sizes` 的 reason 已改正。
2. 免费预览尺寸 **1280×720 = 921,600 恰为 pro 下限，但低于 lite 下限 3,686,400** ⇒ 若未来切到 lite 档，免费预览尺寸必须上调到 ≥3,686,400，免费成本会翻倍以上。这是档位选择的真实成本变量，不是纯画质选择。

### 8.4 预览 / 原图分离（✅ 已实施，非 CSS 水印）

免费层走「**重新生成为小图**」，不依赖前端 CSS 遮挡：

| 层 | 尺寸 | provider `watermark` | 原图 URL |
| --- | --- | --- | --- |
| 免费 | 预览 1280×720 / 720×1280（921,600 px = pro 下限，约为原图 1/4–1/3） | `true`（右下角「AI生成」） | **永不返回** |
| 付费 | 目标档 2560×1440 等 | `false` | 返回，24h 有效须立即转存 R2 |

零新增依赖（`sharp` = 0）。`WALL_FREE_DAILY_LIMIT = 3`，KV 键 `wallgen:{ip}:{YYYY-MM-DD}`（UTC），TTL 按天。
已由测试断言守住：`preview decision NEVER exposes full-res dimensions`、`preview size is BELOW lite floor`。

### 8.5 套装结构预留（✅ 已实施形状层）

市场参考（用户提供，**非**已核验全市场统计）：同类商品每套 3–5 张、价格中位约 ¥3.88。

`normalizeBundle(items)` 已实现：单张 1 项 `isBundle:false`；3–5 张 `isBundle:true`；>5 拒绝；过滤无 `assetId` 的脏项；空则 `{ok:false}`。`/api/wall/gen` 已预留 `items` 字段并在真实生成前先行校验形状。

💡 **设计建议**：支付与订单的数据结构按「订单 → N 个 `assetId`」建模，不要把商品表写死为单张行；价格策略保留「单张价 / 套装备选」两态。当前**未引入支付**，仅为结构预留。

### 8.6 验证结果（本轮真实执行）

| 命令 | 结果 |
| --- | --- |
| `node --check workers-1.4.js` | ✅ exit 0 |
| `node --check scripts/wall-worker-helpers.mjs` | ✅ exit 0 |
| `node scripts/test-wall-worker-helpers.mjs` | ✅ 38/38，`SEEDREAM_WALL_HELPERS_TEST=PASS` |
| `node scripts/test-seedream-client.mjs` | ✅ 43/43，`SEEDREAM_CLIENT_TEST=PASS` |
| `node scripts/wallpaper-compliance-check.mjs` | ✅ 全部主题通过 |
| js-yaml 解析 `deploy-worker.yml` | ✅ paths=6，步骤完整 |
| `wrangler dev` 实跑（port 8798） | ✅ 见下 |

实跑请求/响应（均真实取得）：

- `GET /api/wall/config` → 200，`{"version":"0.1.0", "themes":[...]}`
- `GET /api/intelligence/overview` → 200 `{"status":"ok"}`（回归）
- `POST /wall/collect {"items":[]}` → 200 `{"ok":true,"added":0,"skipped":0}`（回归）
- `POST /api/wall/gen` 免费 → 501 + `planned.size=1280x720, mode=preview, watermark=true`（无 Key，未发起外部请求）
- `POST /api/wall/gen` mobile → 501 + `720x1280, preview`
- `POST /api/wall/gen` 付费 entitlement → 501 + `2560x1440, mode=full, watermark=false`
- `POST /api/wall/gen` 未知主题 → 400 `unknown_or_disabled_theme`
- `POST /api/wall/gen` 坏 bundle → 400 `bad_bundle`

未部署、未扣款、未发起任何真实 Seedream 调用。

### 8.7 下一步（供新对话直接接续）

1. ⏳ 申请 `ARK_API_KEY` → `wrangler secret put ARK_API_KEY`
2. ⏳ 账号侧确认档位可用性 / 单价 / 免费额度 / 商用许可
3. 档位定稿后，把 `/api/wall/gen` 的 501 分支替换为真实调用（现已有 `planned`/`plan` 载荷可直接改写），并接 KV 免费计数 `wallgen:{ip}:{日期}`
4. `POST /api/wall/download`：付费下发，先 R2 转存再返回长期地址
5. 前端 `src/services/api.js` 调用封装 + UI
6. 支付仍未引入





