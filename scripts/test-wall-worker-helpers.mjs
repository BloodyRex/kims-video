/**
 * wall-worker-helpers 测试（阶段 1）
 * 运行：node scripts/test-wall-worker-helpers.mjs
 * 结论打印 SEEDREAM_WALL_HELPERS_TEST=PASS
 */
import assert from "node:assert/strict";
import {
  WALL_SEEDREAM_SPEC, WALL_PREVIEW_SIZES, WALL_FREE_DAILY_LIMIT,
  validateWallPixelRange, findTheme, pickSizeEntry, buildWallGenBody,
  isPaidEntitled, decideWallDelivery, wallDailyKey, normalizeBundle,
} from "./wall-worker-helpers.mjs";
import WALL_THEMES from "../config/wallpaper-themes.json" with { type: "json" };
import WALL_SIZES from "../config/wallpaper-sizes.json" with { type: "json" };

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  -", name); }
  catch (e) { fail++; console.log("  FAIL-", name, "\n       ", e.message); }
}
console.log("wall-worker-helpers tests");

// ── 1. spec 档位 ────────────────────────────────────────────────
t("spec has pro+lite tiers", () => {
  assert.equal(WALL_SEEDREAM_SPEC.tiers.pro.model, "doubao-seedream-5-0-pro-260628");
  assert.equal(WALL_SEEDREAM_SPEC.tiers.lite.model, "doubao-seedream-5-0-lite-260128");
  assert.equal(WALL_SEEDREAM_SPEC.tiers.pro.pixelRange[0], 921600);
  assert.equal(WALL_SEEDREAM_SPEC.tiers.lite.pixelRange[0], 3686400);
});
t("spec endpoint + ttl", () => {
  assert.match(WALL_SEEDREAM_SPEC.endpoint, /^https:\/\/ark\.cn-beijing\.volces\.com/);
  assert.equal(WALL_SEEDREAM_SPEC.urlTtlSeconds, 86400);
});

// ── 2. 尺寸区间校验 ──────────────────────────────────────────────
t("desktop recommended 2560x1440 ok on pro", () => {
  const r = validateWallPixelRange(2560, 1440, "pro");
  assert.equal(r.ok, true); assert.equal(r.totalPixels, 3686400);
});
t("3840x2160 rejected on pro (8.29M > 4.62M)", () => {
  assert.equal(validateWallPixelRange(3840, 2160, "pro").ok, false);
});
t("3840x2160 ACCEPTED on lite (8.29M within [3.69M..16.78M])", () => {
  // 事实：3840x2160 只超 pro 上限，在 lite 区间内合法。
  assert.equal(validateWallPixelRange(3840, 2160, "lite").ok, true);
});
t("960x540 rejected on pro (518400 < 921600 floor)", () => {
  assert.equal(validateWallPixelRange(960, 540, "pro").ok, false);
});
t("aspect out of range rejected", () => {
  assert.equal(validateWallPixelRange(20000, 100, "pro").ok, false);
});
t("non-integer rejected", () => {
  assert.equal(validateWallPixelRange(10.5, 10, "pro").ok, false);
});

// ── 3. 预览尺寸合法性（关键：不能低于 provider 下限）────────────
t("preview sizes are provider-legal on pro tier", () => {
  for (const dev of ["desktop", "mobile"]) {
    const p = WALL_PREVIEW_SIZES[dev];
    assert.equal(validateWallPixelRange(p.width, p.height, "pro").ok, true, dev);
  }
});
t("preview size is BELOW lite floor -> lite tier cannot serve free preview", () => {
  // 事实：921,600 px 恰为 pro 下限，但低于 lite 下限 3,686,400。
  // 意味：若未来切到 lite 档，免费预览尺寸必须上调到 ≥3,686,400，免费成本会翻倍以上。
  assert.equal(validateWallPixelRange(1280, 720, "lite").ok, false);
  assert.equal(validateWallPixelRange(1920, 1920, "lite").ok, true); // 3,686,400 = lite floor
});
t("free daily limit is 3", () => assert.equal(WALL_FREE_DAILY_LIMIT, 3));

// ── 4. 主题与尺寸读取（唯一数据源）────────────────────────────────
t("findTheme returns shawshank", () => {
  const th = findTheme(WALL_THEMES, "shawshank-redemption");
  assert.ok(th); assert.equal(th.title_zh, "肖申克的救赎");
});
t("findTheme unknown -> null", () => assert.equal(findTheme(WALL_THEMES, "nope"), null));
t("findTheme disabled -> null", () => {
  const fake = { themes: [{ id: "x", enabled: false }] };
  assert.equal(findTheme(fake, "x"), null);
});
t("pickSizeEntry picks recommended", () => {
  const r = pickSizeEntry(WALL_SIZES, "desktop");
  assert.equal(r.width, 2560); assert.equal(r.height, 1440);
});
t("pickSizeEntry falls back to desktop for bad device", () => {
  const r = pickSizeEntry(WALL_SIZES, "tabletop");
  assert.equal(r.width, 2560);
});
t("all 8 config sizes valid on pro", () => {
  let n = 0;
  for (const dev of ["desktop", "mobile"]) {
    for (const s of WALL_SIZES.sizes[dev]) {
      assert.equal(validateWallPixelRange(s.width, s.height, "pro").ok, true, `${dev} ${s.width}x${s.height}`);
      n++;
    }
  }
  assert.equal(n, 8);
});

