#!/usr/bin/env node
/**
 * 阶段 0 合规自检脚本
 * 检查主题 prompt 模板是否包含受版权保护的具体元素（角色名/场景/标题）
 * 运行: node scripts/wallpaper-compliance-check.mjs
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// 受版权保护的关键词黑名单 — 出现在 prompt 中即违规
// 原则：只禁止（1）角色名 （2）具体场景/道具 （3）电影标题
// 不禁止：情绪词、色彩、纹理、光线、类型词（cyberpunk/post-apocalyptic 等）
const FORBIDDEN_PATTERNS = [
  // 角色名（带词边界，避免 substring 误伤）
  /\bAndy\b/i,
  /\bDufresne\b/i,
  /\bBrooks\b/i,
  /\bHeywood\b/i,
  /\bTommy\b/i,
  /\bJack\b/i,
  /\bRose\b/i,
  /\bCal\b/i,
  /\bMolly Brown\b/i,
  /\bDieyi\b/i,
  /\bXiaolou\b/i,
  /\bForrest\b/i,
  /\bJenny\b/i,
  /\bBubba\b/i,
  /\bChihiro\b/i,
  /\bYubaba\b/i,
  /\bNo-Face\b/i,
  /\bHaku\b/i,
  /\bCobb\b/i,
  /\bAriadne\b/i,
  /\bArthur\b/i,
  /\bCooper\b/i,
  /\bBrand\b/i,
  /\bMurph\b/i,
  /\bTruman\b/i,
  /\bChristof\b/i,
  /\bNick\b/i,
  /\bJudy\b/i,
  /\bFlash\b/i,
  /\bMiguel\b/i,
  /\bHector\b/i,
  /\bErnesto\b/i,
  /\bWALL-E\b/i,
  /\bEVE\b/i,
  /\bCarl\b/i,
  /\bRussell\b/i,
  /\bMathieu\b/i,
  /\bPépinot\b/i,
  /\bMorhange\b/i,
  /\bFrank\b/i,
  /\bCharlie\b/i,
  /\bSlade\b/i,
  /\bGuido\b/i,
  /\bJoshua\b/i,
  /\bDora\b/i,
  /\bTyler\b/i,
  /\bMarla\b/i,
  /\bNeo\b/i,
  /\bTrinity\b/i,
  /\bMorpheus\b/i,
  /\bParzival\b/i,
  /\bArt3mis\b/i,
  /\bHalliday\b/i,
  /\bPaul\b/i,
  /\bChani\b/i,
  /\bFeyd\b/i,
  // 电影标题
  /\bShawshank\b/i,
  /\bConcubine\b/i,
  /\bGump\b/i,
  /\bTitanic\b/i,
  /\bSpirited Away\b/i,
  /\bInception\b/i,
  /\bInterstellar\b/i,
  /\bTruman\b/i,
  /\bZootopia\b/i,
  /\bCoco\b/i,
  /\bWALL-E\b/i,
  /\bChoristes\b/i,
  /\bScent of a Woman\b/i,
  /\bLife is Beautiful\b/i,
  /\bFight Club\b/i,
  /\bMatrix\b/i,
  /\bReady Player One\b/i,
  /\bDune\b/i,
  // 具体场景/道具（电影的标志性画面）
  /\bbow pose\b/i,
  /\bspinning top\b/i,
  /\bbox of chocolates\b/i,
  /\bsoap\b/i,
  /\bcode rain\b/i,
  /\bsandworm\b/i,
  /\bbathtub\b/i,
  /\bpiano\b/i,
  /\bocean liner\b/i,
  /\bballoons\b/i,
  /\bsuburban neighborhood\b/i,
  /\bopera stage\b/i,
  /\bboarding school\b/i,
  /\bconcentration camp\b/i,
];

function expandPrompt(theme) {
  return theme.prompt_template
    .replace("{mood}", theme.mood.join(", "))
    .replace("{palette}", theme.palette.join(", "))
    .replace("{composition}", theme.composition);
}

function checkTheme(theme) {
  const issues = [];
  const prompt = expandPrompt(theme);
  
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (typeof pattern === "string") {
      if (prompt.toLowerCase().includes(pattern.toLowerCase())) {
        issues.push(`包含禁止关键词: "${pattern}"`);
      }
    } else if (pattern.test(prompt)) {
      issues.push(`匹配禁止模式: ${pattern.toString()}`);
    }
  }
  
  return issues;
}

function main() {
  const themesPath = join(root, "config", "wallpaper-themes.json");
  const sizesPath = join(root, "config", "wallpaper-sizes.json");
  
  console.log("=== 阶段 0 合规自检 ===\n");
  
  // 1. 检查主题
  let themes;
  try {
    themes = JSON.parse(readFileSync(themesPath, "utf-8"));
  } catch (e) {
    console.error(`❌ 无法读取主题文件: ${themesPath}`);
    process.exit(1);
  }
  
  console.log(`📋 主题数量: ${themes.themes.length}`);
  console.log(`📋 版本: ${themes.version}`);
  console.log(`📋 版权策略: ${themes.copyright_policy}\n`);
  
  let totalIssues = 0;
  for (const theme of themes.themes) {
    const issues = checkTheme(theme);
    if (issues.length > 0) {
      console.log(`❌ ${theme.id} (${theme.title_zh}):`);
      issues.forEach(i => console.log(`   - ${i}`));
      totalIssues++;
    } else {
      console.log(`✅ ${theme.id} (${theme.title_zh})`);
    }
  }
  
  // 2. 检查尺寸
  console.log("\n--- 尺寸检查 ---");
  let sizes;
  try {
    sizes = JSON.parse(readFileSync(sizesPath, "utf-8"));
  } catch (e) {
    console.error(`❌ 无法读取尺寸文件: ${sizesPath}`);
    process.exit(1);
  }
  
  const desktopCount = sizes.sizes.desktop.length;
  const mobileCount = sizes.sizes.mobile.length;
  console.log(`✅ 桌面尺寸: ${desktopCount} 种`);
  console.log(`✅ 手机尺寸: ${mobileCount} 种`);
  console.log(`✅ 自动推荐策略: ${sizes.auto_recommendation.strategy}`);
  
  // 3. 汇总
  console.log("\n=== 检查结果 ===");
  if (totalIssues === 0) {
    console.log("✅ 全部主题通过合规检查");
    process.exit(0);
  } else {
    console.log(`❌ ${totalIssues} 个主题存在合规问题`);
    process.exit(1);
  }
}

main();
