/**
 * Wallpaper generation helpers — Worker 内联版（阶段 1）
 * ---------------------------------------------------------------------------
 * 设计要点（对应 P0–P3 子任务）：
 *  - 与 scripts/seedream-client.mjs 共用同一套规格常量（SEEDREAM_SPEC 单点定义，
 *    本文件只保存"权威副本"，内联进 workers-1.4.js 时两处需同步）。
 *  - 模型调用与业务路由分离：validateWallGenRequest / buildSeedreamBody /
 *    pickSeedreamTier 是纯函数，未来换模型只改这里，不动路由。
 *  - 不依赖任何 npm 依赖（sharp=0，全仓库零 sharp 依赖），预览降级走方案 A：
 *    免费用户请求"预览尺寸"，用同样的 prompt 生成一张更小的图，
 *    成本仅为原图的若干分之一；原图 URL 24h 有效且不落 R2 公开桶。
 *  - 免费预览绝不返回原图 URL：authenticated 前 REFUSE。
 *
 * ⚠️ 本文件未接入真实凭证，不发任何外部请求。
 */

// ── 规格（与 scripts/seedream-client.mjs 保持一致）──────────────────────────
export const WALL_SEEDREAM_SPEC = {
  endpoint: "https://ark.cn-beijing.volces.com/api/v3/images/generations",
  tiers: {
    pro: {
      model: "doubao-seedream-5-0-pro-260628",
      pixelRange: [921600, 4624220],
      aspectRange: [1 / 16, 16],
      sequential: false,
    },
    lite: {
      model: "doubao-seedream-5-0-lite-260128",
      pixelRange: [3686400, 16777216],
      aspectRange: [1 / 16, 16],
      sequential: true,
    },
  },
  urlTtlSeconds: 86400,
  promptMaxZhChars: 300,
  promptMaxEnWords: 600,
};

/**
 * 预览尺寸（免费）。⚠️ 受 provider 约束：预览图也必须落在所选模型的总像素区间内，
 * 无法做到"任意小"。取 pro 档下限 921,600 恰好踩线，是当前最便宜的合法预览：
 *   1280x720 = 921,600 px（桌面推荐档 2560x1440 = 3,686,400 的 25%）
 *    720x1280 = 921,600 px（手机推荐档 1333x2368 = 3,156,544 的 29%）
 * 即免费预览成本约为原图的 1/4–1/3（多数模型按 token/像素计费）。
 * 若改用 lite 档，预览下限反而升到 3,686,400，无法更便宜 —— 这也是档位选择的一环。
 */
export const WALL_PREVIEW_SIZES = {
  desktop: { width: 1280, height: 720 },  // 921,600 px = pro 档下限
  mobile: { width: 720, height: 1280 },   // 921,600 px = pro 档下限
};

/** 免费额度（防烧钱）：每 IP 每天 N 次预览生成 */
export const WALL_FREE_DAILY_LIMIT = 3;

// ── 校验：尺寸与宽高比（纯函数，不依赖 env）────────────────────────────────
export function validateWallPixelRange(width, height, tierName = "pro") {
  const tier = WALL_SEEDREAM_SPEC.tiers[tierName] || WALL_SEEDREAM_SPEC.tiers.pro;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return { ok: false, reason: "width/height must be positive integers" };
  }
  const px = width * height;
  if (px < tier.pixelRange[0] || px > tier.pixelRange[1]) {
    return { ok: false, reason: `total pixels ${px} outside ${tierName} range ${tier.pixelRange.join("..")}` };
  }
  const ar = width / height;
  if (ar < tier.aspectRange[0] || ar > tier.aspectRange[1]) {
    return { ok: false, reason: `aspect ${ar.toFixed(4)} outside range ${tier.aspectRange.join("..")}` };
  }
  return { ok: true, totalPixels: px, aspect: ar, tier: tier.model };
}

// ── 校验：主题 ID 必须存在于唯一数据源 ────────────────────────────────────
export function findTheme(themesJson, themeId) {
  const theme = (themesJson?.themes || []).find((t) => t.id === themeId && t.enabled !== false);
  return theme || null;
}

/** 从 sizes 配置里按 device 取推荐档；不存在则回落桌面 */
export function pickSizeEntry(sizesJson, device) {
  const list = (sizesJson?.sizes || {})[device] || sizesJson?.sizes?.desktop || [];
  const rec = list.find((s) => s.recommended) || list[0];
  return rec ? { width: rec.width, height: rec.height, label: rec.label } : null;
}

