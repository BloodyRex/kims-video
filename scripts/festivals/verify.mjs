#!/usr/bin/env node
/**
 * Festival Calendar —— 发布产物自检（项目无 test 框架，用自带断言当回归门）
 *
 *   node scripts/festivals/verify.mjs
 *
 * 校验发布出去的 public/api 文件与磁盘上的标准化数据一致且自洽：
 *   1. 每条排片必须有官方来源 URL、合法日期/时间、合法影厅；
 *   2. 日期必须落在该届电影节区间内；
 *   3. 「排片待公布」必须是显式状态，不能只是空数组而无状态；
 *   4. 今日统计与今日排片条数必须对得上；
 *   5. 变更记录必须带 old/new 与官方来源；
 *   6. 详情文件里的影片引用必须存在。
 * 任一失败 → 非零退出（CI 里会让这一步红掉）。
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const API = join(ROOT, "public", "api");

const errors = [];
const warnings = [];
let checks = 0;
const ok = (cond, msg) => {
  checks++;
  if (!cond) errors.push(msg);
};

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

function main() {
  const indexPath = join(API, "festivals.json");
  ok(existsSync(indexPath), "public/api/festivals.json missing");
  if (!existsSync(indexPath)) return;

  const index = readJson(indexPath);
  const changes = existsSync(join(API, "festival-changes.json")) ? readJson(join(API, "festival-changes.json")) : { changes: [] };

  ok(!!index.updated, "index.updated missing");
  ok(!!index.today && /^\d{4}-\d{2}-\d{2}$/.test(index.today), `index.today invalid: ${index.today}`);
  ok(Array.isArray(index.festivals) && index.festivals.length > 0, "index.festivals empty");
  ok(index.scopeNote?.zh && index.scopeNote?.en, "index.scopeNote missing (scope must be stated, never 'all festivals')");
  ok(!!index.calendar && Object.keys(index.calendar).length > 0, "index.calendar empty");

  const stats = index.stats || {};
  const liveToday = (index.festivals || []).filter((f) => f.startDate <= index.today && f.endDate >= index.today);
  ok(stats.liveToday === liveToday.length, `stats.liveToday ${stats.liveToday} != computed ${liveToday.length}`);
  const screeningSum = liveToday.reduce((n, f) => n + (f.today?.screenings || 0), 0);
  ok(stats.screeningsToday === screeningSum, `stats.screeningsToday ${stats.screeningsToday} != sum ${screeningSum}`);

  for (const f of index.festivals || []) {
    ok(f.slug && f.startDate && f.endDate, `card ${f.slug}: missing dates`);
    ok(f.startDate <= f.endDate, `card ${f.slug}: start > end`);
    ok(!!f.officialUrl, `card ${f.slug}: no official URL`);
    ok(!!f.status, `card ${f.slug}: no status`);
    ok(!!f.statusDetail?.schedule, `card ${f.slug}: schedule status not explicit`);

    // 「尚未公布」必须是状态，不是空白
    if (f.statusDetail?.schedule === "PENDING") {
      ok(!!f.statusNote?.zh, `card ${f.slug}: schedule PENDING but no explicit note`);
    }

    // 今日排片与计数一致 + 每条都带官方来源
    const items = f.today?.items || [];
    const itemsInRange = items.filter((i) => /^\d{2}:\d{2}$/.test(i.time || ""));
    ok(itemsInRange.length <= (f.today?.entries ?? 0) + 0, `card ${f.slug}: today.items ${itemsInRange.length} > entries ${f.today?.entries}`);
    const scr = items.filter((i) => i.kind === "SCREENING").length;
    ok(scr === (f.today?.screenings ?? 0), `card ${f.slug}: today screenings ${scr} != stat ${f.today?.screenings}`);
    for (const i of items) {
      ok(!!i.venueName, `card ${f.slug}: today item ${i.id} without venue`);
      ok(!!i.officialUrl, `card ${f.slug}: today item ${i.id} without official source`);
    }
    ok(!!f.lastVerifiedAt || f.dataSource === "registry", `card ${f.slug}: no lastVerifiedAt`);

    if (f.dataSource === "official") {
      const detailPath = join(API, "festivals", `${f.slug}.json`);
      ok(existsSync(detailPath), `detail file missing for ${f.slug}`);
      if (!existsSync(detailPath)) continue;
      const d = readJson(detailPath);

      ok(d.slug === f.slug, `detail ${f.slug}: slug mismatch`);
      ok(d.stats.films === f.stats.films, `detail ${f.slug}: films ${d.stats.films} != index ${f.stats.films}`);
      ok(d.stats.screenings === f.stats.screenings, `detail ${f.slug}: screenings ${d.stats.screenings} != index ${f.stats.screenings}`);
      ok((d.sources || []).length > 0, `detail ${f.slug}: no sources`);
      ok((d.sources || []).every((s) => /^https?:/.test(s.url)), `detail ${f.slug}: bad source url`);
      ok((d.sources || []).some((s) => s.ok), `detail ${f.slug}: no reachable official source`);

      const venueIds = new Set((d.venues || []).map((v) => v.id));
      const filmIds = new Set((d.films || []).map((x) => x.id));
      const ids = new Set();
      for (const s of d.screenings || []) {
        ok(/^\d{4}-\d{2}-\d{2}$/.test(s.date), `detail ${f.slug}: bad date ${s.id}`);
        ok(/^\d{2}:\d{2}$/.test(s.localTime), `detail ${f.slug}: bad time ${s.id}`);
        ok(s.date >= d.edition.startDate && s.date <= d.edition.endDate, `detail ${f.slug}: ${s.id} outside edition range`);
        ok(venueIds.has(s.venueId), `detail ${f.slug}: ${s.id} unknown venue ${s.venueId}`);
        ok(!ids.has(s.id), `detail ${f.slug}: duplicate id ${s.id}`);
        ids.add(s.id);
        ok(!!s.officialSourceUrl, `detail ${f.slug}: ${s.id} without official source`);
        ok(!!s.timezone, `detail ${f.slug}: ${s.id} without timezone`);
        if (s.kind === "SCREENING") ok(filmIds.has(s.filmId), `detail ${f.slug}: ${s.id} unknown film`);
        else ok(!!s.title, `detail ${f.slug}: ${s.kind} entry without title`);
      }

      // 覆盖天数应等于官方排片页数（BIFF 全届 10 天）
      const coveredDays = new Set((d.screenings || []).map((s) => s.date)).size;
      if (coveredDays < d.edition.dayCount) {
        warnings.push(`detail ${f.slug}: schedule covers ${coveredDays}/${d.edition.dayCount} days`);
      }
      if ((d.warnings || []).length) warnings.push(`detail ${f.slug}: parser warnings — ${d.warnings.slice(0, 3).join(" | ")}`);
    }
  }

  for (const c of changes.changes || []) {
    ok(!!c.at && !!c.kind && !!c.label, `change ${c.id}: incomplete record`);
    ok(Array.isArray(c.fields) && c.fields.length > 0, `change ${c.id}: no field-level diff`);
    ok(c.fields.every((x) => "from" in x && "to" in x), `change ${c.id}: field missing old/new`);
    ok(!!(c.sourceUrl || c.sourceLabel), `change ${c.id}: no official source reference`);
  }

  console.log(`[verify] ${checks} assertions, ${errors.length} error(s), ${warnings.length} warning(s)`);
  if (warnings.length) warnings.slice(0, 10).forEach((w) => console.log(`  warn: ${w}`));
  if (errors.length) {
    errors.slice(0, 25).forEach((e) => console.error(`  ERR: ${e}`));
    process.exit(1);
  }
  console.log("[verify] published festival data is self-consistent ✓");
}

main();
