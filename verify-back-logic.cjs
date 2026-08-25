// Verify handleBackToResults decision logic across the 3 scenarios
const scenarios = [
  {
    name: "邮件入口 (from=digest, 无缓存无结果)",
    from: "digest", sourceTmdbId: null, recommendations: [],
    expectUrl: null, expectStep: "input",
  },
  {
    name: "主站正常流 (from=123, 有推荐结果)",
    from: "123", sourceTmdbId: 123, recommendations: [{ title: "A" }, { title: "B" }],
    expectUrl: [123], expectStep: "results",
  },
  {
    name: "分享直达无缓存 (from=123, 无结果)",
    from: "123", sourceTmdbId: 123, recommendations: [],
    expectUrl: [123], expectStep: "input",
  },
];

const filterFinite = (s) => s?.split(",").filter(Boolean).map(Number).filter(Number.isFinite) || [];

let allPass = true;
for (const sc of scenarios) {
  const resultSourceIds = filterFinite(sc.from);
  const urlIds = resultSourceIds.length > 0 ? resultSourceIds : [sc.sourceTmdbId].filter(Boolean);
  const url = urlIds.length > 0 ? urlIds : null; // updateUrl(null) → pushState("/")
  const step = sc.recommendations?.length > 0 ? "results" : "input";
  const urlOk = JSON.stringify(url) === JSON.stringify(sc.expectUrl);
  const stepOk = step === sc.expectStep;
  const ok = urlOk && stepOk;
  if (!ok) allPass = false;
  console.log(`${ok ? "PASS" : "FAIL"}  ${sc.name}`);
  console.log(`      url=${JSON.stringify(url)} (expect ${JSON.stringify(sc.expectUrl)}) step=${step} (expect ${sc.expectStep})`);
}
console.log(allPass ? "\n=== ALL SCENARIOS PASS ===" : "\n=== FAILURES DETECTED ===");
process.exit(allPass ? 0 : 1);
