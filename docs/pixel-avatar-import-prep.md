# 像素分身 · 外部导入与数据驱动升级 · 前期准备

> 本文档是 `docs/pixel-avatar-plan.md` 的后续延伸，专门服务于「下一版外部 HTML 像素分身」的导入准备与数据驱动升级规则。  
> 状态：前期准备 / 待确认（尚未接入外部文件，未发布）。

## 1. 外部导入准备（Import Readiness）

### 1.1 文件约定
- 外部交付稿统一命名：`pixel_avatar_vN.html`（N 递增），放在附件/`handoff/pixel-avatar/` 或约定目录。
- 导入前必须先落盘到 `scratch/` 做切片分析，禁止直接覆盖 `src/components/pixelAvatarEngine.js`。
- 导入产物固定为：
  - `src/components/pixelAvatarEngine.js`（引擎模块，`node --check` 必须通过）
  - `src/components/PixelAvatar.jsx`（React 壳，消费引擎导出）
- 提取脚本模板：`scratch/build_engine.js`（区间切片 + CSS 作用域化 `.kv-px` / `kvpx-` 前缀），每次导入新建 `build_engine_vN.js`，保留旧脚本以便回滚。

### 1.2 导入检查清单（vN → 项目）
1. 读取外部 HTML 的 `<style>` 块 → 落盘 `scratch/vN.css`，确认 `@keyframes` 数量与动画类名。
2. 定位 `OUT` 常量、sceneBlock、sceneMeta、looks/lookPalette、avatarSVG 的行锚点，记录到脚本注释。
3. 切片抽取：`take(scenes)` / `take(sceneMeta)` / `take(looks)` / `take(avatarSVG)`，含端点勿切散（第 322 行 `return {...}`、第 323 行闭合 `}`）。
4. CSS 作用域化：所有选择器加 `.kv-px` 前缀，keyframes 加 `kvpx-` 前缀，避免全局污染。
5. 属性修正：模板字符串中的 `strokeWidth=` → `stroke-width=`（kebab-case）。
6. 生成引擎后 `node --check` + ESM 导入探针（落盘报告，不依赖终端压缩输出）。
7. React 壳更新：确认引擎导出名（`STYLE_KEYS / SCENE_KEYS / SCENE_META / scenePalette / pickSceneKey / buildAvatar / PIXEL_CSS`）未破坏；若有新增导出，同步更新壳。
8. 构建 + dev server + 浏览器冒烟（SVG 外壳、reroll、debug 面板）。

### 1.3 兼容性红线
- 不得修改/覆盖既有收藏、推荐、搜索存储结构（`personalStore.js` 只读）。
- 新增的等级/倾向/解锁数据一律 **运行时派生**（derive-on-load），不写入持久化存储；避免迁移/兼容问题。
- `pixelAvatarPrefs` 类写入路径暂不启用。

## 2. 标题与图标一致性（Icon Dedup）

### 2.1 现状问题
- `MyDataPanel.jsx` 中像素分身 section 使用 `Icons.Star`（cyan），与「我收藏的卡片」section 同样使用 `Icons.Star`（yellow）——图标重复。
- 其余 section 图标：收藏 Star、推荐 Film、统计 Target。

### 2.2 调整方案
- 像素分身 section 改用独立图标 `Icons.User`（人物剪影），与其它 section 设计语言一致（同尺寸 `w-4 h-4`、同 PixelSection 布局）。
- 图标颜色建议 `#00ffff`（与像素分身主色调一致），避免与收藏的 `#ffff00` 混淆。
- 标题文案保持 `t("pixel.avatar.title")`（中「像素分身」/ 英「Pixel Avatar」），不新增重复文案。

## 3. 用户数据 → 像素分身内容关联

### 3.1 数据来源（只读）
| 来源 | 字段 | 权重 | 用途 |
|---|---|---|---|
| 搜索 | `searches[].query` | 2 | 用户主动兴趣 |
| 收藏 | `favorites[].title/genre/category/genres` | 3 | 明确正反馈 |
| 推荐 | `recos[].payload.recommendations[].matchedTags/genres` | 1 | 被动展示 |

### 3.2 风格偏好（已实现）
- `analyzeStylePreference()` 输出 `style`（8 选 1）、`scores`、`evidence`、`deduped`、`totalSamples`、`fallback`、`reason`。
- 场景由 `style` 自动匹配（方案 B），同一风格可挂多套背景（`SCENE_KEYS[style]` 数组）。

### 3.3 倾向级别（8 类目）— 新增规划
对 8 个风格分别计算倾向级别，而非仅取 top1：

| 级别 | 名称 | 类目得分阈值（拟议，默认待确认） |
|---|---|---|
| Lv0 | 未入门 | 0 |
| Lv1 | 初探 | ≥1 |
| Lv2 | 爱好 | ≥3 |
| Lv3 | 熟客 | ≥6 |
| Lv4 | 达人 | ≥10 |
| Lv5 | 大师 | ≥15 |

- 实现：`computeTendencyLevels(scores)` → `{ [style]: { score, level, label } }`（纯函数，已加入 `stylePreference.js`）。
- 调试面板需展示 8 类目得分与级别（可解释性验收标准）。

### 3.4 用户总级别（外形：人物大小）
- 总分 `totalScore = sum(scores)`；总级别 `overallLevel = clamp(floor(totalScore / 5), 0, 5)`（拟议）。
- 像素分身外形映射（拟议）：