/**
 * 组装 Seedream 请求体。
 * @param {object} o
 * @param {object} o.theme       config/wallpaper-themes.json 中的主题对象
 * @param {number} o.width
 * @param {number} o.height
 * @param {boolean} o.watermark  免费=true（保留 provider 水印）；付费=false
 * @param {string}  o.tierName   pro | lite
 */
export function buildWallGenBody({ theme, width, height, watermark, tierName = "pro" }) {
  const tier = WALL_SEEDREAM_SPEC.tiers[tierName] || WALL_SEEDREAM_SPEC.tiers.pro;
  const prompt = (theme.prompt_template || "")
    .replace("{mood}", (theme.mood || []).join(", "))
    .replace("{palette}", (theme.palette || []).join(", "))
    .replace("{composition}", theme.composition || "")
    .slice(0, WALL_SEEDREAM_SPEC.promptMaxZhChars * 2); // 冗余裁剪，中文≤300 字

  const body = {
    model: tier.model,
    prompt,
    size: `${width}x${height}`,
    response_format: "url",
    watermark: watermark !== false,
  };
  // pro 等旗舰单图模型不接受 sequential_image_generation
  if (tier.sequential) body.sequential_image_generation = "disabled";
  return body;
}

/** 判断是否为"已授权付费"的请求；未授权一律视为免费层 */
export function isPaidEntitled(entitlement) {
  return entitlement?.paid === true && typeof entitlement?.orderId === "string" && entitlement.orderId.length > 0;
}

/**
 * 预览/原图交付决策（任务④核心）。
 * 免费层：只返回 preview 尺寸 + watermark=true，且【绝不返回原图 URL】。
 * 付费层：返回原始尺寸 + watermark=false，URL 24h 有效，须立即转存 R2。
 * @returns {{ok:true, mode:"preview"|"full", width, height, watermark, reason}|{ok:false, reason}}
 */
export function decideWallDelivery({ entitlement, device, theme, sizesJson, requestedTier = "pro" }) {
  const paid = isPaidEntitled(entitlement);
  const tierName = WALL_SEEDREAM_SPEC.tiers[requestedTier] ? requestedTier : "pro";

  if (paid) {
    const full = pickSizeEntry(sizesJson, device);
    const chk = validateWallPixelRange(full.width, full.height, tierName);
    if (!chk.ok) return { ok: false, reason: `config size invalid: ${chk.reason}` };
    return { ok: true, mode: "full", width: full.width, height: full.height, watermark: false, tierName, reason: "paid entitlement" };
  }

  const preview = WALL_PREVIEW_SIZES[device] || WALL_PREVIEW_SIZES.desktop;
  const chk = validateWallPixelRange(preview.width, preview.height, tierName);
  if (!chk.ok) return { ok: false, reason: `preview size invalid: ${chk.reason}` };
  return { ok: true, mode: "preview", width: preview.width, height: preview.height, watermark: true, tierName, reason: "free tier: preview only, no original url" };
}

// ── 免费限额计数器（KV，复用已有命名风格 wallrl:{ip}）──────────────────────
/** 键：wallgen:{ip}:{UTC日期}，值：当日已用次数 */
export function wallDailyKey(ip, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  return `wallgen:${ip || "unknown"}:${day}`;
}

/**
 * 套装结构预留（任务⑤）：未来商品是 1..N 张已审核图片的集合。
 * 本函数只做形状校验，确保前端/后端在"单张"阶段就按集合思考，
 * 便于未来无痛从单张扩到 3–5 张套装（市场参考：3–5 张/套，中位价 ¥3.88，用户提供）。
 */
export function normalizeBundle(items) {
  const list = Array.isArray(items) ? items : items ? [items] : [];
  const out = list.filter((it) => it && typeof it.assetId === "string").map((it) => ({
    assetId: it.assetId,
    kind: it.kind || "still",
    sizeKey: it.sizeKey || null,
  }));
  if (out.length === 0) return { ok: false, reason: "bundle requires at least 1 asset" };
  if (out.length > 5) return { ok: false, reason: "bundle max 5 assets" };
  return { ok: true, items: out, count: out.length, isBundle: out.length > 1 };
}
