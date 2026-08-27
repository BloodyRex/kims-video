// TEMPORARY diagnostic #6 — FINAL validation: the exact compound query that will reliably
// surface "recently concluded whole-season drops" like 207333 (One Hundred Years).
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};
const intelToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
const intelDaysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

async function main() {
  const today = intelToday();
  const t90 = intelDaysAgo(90);
  const t365 = intelDaysAgo(365);   // ~1 year recency for "recently relevant shows"

  console.log("today:", today, "| 90d:", t90);

  // CANDIDATE QUERY: shows first aired in last 365d, sorted by popularity — how many hot titles
  // does it surface, and does it catch 207333?
  async function probeQ(label, firstAirGte) {
    const pool = [];
    let found = null;
    for (let p = 1; p <= 4; p++) {
      const d = await get(`/discover/tv?first_air_date.gte=${firstAirGte}&sort_by=popularity.desc&page=${p}`);
      const res = d.results || [];
      if (!res.length) break;
      for (let i = 0; i < res.length; i++) { pool.push(res[i]); if (res[i].id === 207333) found = { page: p, rank: (p-1)*20+i+1 }; }
    }
    const hits = pool.filter(x => x.id === 207333).map(x => ({ pop: x.popularity, va: x.vote_average }));
    console.log(`[${label}] pool=${pool.length} 207333 hit=`, hits.length ? JSON.stringify(hits) : "NO", found ? `rank=${found.rank}` : "");
    return pool;
  }

  const p365 = await probeQ("first_air>=365d pop", t365);
  const p90 = await probeQ("first_air>=90d pop", t90);

  // Of the 365d pool, how many are status=Ended (whole-season drops / miniseries)?
  // We can't batch-status; instead show the pool composition by vote_average (proxy for
  // "prestige limited series" like 百年孤独) and see where 207333 would compete.
  console.log("\n--- 365d pool: top-15 by score proxy (pop + rating blend) ---");
  const scored = p365.map(m => ({ ...m, blend: (m.vote_average || 0) * 0.6 + m.popularity * 0.02 }));
  scored.sort((a, b) => b.blend - a.blend);
  scored.slice(0, 15).forEach((s, i) => console.log(`  ${i + 1}. ${s.name} | pop=${s.popularity.toFixed(1)} r=${s.vote_average || 0}`));

  // Confirm 207333 would pass the existing ongoing gate (pop>=30, 2010+, zh visible)
  const tv = await get("/tv/207333?language=zh-CN");
  const zhName = tv.name || "";
  const zhOv = tv.overview || "";
  const hasZh = /[一-鿿]/.test(zhName) && /[一-鿿]/.test(zhOv);
  console.log("\n--- 207333 gate checks ---");
  console.log("  first_air_date:", tv.first_air_date, ">=2010:", Number(tv.first_air_date.slice(0,4)) >= 2010);
  console.log("  popularity:", tv.popularity, ">=30:", tv.popularity >= 30);
  console.log("  zh title+overview:", hasZh, "| name:", zhName);
  console.log("  last episode air:", tv.last_episode_to_air?.air_date, "within 90d:", tv.last_episode_to_air?.air_date >= t90);

  // The ongoing flow uses intelSelectDiverse with score = 0.25*S_pop + 0.45*S_date + 0.30*S_qual.
  // S_date is from first_air_date. Show what S_date 207333 would get (first_air 2024-12 ≈ 250d ago).
  const daysOld = (new Date(today) - new Date(tv.first_air_date)) / 86400000;
  const S_date = 100 * Math.exp(-Math.LN2 / 7 * daysOld);
  const S_pop = Math.min(100, Math.max(0, (45.2871 - 20) / (200 - 20) * 100)); // rough, depends on batch
  const S_qual = Math.min(100, (tv.vote_average / 10) * 100);
  console.log("\n  S_date(first_air, ~250d old):", S_date.toFixed(1), "→ composite will be LOW due to old first_air date");
  console.log("  ⚠️ This is key: ongoing scoring uses first_air_date recency → a 2024 show scores near-0 on S_date.");
}

main().catch(e => { console.error("FATAL", e.message); process.exit(1); });