| 总级别 | 人物高度比例 | 视觉变化 |
|---|---|---|
| Lv0 | 70% | 默认小体型 |
| Lv1 | 80% | — |
| Lv2 | 90% | — |
| Lv3 | 100% | 基准 |
| Lv4 | 115% | — |
| Lv5 | 130% | 大体型 |

- `buildAvatar` 需支持 `sizeScale` 参数（待外部版本/引擎更新时接入）。

### 3.5 解锁：坐骑 / 工具 / 武器
- 解锁条件二选一（待确认）：① 总级别达到阈值；② 某类目达到 Lv4/Lv5（精通）。
- 拟议解锁表（占位，资产名待 vN HTML 提供）：

| 条件 | 解锁 |
|---|---|
| 总 Lv2 | 工具：探索指南针 |
| 总 Lv3 | 武器：基础光刃 |
| 总 Lv4 | 坐骑：机械飞骑 |
| 某类目 Lv4 | 该类目专属配饰/武器皮肤 |
| 总 Lv5 | 终极坐骑 + 专属背景变体 |

- 资产命名与 SVG 片段需在外部 HTML vN 中定义后才能落地；当前仅预留 `unlocks` 数据结构。

## 4. 升级规则（Upgrade Rules）
1. 所有等级/倾向/解锁均为数据派生，每次 `load()` 重新计算，不持久化。
2. 阈值调整只改 `stylePreference.js` 常量，不影响存储。
3. 新用户（无数据）→ Lv0 / 默认场景 `sci-fi` / 基准体型 / 无解锁，保证不白屏。
4. 打平（tie）时保持上一次风格（或默认），避免随机跳变（已实现）。
5. 调试面板展示：总级别、8 类目级别、解锁列表、数据来源计数。

## 5. 接入下一版外部 HTML 的准备状态
- [x] 导入检查清单文档化
- [x] 图标去重（Icons.User）
- [x] 倾向级别纯函数（computeTendencyLevels）
- [ ] 等待外部 `pixel_avatar_v4.html`（或 vN）交付
- [ ] 根据 vN 资产名填充解锁表与 sizeScale 接入

## 6. 待确认事项（Uncertainties）
1. **下一版外部 HTML 的内容与资产命名**：坐骑/工具/武器的 SVG 片段与 id 命名未知，解锁表无法最终化。请提供 vN 文件后再细化。
2. **图标选择**：拟用 `Icons.User`（人物剪影）替换重复的 Star。是否接受？或希望用像素风自定义图标？
3. **等级阈值与节奏**：Lv 阈值（1/3/6/10/15）与总级别步进（每 5 分一级）为拟议值，需确认升级节奏是否过快/过慢。
4. **外形变化方式**：人物大小用高度比例缩放，还是切换不同 SVG 资产（大/中/小三套）？影响引擎改造深度。
5. **解锁粒度**：解锁是按总级别，还是按类目精通（Lv4）触发？还是两者并存？
6. **是否需要持久化解锁状态**：当前方案为运行时派生。若希望「解锁后永久保留即使数据减少」，需要新增存储字段（与兼容性红线冲突，需明确）。
7. **调试面板范围**：是否在生产环境也开放倾向级别/解锁调试（当前仅 dev / `?pxdebug=1`）？
8. **多背景扩展时机**：同一风格多背景的数组架构已预留，但何时启用随机/轮换？是否等 vN 提供多套背景资产。
9. **8 类目得分展示**：是否需要在 My Data 面板显式展示 8 类目倾向条（不仅是 debug），作为用户可见的「兴趣画像」？

> 请 Rex 逐条确认或给出调整，确认后开始 vN 导入与引擎改造。

## 7. v7 外部稿接入决策（本轮确定）

基于 `pixel_avatar_v7.html`（无尽巡游版）接入，9 个不确定点确定如下：

1. **资产来源**：以 v7 为当前接入基线，后续定稿再替换；所有改动仅 additive，不改旧存储。
2. **图标**：My Data section 标题继续使用 `Icons.User`，与其它 section 一致、不重复；v7 自带品牌不额外改。
3. **等级阈值**：保留 Lv0–Lv5（0/1/3/6/10/15），通过 `overallLevel(scores)*2` 映射到 v7 的 1–10 等级，避免改动 v7 内部公式。
4. **外形变化**：使用 v7 内置的按等级缩放高度（`(139+(level-1)*3.35)*.70`），不另做 SVG 资产切换。
5. **解锁规则**：直接采用 v7 内置解锁表（Lv2/5/8/9/10 五项）与装备列表，不重新设计。
6. **持久化**：保持运行时派生（不写 `pixelAvatarPrefs`），符合兼容旧数据红线；v7 的手动等级滑块仅用于预览。
7. **调试面板**：dev/`?pxdebug=1` 打开 wrapper 调试；v7 自带 `?debug=1` 仍可通过 URL 手动追加。
8. **多背景**：v7 的 8 张地图已按 8 类目一一对应，styleHint 自动选 map，后期扩展只加地图条目。
9. **8 类目画像**：My Data 面板仅展示主风格 + 等级；完整画像走 debug 面板，避免界面臃肿。

**接入方式**：v7 作为独立 HTML 放入 `public/pixel-avatar-v7.html`，通过 iframe 嵌入 My Data 面板顶部，query params 传入 `map/look/level/lang`，保留其全部功能与布局。这是定稿前的铺垫版本。
