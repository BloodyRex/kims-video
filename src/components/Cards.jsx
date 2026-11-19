// Barrel export for Cards components
// Re-exports all components from modular files for backward compatibility

// ── Intelligence cards (MovieCard, TVCard, AlbumCard, etc.) ──
export {
  // Shared helpers
  GENRE_ZH,
  albumGenres,
  albumGenresEn,
  ratingColor,
  RatingBadge,
  StarRating,
  AIScoreBadge,
  Tags,
  TrailerButtons,
  CardShell,
  makeEntry,
  FavoriteButton,
  // Card components
  MovieCard,
  TVCard,
  AlbumCard,
} from "./IntelCards";

// ── Wall cards (CountdownCard, RankingCard, WeeklyCard, SpotlightCard, WallStyleCard) ──
export {
  CountdownCard,
  RankingCard,
  WeeklyCard,
  SpotlightCard,
  WallStyleCard,
} from "./WallCards";

// ── Detail modals ──
export {
  IntelDetailModal,
} from "./DetailModals";

// ── Section headers & grids ──
export {
  SectionHeader,
  CardGrid,
  CardList,
} from "./WallCards";

// ── Utility functions ──
export {
  pickSummary,
  matchesDetailType,
} from "./IntelCards";
