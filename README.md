# Kim's Video — AI Entertainment Platform

**Discover** — AI-powered personalized film recommendation.
**Intelligence** — Daily auto-aggregated global entertainment data hub.

![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Tech Stack](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)
![Tech Stack](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![Tech Stack](https://img.shields.io/badge/Cloudflare_Worker-F38020?logo=cloudflare)
![Tech Stack](https://img.shields.io/badge/DeepSeek-4F46E5)
![Tech Stack](https://img.shields.io/badge/TMDB-01D277?logo=themoviedatabase)
![Tech Stack](https://img.shields.io/badge/MusicBrainz-BA478F)

---

## ✨ Discover — AI Movie Recommender

- Input 1-2 reference films → AI progressive Q&A → 5 tailored picks
- 2 popular + 2 hidden gems + 1 wild card, powered by DeepSeek
- Individual movie detail pages with TMDB metadata
- URL sharing, screenshot save, "swap one" per card
- Community discovery page with genre-curated recommendation pairs

---

## 📡 Intelligence — Entertainment Data Hub

- **Overview** — Daily stats (movies/TV/albums) + Editor's Picks + Trending
- **Movies** — Today / This Week / Upcoming / Now Playing with TMDB rating + AI score
- **TV** — Today / This Week / Upcoming / Ongoing with season/episode info
- **Music** — MusicBrainz new releases filtered by DeepSeek AI (global vs niche)
- **Coming Soon** — 7-day / 30-day countdown cards
- **Trending** — Ranked charts: Today / Week / Month x Movies / TV / Music
- **Weekly Reports** — Timeline layout with expandable details
- **AI Spotlight** — Daily DeepSeek-generated 7-category picks
- **Search** — Local JSON search across all movies, TV, albums, artists

---

## Architecture

```
Browser (React 18 + Vite)
  |
  |-- Discover: POST /api → Worker → DeepSeek + TMDB
  |-- Intelligence: GET /api/*.json (static, updated daily)
  |
GitHub Actions (Intelligence Daily Pipeline)
  |-- Calls Worker /intelligence/* endpoints
  |-- Writes JSON → commits → triggers Pages deploy
  |
Cloudflare Worker
  |-- POST /           → DeepSeek recommendation
  |-- GET  /poster-proxy → TMDB image proxy
  |-- GET  /intelligence/* (8 endpoints)
  |     /overview, /movies, /tv, /music,
  |     /trending, /coming, /weekly, /editor
  |
  +--- DeepSeek API (chat/completions)
  +--- TMDB v4 API (search, now_playing, trending, details)
  +--- MusicBrainz API (release query)
```

---

## Project Structure

```
src/
├── App.jsx                    # Main app + SPA routing
├── App.css                    # Tailwind + pixel-art theme
├── i18n.jsx                   # zh/en bilingual
├── components/
│   ├── IntelligencePage.jsx   # Intelligence hub (9 sub-views)
│   ├── Cards.jsx              # 7 card components
│   ├── DiscoverPage.jsx       # Discovery hub
│   ├── InputPage.jsx          # Recommendation input
│   ├── ResultsPage.jsx        # Recommendation results
│   ├── MovieDetail.jsx        # Movie detail sub-page
│   └── Icons.jsx              # SVG icons
├── logic/useMovieEngine.js    # Core recommendation engine
├── services/                  # API + SEO + config
├── data/discover.json         # Discover recommendation pairs
scripts/
├── fetch-intelligence-data.js # Daily data pipeline
.github/workflows/
├── deploy.yml                 # GitHub Pages deploy
├── intelligence-daily.yml     # Daily data pipeline
workers-1.3.txt                # Cloudflare Worker (full source)
```

---

## Deploy

### Worker
Paste `workers-1.3.txt` into Cloudflare Worker Editor → Deploy.

**Env vars:** `DEEPSEEK_API_KEY` | `TMDB_API_READ_ACCESS_TOKEN`

### Frontend
Push to `main` → GitHub Actions auto-deploys to GitHub Pages.

### Data Pipeline
`Intelligence Daily Pipeline` runs daily at 02:00 UTC. Manual trigger available in Actions tab.

### Local Dev
```bash
npm install
npm run dev
# http://localhost:5173              → Main
# http://localhost:5173/intelligence → Intelligence
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Build | Vite 6 |
| UI | React 18 + Tailwind CSS 4 |
| AI | DeepSeek Chat |
| Film Data | TMDB v4 |
| Music Data | MusicBrainz API |
| Backend | Cloudflare Workers |
| Pipeline | GitHub Actions (cron + manual) |
| Deploy | GitHub Pages + Cloudflare |
| i18n | zh-CN / en-US |

---

MIT © BLOODYREX
