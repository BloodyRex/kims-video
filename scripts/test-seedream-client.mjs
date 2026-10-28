/**
 * Seedream 客户端自测（阶段 1）— 纯 Node，不发真实请求。
 * 运行：node scripts/test-seedream-client.mjs
 */
import { readFileSync } from "node:fs";
import {
  SEEDREAM_SPEC,
  MODEL_TIERS,
  buildPrompt,
  buildRequest,
  validateSize,
  generateImage,
} from "./seedream-client.mjs";

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail = "") {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(`${name}${detail ? " :: " + detail : ""}`);
  }
}

// ---- 1. config 尺寸全部合规 ---------------------------------------------
const sizesCfg = JSON.parse(readFileSync(new URL("../config/wallpaper-sizes.json", import.meta.url), "utf8"));
const allSizes = [];
for (const kind of Object.keys(sizesCfg.sizes)) {
  for (const s of sizesCfg.sizes[kind]) allSizes.push({ kind, ...s });
}
check("sizes count = 8", allSizes.length === 8, `got ${allSizes.length}`);
for (const s of allSizes) {
  const v = validateSize(s.width, s.height);
  check(`size ${s.kind} ${s.width}x${s.height} in provider range`, v.ok, v.reason);
}
check("3840x2160 removed", !allSizes.some((s) => s.width === 3840 && s.height === 2160));

// ---- 2. 越界尺寸必须被拦截 ---------------------------------------------
const overPixels = validateSize(3840, 2160);
check("3840x2160 rejected (over max pixels)", !overPixels.ok, overPixels.reason);
check("oversized pixels", buildRequest.bind(null, {
  prompt: "test",
  sizeEntry: { width: 3840, height: 2160 },
}) instanceof Function ? (() => {
  try { buildRequest({ prompt: "test", sizeEntry: { width: 3840, height: 2160 } }); return false; }
  catch { return true; }
})() : false);

const tooSmall = validateSize(512, 512);
check("512x512 rejected (under min pixels)", !tooSmall.ok, tooSmall.reason);
check("non-integer rejected", !validateSize(100.5, 200).ok);
check("zero rejected", !validateSize(0, 1000).ok);

// ---- 3. prompt 组装 ----------------------------------------------------
const p = buildPrompt({
  mood: "寂静的赛博夜色，霓虹在水面折射",
  palette: "冷蓝与洋红，高对比",
  composition: "大面积负空间，地平线压低下三分之一",
});
check("buildPrompt joins with comma", p === "寂静的赛博夜色，霓虹在水面折射, 冷蓝与洋红，高对比, 大面积负空间，地平线压低下三分之一", p);
check("buildPrompt skips empty token", buildPrompt({ mood: "a", palette: "", composition: "c" }) === "a, c");
check("buildPrompt collapses whitespace", buildPrompt({ mood: "  a   b  " }) === "a b");

// ---- 4. 请求体形态（对齐官方字段）-------------------------------------
const body = buildRequest({
  prompt: p,
  sizeEntry: { width: 2560, height: 1440 },
  watermark: true,
});
check("body has model", body.model === SEEDREAM_SPEC.model);
check("body size string format", body.size === "2560x1440", body.size);
check("body response_format url", body.response_format === "url");
check("body watermark true for free", body.watermark === true);
check("body sequential disabled (default pro tier)", body.sequential_image_generation === undefined);
check("body has no extra keys (pro tier)", Object.keys(body).sort().join(",") === "model,prompt,response_format,size,watermark");

// ---- 5. mock fetch（不发真实请求）--------------------------------------
let sentUrl = "";
let sentHeaders = null;
let sentBody = null;
const fakeFetch = async (url, init) => {
  sentUrl = url;
  sentHeaders = init.headers;
  sentBody = JSON.parse(init.body);
  return {
    ok: true,
    json: async () => ({
      model: SEEDREAM_SPEC.model,
      data: [{ url: "https://example.invalid/img.png", size: "2560x1440" }],
      usage: { generated_images: 1, output_tokens: 1 },
    }),
  };
};
const out = await generateImage({
  prompt: p,
  sizeEntry: { width: 2560, height: 1440 },
  apiKey: "test-key",
  fetchImpl: fakeFetch,
});
check("fetch hits ark endpoint", sentUrl === SEEDREAM_SPEC.endpoint, sentUrl);
check("authorization bearer header", sentHeaders.Authorization === "Bearer test-key");
check("content-type header", sentHeaders["Content-Type"] === "application/json");
check("mock returns url", out.url === "https://example.invalid/img.png");
check("mock returns usage", out.usage && out.usage.generated_images === 1);

