export const INTELLIGENCE_CONFIG = {
  releaseWindowDays: 30,
  mbPages: 3,
  mbPageSize: 100,
  minArtistListeners: 500,
  artistCheckLimit: 80,
  albumEnrichLimit: 40,
  candidateLimitForAI: 18,
  finalCount: 20,
  chartTags: [
    "hip hop", "pop", "rock", "electronic",
    "jazz", "blues", "classical", "folk",
    "k-pop", "j-pop", "mandopop", "latin",
  ],
  // ── Regional bias for the 🌍环球音乐 category (Rex 2026-08-24) ──
  // The default MusicBrainz pass is relevance-ordered and dominated by US/EU
  // releases, so the CJK quota in the Worker had zero material (world=0 live).
  regionalBiasCountries: ["JP", "KR", "CN", "TW", "HK"],
  regionalBiasPages: 1,      // extra MB pages restricted to those countries
  regionalArtistReserve: 16, // of the 80 Last.fm artist-check slots
};
