const token = process.env.TMDB;
const h = { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };
// The ongoing shows we expect to have S/E (from the diag detailed list / names seen)
const shows = [
  ["外滩探秘", ""], ["黑袍纠察队", ""], ["咒术回战", ""], ["特别行动母狮", ""],
  ["侠探杰克", "Reacher"], ["无职转生", ""], ["菜鸟老警", "The Rookie"],
];
(async () => {
  for (const [zh, en] of shows) {
    const q = en || zh;
    const s = await (await fetch(`https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(q)}&language=zh-CN`, h)).json();
    const cand = s.results?.[0];
    if (!cand) { console.log(`${zh}: no match`); continue; }
    const d = await (await fetch(`https://api.themoviedb.org/3/tv/${cand.id}?language=zh-CN`, h)).json();
    const le = d.last_episode_to_air, ne = d.next_episode_to_air;
    console.log(`${zh} (id ${cand.id}) | last_ep: ${le ? `S${le.season_number}/E${le.episode_number} ${le.air_date}` : "NONE"} | next_ep: ${ne ? `S${ne.season_number} ${ne.air_date}` : "NONE"} | status: ${d.status}`);
  }
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });