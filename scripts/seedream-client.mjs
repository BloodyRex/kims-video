/**
 * Seedream (火山方舟) 客户端 — 阶段 1 MVP
 *
 * 设计原则：
 *  - 零依赖纯 fetch，可在 Worker 与 Node 22 自测脚本中共用同一份实现
 *  - 所有规格常量集中在 SEEDREAM_SPEC，便于与官方文档逐项对齐
 *  - prompt 一律来自 config/wallpaper-themes.json，禁止电影角色名/片名
 *
 * 官方依据（2026-10-14 核实，火山方舟 Seedream 图片生成 API）：
 *  - 端点 POST https://ark.cn-beijing.volces.com/api/v3/images/generations
 *  - 鉴权 Authorization: Bearer <ARK_API_KEY>
 *  - 同步返回（无需异步轮询）：响应 data[0].url / data[0].size
 *  - response_format: "url"（24 小时有效）| "b64_json"
 *  - watermark: 默认 true（右下角 "AI生成" 水印）；false 关闭
 *  - size 两种模式不可混用：分辨率档位(1K/1.5K/2K) 或 显式 widthxheight
 *  - 显式模式总像素区间随模型档位不同：pro/4.5 为 [921,600, 4,624,220]，
 *    lite/4.0 为 [3,686,400, 16,777,216]；宽高比均为 [1/16, 16]（见 MODEL_TIERS）
 */

/**
 * 模型档位。⚠️ 各档官方总像素区间不同，必须与 model 严格配对：
 *  5.0 pro / 4.5  : [921,600, 4,624,220]        宽高比 [1/16, 16]
 *  5.0 lite / 4.0 : [3,686,400, 16,777,216]     宽高比 [1/16, 16]
 * 全部需官方文档二次确认（账号实际可用档位可能不同）。
 * 2026-10-14 核实来源：volcengine.com/docs/82379/1541523 及第三方镜像文档。
 */
export const MODEL_TIERS = {
  pro: {
    model: "doubao-seedream-5-0-pro-260628",
    pixelRange: [921600, 4624220],
    aspectRange: [1 / 16, 16],
    sequential: false, // 旗舰单图模型，不支持组图/流式/联网
  },
  lite: {
    model: "doubao-seedream-5-0-lite-260128",
    pixelRange: [3686400, 16777216],
    aspectRange: [1 / 16, 16],
    sequential: true,
  },
};

export const SEEDREAM_SPEC = {
  endpoint: "https://ark.cn-beijing.volces.com/api/v3/images/generations",
  /** ⏳ 待账号确认后从 MODEL_TIERS 中定稿：当前按 pro 档（上限最低，最保守） */
  model: MODEL_TIERS.pro.model,
  /** 与 model 配对；pro 档为 921600..4624220，lite 档为 3686400..16777216 */
  pixelRange: MODEL_TIERS.pro.pixelRange,
  aspectRange: MODEL_TIERS.pro.aspectRange,
  /** pro 为旗舰单图模型，不支持 sequential_image_generation / stream / tools */
  supportsSequential: MODEL_TIERS.pro.sequential,
  urlTtlSeconds: 86400,
  /** prompt 上限：中文 ≤300 字 / 英文单词 ≤600 */
  promptMaxZhChars: 300,
  promptMaxEnWords: 600,
  tiers: MODEL_TIERS,
};

/** 模型默认开启水印；免费预览保留，付费必须显式关闭 */
export const WATERMARK_DEFAULT = true;

/**
 * 组装最终 prompt。
 * 黑名单合规规则见 docs/WALLPAPER-STAGE0-PLAN.md §5.2：
 *  禁止 电影角色名 / 片名 / 标志性场景与道具；允许 情绪、色彩、纹理、光线、类型词。
 * @param {{mood:string,palette:string,composition:string}} tokens
 * @returns {string}
 */
export function buildPrompt(tokens) {
  const parts = [];
  if (tokens.mood) parts.push(tokens.mood);
  if (tokens.palette) parts.push(tokens.palette);
  if (tokens.composition) parts.push(tokens.composition);
  return parts.join(", ").replace(/\s+/g, " ").trim();
}

/** 粗测 prompt 长度，超出则抛错，避免请求被 provider 拒绝 */
export function assertPromptLength(prompt, spec = SEEDREAM_SPEC) {
  if (prompt.length > spec.promptMaxZhChars * 3) {
    throw new Error(`prompt too long: ${prompt.length} chars`);
  }
  return true;
}

/**
 * 校验显式尺寸是否在 provider 允许的区间内。
 * @returns {{ok: boolean, reason?: string, pixels: number, aspect: number}}
 */
export function validateSize(width, height, spec = SEEDREAM_SPEC) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0) {
    return { ok: false, reason: "width/height must be positive integers", pixels: 0, aspect: 0 };
  }
  const pixels = w * h;
  const aspect = w / h;
  const [minPx, maxPx] = spec.pixelRange;
  const [minAr, maxAr] = spec.aspectRange;
  if (pixels < minPx) return { ok: false, reason: `pixels ${pixels} < min ${minPx}`, pixels, aspect };
  if (pixels > maxPx) return { ok: false, reason: `pixels ${pixels} > max ${maxPx}`, pixels, aspect };
  if (aspect < minAr) return { ok: false, reason: `aspect ${aspect.toFixed(4)} < min ${minAr}`, pixels, aspect };
  if (aspect > maxAr) return { ok: false, reason: `aspect ${aspect.toFixed(4)} > max ${maxAr}`, pixels, aspect };
  return { ok: true, pixels, aspect };
}

/**
 * 构造 images/generations 请求体。
 * @param {object} opts
 * @param {string} opts.prompt        最终 prompt（buildPrompt 产物）
 * @param {{width:number,height:number,label?:string}} opts.sizeEntry
 * @param {boolean} [opts.watermark] 免费预览传 true；付费 false
 * @param {"url"|"b64_json"} [opts.responseFormat]
 */
export function buildRequest(opts, spec = SEEDREAM_SPEC) {
  const { prompt, sizeEntry, watermark = WATERMARK_DEFAULT, responseFormat = "url" } = opts;
  assertPromptLength(prompt, spec);
  const v = validateSize(sizeEntry.width, sizeEntry.height, spec);
  if (!v.ok) throw new Error(`invalid size ${sizeEntry.width}x${sizeEntry.height}: ${v.reason}`);

  const body = {
    model: spec.model,
    prompt,
    size: `${sizeEntry.width}x${sizeEntry.height}`,
    response_format: responseFormat,
    watermark,
  };
  // 5.0 pro 等旗舰单图模型不支持 sequential_image_generation 字段，发送会被 400 拒绝
  if (spec.supportsSequential !== false) {
    body.sequential_image_generation = "disabled";
  }
  return body;
}

/**
 * 调用 Seedream 生成一张图（同步返回）。
 * @param {object} opts 同 buildRequest，另接受 apiKey / fetchImpl / signal
 * @returns {Promise<{url:string,size:string,model:string,watermark:boolean,usage?:object}>}
 */
export async function generateImage(opts, spec = SEEDREAM_SPEC) {
  const { apiKey, fetchImpl, signal } = opts;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  const doFetch = fetchImpl || fetch;
  const res = await doFetch(spec.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(buildRequest(opts, spec)),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Seedream HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }

  const json = await res.json();
  const first = json && json.data && json.data[0];
  if (!first) throw new Error("Seedream response missing data[0]");

  return {
    url: first.url,
    size: first.size,
    model: json.model,
    usage: json.usage,
  };
}
