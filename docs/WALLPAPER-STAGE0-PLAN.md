# 阶段 0：电影主题壁纸 MVP 方案

> **目标**：基于现有项目架构，构建纯文生图的电影氛围壁纸生成服务。用户选择电影主题 + 尺寸 → AI 生成原创壁纸 → 免费预览（带水印）→ 付费下载原图（邮件发送下载链接）。
>
> **约束**：不引入新框架，不重构现有架构，复用 KV/R2/Resend/限流/部署流水线。

---

## 1. 项目现状（已确认）

### 1.1 架构

| 层 | 技术 | 文件 | 行数 |
|---|---|---|---|
| 前端 | React 18 + Vite 6 + Tailwind 4 + react-router-dom 7 | `src/App.jsx` | ~620 |
| 后端 | Cloudflare Worker（单文件） | `workers-1.4.js` | 3657 |
| 部署 | GitHub Actions × 2 | `.github/workflows/deploy-{frontend,worker}.yml` | — |
| 数据 | 静态 JSON + KV + R2 | `public/api/*.json` | — |

### 1.2 Worker 端点（18 个，`path ===` 精确匹配）

| 端点 | 方法 | 功能 |
|---|---|---|
| `/poster-proxy` | GET | TMDB 图片代理（国内可达） |
| `/intelligence/{overview,movies,tv,music,coming,weekly,digest,debug}` | GET | 情报数据 |
| `/intelligence/hidden-gems` | GET/POST | AI 冷门精选 |
| `/intelligence/music/v2` | POST | 音乐 AI 精选 |
| `/intelligence/trailer` | GET | TMDB 预告片 |
| `/intelligence/translate-overview` | POST | 简介中译 |
| `/intelligence/subscribe` | POST | 订阅邮件（KV） |
| `/intelligence/unsubscribe` | GET/POST | 退订 |
| `/intelligence/send-digest` | POST | 群发当日邮件 |
| `/intelligence/send-test` | POST | 单封测试邮件 |
| `/wall/collect` | POST | 用户推荐片（IP 限流 120/10min） |
| `/wall/recs` | GET | 推荐片列表 |
| `/discover/results` | GET/POST | 社区精选 |
| `/discover/results/{id}/like` | POST | 点赞 |
| `/discover/upload` | POST | 缩略图上传（R2） |
| `/discover/thumbnail/{id}` | GET | R2 缩略图读取 |
| `/admin/login`、`/admin/results` | POST/GET/DELETE/PATCH | 后台管理 |

### 1.3 可复用能力

| 能力 | 实现位置 | 复用价值 |
|---|---|---|
| KV 存储 | `DISCOVER_KV`（`result:{id}`/`wallRec:*`/`wallrl:{ip}`） | ✅ 订单/状态存储 |
| R2 存储 | `DISCOVER_R2`（`thumbnails/{id}.png`） | ✅ 壁纸原图存储 |
| Resend 邮件 | `RESEND_API_KEY`（4 处调用，sender `digest@bloodyrex.xyz`） | ✅ 邮件发送 |
| IP 限流 | `/wall/collect` L3565-3569（`wallrl:{ip}`，120/10min） | ✅ 免费额度控制 |
| Cache API | `/poster-proxy`（`caches.default`，1 天） | ✅ 预览图缓存 |
| Admin Auth | `ADMIN_PASSWORD` + `createAdminToken` | ⚠️ 仅管理员，非用户系统 |
| 前端 API 封装 | `src/services/api.js`（`withTimeout`，30s） | ✅ 统一请求 |
| 前端缓存 | `src/utils/cache.js`（`sessionStorage`） | ✅ 结果缓存 |
| 下载 | `NewHomePage.jsx:225-229`（`createObjectURL` + `a.download`） | ⚠️ 仅前端 Blob，非服务端 |
| i18n | `src/i18n.jsx`（zh/en，335 行） | ✅ 多语言 |

### 1.4 已确认缺口

| 缺口 | 证据 | 影响 |
|---|---|---|
| **无支付** | `pay=0`，无 PayPal/Stripe/微信/支付宝 | 需接入支付渠道 |
| **无数据库** | `d1=0`，Worker 无 D1 绑定 | 订单用 KV，够用 |
| **无用户系统** | 无 `user_id`/`login`/`signup`（仅 admin） | MVP 免登录 |
| **无图像生成** | 无 Seedream/SD/Midjourney/DALL-E | 需接入 AI 生图 |
| **无图像处理** | `sharp=0`，无服务端裁剪 | 依赖生图服务直接出图 |
| **无订单** | 无 `order`/`checkout` | 需新建 |

---

## 2. MVP 范围

### 2.1 目标用户流程

```
用户访问 → 选择电影主题（20 部）→ 选择尺寸（桌面/手机）→ 提交生成
    ↓
AI 生成壁纸（Seedream）→ 存储 R2 → 返回预览（带水印压缩图）
    ↓
用户付费 → 创建订单（KV）→ 生成下载链接（24h 有效）→ 邮件发送
    ↓
用户点击邮件链接 → 验证订单 → 下载原图
```