// ── 5. 请求体构造 ────────────────────────────────────────────────
const THEME = findTheme(WALL_THEMES, "shawshank-redemption");
t("buildWallGenBody fills placeholders", () => {
  const b = buildWallGenBody({ theme: THEME, width: 2560, height: 1440, watermark: false });
  assert.equal(b.model, "doubao-seedream-5-0-pro-260628");
  assert.equal(b.size, "2560x1440");
  assert.equal(b.watermark, false);
  assert.equal(b.response_format, "url");
  assert.ok(!b.prompt.includes("{mood}"));
  assert.ok(b.prompt.includes("hope"));
});
t("buildWallGenBody free watermark defaults true", () => {
  const b = buildWallGenBody({ theme: THEME, width: 1280, height: 720 });
  assert.equal(b.watermark, true);
});
t("pro body has NO sequential field", () => {
  const b = buildWallGenBody({ theme: THEME, width: 2560, height: 1440 });
  assert.equal("sequential_image_generation" in b, false);
});
t("lite body HAS sequential field", () => {
  const b = buildWallGenBody({ theme: THEME, width: 2560, height: 1440, tierName: "lite" });
  assert.equal(b.model, "doubao-seedream-5-0-lite-260128");
  assert.equal(b.sequential_image_generation, "disabled");
});
t("unknown tier falls back to pro", () => {
  const b = buildWallGenBody({ theme: THEME, width: 2560, height: 1440, tierName: "flash" });
  assert.equal(b.model, "doubao-seedream-5-0-pro-260628");
});
t("prompt stays within budget", () => {
  const b = buildWallGenBody({ theme: THEME, width: 2560, height: 1440 });
  assert.ok(b.prompt.length <= WALL_SEEDREAM_SPEC.promptMaxZhChars * 2);
});
t("no film titles / character names in prompt (版权政策)", () => {
  const b = buildWallGenBody({ theme: THEME, width: 2560, height: 1440 });
  const forbidden = ["Shawshank", "肖申克", "Andy", "安迪", "Red", "Brooks"];
  for (const f of forbidden) assert.ok(!b.prompt.includes(f), f);
});

// ── 6. 预览/原图交付决策（任务④）───────────────────────────────────
t("no entitlement -> preview mode", () => {
  const r = decideWallDelivery({ entitlement: null, device: "desktop", sizesJson: WALL_SIZES });
  assert.equal(r.ok, true); assert.equal(r.mode, "preview");
  assert.equal(r.width, 1280); assert.equal(r.height, 720);
  assert.equal(r.watermark, true);
});
t("no entitlement -> mobile preview 720x1280", () => {
  const r = decideWallDelivery({ entitlement: undefined, device: "mobile", sizesJson: WALL_SIZES });
  assert.equal(r.width, 720); assert.equal(r.height, 1280);
});
t("isPaidEntitled rejects null/empty/partial", () => {
  assert.equal(isPaidEntitled(null), false);
  assert.equal(isPaidEntitled({}), false);
  assert.equal(isPaidEntitled({ paid: true }), false);
  assert.equal(isPaidEntitled({ paid: false, orderId: "x" }), false);
  assert.equal(isPaidEntitled({ paid: true, orderId: "o1" }), true);
});
t("paid entitlement -> full 2560x1440 no watermark", () => {
  const r = decideWallDelivery({
    entitlement: { paid: true, orderId: "o1" }, device: "desktop", sizesJson: WALL_SIZES,
  });
  assert.equal(r.mode, "full"); assert.equal(r.width, 2560); assert.equal(r.height, 1440);
  assert.equal(r.watermark, false);
});
t("paid mobile -> full 1333x2368", () => {
  const r = decideWallDelivery({
    entitlement: { paid: true, orderId: "o2" }, device: "mobile", sizesJson: WALL_SIZES,
  });
  assert.equal(r.width, 1333); assert.equal(r.height, 2368);
});
t("preview decision NEVER exposes full-res dimensions", () => {
  const r = decideWallDelivery({ entitlement: null, device: "desktop", sizesJson: WALL_SIZES });
  assert.ok(r.width * r.height < 2560 * 1440);
});

// ── 7. 免费限额键 + 套装结构（任务⑤）──────────────────────────────
t("wallDailyKey format", () => {
  const k = wallDailyKey("1.2.3.4", new Date("2026-10-14T10:00:00Z"));
  assert.equal(k, "wallgen:1.2.3.4:2026-10-14");
});
t("wallDailyKey handles missing ip", () => {
  assert.ok(wallDailyKey(null).startsWith("wallgen:unknown:"));
});
t("normalizeBundle single item ok (not bundle)", () => {
  const r = normalizeBundle({ assetId: "a1" });
  assert.equal(r.ok, true); assert.equal(r.count, 1); assert.equal(r.isBundle, false);
});
t("normalizeBundle 3-5 items = bundle", () => {
  const r = normalizeBundle([{ assetId: "a1" }, { assetId: "a2" }, { assetId: "a3" }]);
  assert.equal(r.ok, true); assert.equal(r.count, 3); assert.equal(r.isBundle, true);
});
t("normalizeBundle >5 rejected", () => {
  const many = Array.from({ length: 6 }, (_, i) => ({ assetId: `a${i}` }));
  assert.equal(normalizeBundle(many).ok, false);
});
t("normalizeBundle filters invalid entries", () => {
  const r = normalizeBundle([{ assetId: "a1" }, { noId: true }, null]);
  assert.equal(r.count, 1);
});
t("normalizeBundle empty rejected", () => assert.equal(normalizeBundle(null).ok, false));
t("bundle defaults kind=still and sizeKey=null", () => {
  const r = normalizeBundle([{ assetId: "a1" }]);
  assert.equal(r.items[0].kind, "still"); assert.equal(r.items[0].sizeKey, null);
});

// ── 汇总 ────────────────────────────────────────────────────────
console.log(`\n合计: ${pass + fail} 项 | 通过 ${pass} | 失败 ${fail}`);
if (fail > 0) process.exit(1);
console.log("SEEDREAM_WALL_HELPERS_TEST=PASS");