// 付费场景：watermark 必须为 false
await generateImage({
  prompt: p,
  sizeEntry: { width: 1080, height: 1920 },
  watermark: false,
  apiKey: "test-key",
  fetchImpl: fakeFetch,
});
check("paid request disables watermark", sentBody.watermark === false);

// ---- 6. HTTP 错误路径 ---------------------------------------------------
let errMsg = "";
try {
  await generateImage({
    prompt: p,
    sizeEntry: { width: 2560, height: 1440 },
    apiKey: "bad-key",
    fetchImpl: async () => ({ ok: false, status: 401, text: async () => "InvalidApiKey" }),
  });
} catch (e) {
  errMsg = e.message;
}
check("http error throws with status", errMsg.includes("401") && errMsg.includes("InvalidApiKey"), errMsg);

// ---- 7. 越界尺寸在网络层之前就该被拒绝 ------------------------------
let sizeErr = "";
try {
  await generateImage({
    prompt: p,
    sizeEntry: { width: 3840, height: 2160 },
    apiKey: "k",
    fetchImpl: async () => {
      throw new Error("NETWORK_SHOULD_NOT_BE_CALLED");
    },
  });
} catch (e) {
  sizeErr = e.message;
}
check("oversized size blocked before network", sizeErr.startsWith("invalid size"), sizeErr);

// ---- 8. 模型档位区间并行校验（pro 上限最低，lite 上限最高） -------------
check("MODEL_TIERS has pro+lite", !!MODEL_TIERS.pro?.pixelRange && !!MODEL_TIERS.lite?.pixelRange);
check("pro pixel range", JSON.stringify(MODEL_TIERS.pro.pixelRange) === "[921600,4624220]");
check("lite pixel range", JSON.stringify(MODEL_TIERS.lite.pixelRange) === "[3686400,16777216]");
check("spec bound to pro tier by default", SEEDREAM_SPEC.model === MODEL_TIERS.pro.model);
check("pro model id is full string", SEEDREAM_SPEC.model === "doubao-seedream-5-0-pro-260628");
check("pro has no sequential flag", MODEL_TIERS.pro.sequential === false);
check("lite has sequential flag", MODEL_TIERS.lite.sequential === true);

const reqPro = buildRequest({ prompt: p, sizeEntry: { width: 1440, height: 2560 } });
check("pro tier omits sequential_image_generation", reqPro.sequential_image_generation === undefined);
const reqLite = buildRequest({ prompt: p, sizeEntry: { width: 1440, height: 2560 } }, {
  ...SEEDREAM_SPEC,
  ...MODEL_TIERS.lite,
  supportsSequential: MODEL_TIERS.lite.sequential,
});
check("lite tier sends sequential_image_generation=disabled", reqLite.sequential_image_generation === "disabled");

// lite 下限高于 pro：1920x1080(2,073,600) 在 pro 合法、在 lite 非法 → 档位必须配对校验
const underLite = validateSize(1920, 1080, { ...SEEDREAM_SPEC, ...MODEL_TIERS.lite });
check("1920x1080 rejected under lite tier", underLite.ok === false, underLite.reason);
const underPro = validateSize(1920, 1080, SEEDREAM_SPEC);
check("1920x1080 accepted under pro tier", underPro.ok === true);

// ---- 汇总 --------------------------------------------------------------
console.log(`\n合计: ${pass + fail} 项 | 通过 ${pass} | 失败 ${fail}`);
if (fail > 0) {
  console.log("失败项:");
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log("SEEDREAM_CLIENT_TEST=PASS");