### 2.2 功能边界

**✅ 第一阶段做**：
- 20 部电影主题（静态 JSON，无 TMDB）
- 主题选择 + 尺寸选择（桌面 16:9 / 手机 9:16）
- 纯文生图（无海报上传、无 img2img、无自定义 prompt）
- 免费预览（带水印压缩图，3 次/天/IP）
- 付费下载（微信/支付宝，邮件发送下载链接）
- 自动推荐尺寸（`navigator.userAgent`）
- 多语言（zh/en，复用 i18n）

**❌ 第一阶段不做**：
- 用户注册/登录
- 会员/订阅制
- 优惠券/退款/发票
- 海报上传/图片编辑
- 自定义 prompt 输入
- 批量生成
- 历史订单/下载记录
- 服务端图像裁剪
- 新框架引入

---

## 3. 关键决策

### 3.1 存储：KV（非 D1）

- **决策**：订单用 Cloudflare KV，不引入 D1
- **理由**：订单量小（MVP 预期 <1000/天），KV 读写够用，无需 SQL
- **结构**：`order:{id}` → `{id, themeId, size, amount, status, email, downloadUrl, createdAt, expiresAt}`

### 3.2 AI 生图：豆包 Seedream（火山引擎方舟）

| 维度 | 评估 |
|---|---|
| 国内可达 | ✅ 火山引擎，无墙 |
| 商业授权 | ✅ 支持商用（需确认条款） |
| API 兼容 | OpenAI 兼容格式 |
| 价格 | ~0.1-0.2 元/张（待确认） |
| 免费额度 | 有（MVP 测试够用） |
| 尺寸支持 | 需确认 1920×1080/1170×2532 等 |
| 异步/同步 | 需确认（建议异步轮询） |

**备选**：Stable Diffusion API（Replicate）、Midjourney（ unofficial）

### 3.3 支付：虎皮椒（Huapijiao）

| 维度 | 评估 |
|---|---|
| 免签约 | ✅ 个人可接入 |
| 支付渠道 | ✅ 微信 + 支付宝 |
| 费率 | 待确认（~0.6%） |
| 回调 | ✅ 标准 webhook，需验签 |
| 适用性 | 待确认（个人/企业开发者） |

**备选**：PayPal（海外用户）、Stripe（需海外主体）

### 3.4 存储隔离

- **决策**：壁纸原图存 `DISCOVER_R2` 的 `wallpapers/` 前缀，与 `thumbnails/` 隔离
- **理由**：复用现有 R2 bucket，避免新 bucket 审批

---

## 4. 尺寸策略

### 4.1 桌面（16:9）

| 尺寸 | 分辨率 | 推荐 | 用途 |
|---|---|---|---|
| FHD | 1920×1080 | ✅ | 普通显示器 |
| QHD | 2560×1440 | — | 2K 显示器 |
| 4K UHD | 3840×2160 | — | 4K 显示器 |

### 4.2 手机（9:16）

| 尺寸 | 分辨率 | 推荐 | 用途 |
|---|---|---|---|
| FHD | 1080×1920 | ✅ | 普通手机 |
| iPhone Pro | 1170×2532 | — | iPhone 12-15 Pro |
| iPhone Pro Max | 1290×2796 | — | iPhone 12-15 Pro Max |

### 4.3 自动推荐

```javascript
const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const recommended = isMobile ? "mobile" : "desktop";
// 默认选每种类型的第 0 个（FHD）
```

### 4.4 安全区

- 桌面：全屏，无系统 UI 遮挡
- 手机：顶部 60px（状态栏）+ 底部 60px（Dock）

---

## 5. 版权策略

### 5.1 Prompt 原则

- ✅ 情绪词（hope, melancholic, nostalgic）
- ✅ 色彩（slate grey, warm amber）
- ✅ 纹理（stone, rain, silk）
- ✅ 光线（chiaroscuro, golden hour）
- ❌ 角色名（Andy, Jack, Chihiro）
- ❌ 具体场景（bow pose, spinning top）
- ❌ 电影标题（Shawshank, Titanic）

### 5.2 合规自检

- 脚本：`scripts/wallpaper-compliance-check.mjs`
- 运行：`node scripts/wallpaper-compliance-check.mjs`
- 检查：展开 `{mood}`/`{palette}`/`{composition}` 占位符后，测试最终 prompt 不含黑名单关键词
- 黑名单：角色名（词边界匹配）、电影标题、标志性场景/道具
- 不禁止：情绪词、色彩、纹理、光线、类型词（cyberpunk/post-apocalyptic 等通用词）
- 状态：✅ 20 个主题全部通过（exit 0）

---

## 6. 成本估算

### 6.1 AI 生图成本

| 场景 | 单次成本 | 日调用（预估） | 日成本 |
|---|---|---|---|
| 免费预览（3 次/天/IP） | ~0.1 元 | 1000 次 | 100 元 |
| 付费下载 | ~0.2 元 | 200 次 | 40 元 |
| **合计** | — | 1200 次 | **140 元/天** |

### 6.2 其他成本

| 项目 | 成本 |
|---|---|
| Cloudflare Worker | 免费（<10 万请求/天） |
| Cloudflare KV | 免费（<10 万次读/天） |
| Cloudflare R2 | ~0.015 元/GB/月 |
| Resend 邮件 | 免费（<100 封/天） |
| **合计** | **<50 元/天** |

### 6.3 定价建议

| 档位 | 价格 | 说明 |
|---|---|---|
| 免费预览 | 0 元 | 带水印，3 次/天 |
| 单张下载 | 9.9 元 | 原图，无水印 |
| 套装（3 张） | 19.9 元 | 同主题不同尺寸 |

---

## 7. 分阶段计划

### 阶段 0：主题与合规（当前）

- [x] 20 部电影主题配置（`config/wallpaper-themes.json`）
- [x] 尺寸规则（`config/wallpaper-sizes.json`）
- [x] 合规自检脚本（`scripts/wallpaper-compliance-check.mjs`）
- [x] 方案文档（`docs/WALLPAPER-STAGE0-PLAN.md`）
- [x] 合规检查通过

### 阶段 1：Worker 生成端点

- [ ] `POST /wallpaper/generate` — 提交生成任务
- [ ] 调用 Seedream API（异步轮询）
- [ ] 生成完成 → 存 R2 `wallpapers/{themeId}/{size}/{taskId}.png`
- [ ] 返回预览（带水印压缩图）
- [ ] IP 限流（复用 `wallrl:{ip}` 模式，3 次/天）
- [ ] 子请求预算 <50

### 阶段 2：支付与订单

- [ ] 接入虎皮椒支付
- [ ] `POST /wallpaper/order` — 创建订单（KV）
- [ ] 支付回调 → 更新订单状态
- [ ] 生成下载链接（24h 有效，存 KV）

### 阶段 3：邮件交付

- [ ] 复用 `RESEND_API_KEY`
- [ ] `POST /wallpaper/send-download` — 发送下载链接邮件
- [ ] 下载链接验证 → 重定向到 R2 原图
- [ ] 邮件模板（zh/en）

### 阶段 4：前端页面

- [ ] `/wallpaper` 路由
- [ ] 主题选择（卡片网格）
- [ ] 尺寸选择（桌面/手机切换）
- [ ] 生成进度（轮询）
- [ ] 预览展示（带水印）
- [ ] 支付按钮（虎皮椒）
- [ ] 下载引导（邮件输入）

### 阶段 5：上线加固

- [ ] 错误处理（Seedream 超时/失败重试）
- [ ] R2 存储失败降级
- [ ] 邮件发送失败重试
- [ ] 下载链接过期处理
- [ ] 监控告警（GitHub Actions 定时检查）

---

## 8. 风险登记

| 风险 | 等级 | 缓解措施 |
|---|---|---|
| **版权侵权** | 高 | prompt 仅氛围词，合规脚本自检 |
| **支付渠道不可用** | 中 | 虎皮椒 + PayPal 双通道 |
| **AI 成本超预期** | 中 | IP 限流，免费额度，成本监控 |
| **Seedream 服务不稳定** | 中 | 重试逻辑，备选 SD API |
| **R2 存储失败** | 低 | 降级到临时下载链接 |
| **邮件发送失败** | 低 | 重试 + 前端提示重新发送 |
| **下载链接泄露** | 中 | 24h 过期，一次性 token |
| **子请求超限** | 中 | 新端点全冷 <50 |

---

## 9. 决策日志

| 日期 | 决策 | 理由 |
|---|---|---|
| 2026-10-14 | 存储用 KV 非 D1 | MVP 订单量小，KV 够用 |
| 2026-10-14 | AI 生图用 Seedream | 国内可达，商用授权，价格低 |
| 2026-10-14 | 支付用虎皮椒 | 免签约，微信+支付宝，个人可接入 |
| 2026-10-14 | R2 用 `wallpapers/` 前缀 | 复用现有 bucket，隔离缩略图 |
| 2026-10-14 | 尺寸 16:9 / 9:16 | 桌面/手机主流比例 |
| 2026-10-14 | 免费预览 3 次/天/IP | 控制成本，防止滥用 |
| 2026-10-14 | 下载链接 24h 过期 | 安全 + 存储成本 |

---

## 10. 下一阶段检查清单

**开始阶段 1 前确认**：
- [ ] Seedream API Key 已申请
- [ ] Seedream 价格/商用条款已确认
- [ ] Seedream 支持的尺寸/比例已确认
- [ ] 虎皮椒商户号已申请
- [ ] 虎皮椒费率/结算周期已确认
- [ ] 虎皮椒回调验签方式已确认

---

## 11. 文件清单

**新增文件**：
- `config/wallpaper-themes.json` — 20 个主题配置
- `config/wallpaper-sizes.json` — 尺寸规则
- `scripts/wallpaper-compliance-check.mjs` — 合规自检脚本
- `docs/WALLPAPER-STAGE0-PLAN.md` — 本文档

**未修改任何现有文件**。
