export const updateSeo = (sourceMovies, movieData) => {
  if (!sourceMovies?.length || !movieData) return;

  const sourceText =
    sourceMovies.length === 1
      ? `《${sourceMovies[0].title}》`
      : sourceMovies.map((m) => `《${m.title}》`).join(" 和 ");

  document.title = `喜欢${sourceText}？《${movieData.title}》可能是你的下一部电影｜Kim's Video`;

  const prefix = `如果你喜欢${sourceText}，AI 推荐你观看《${movieData.title}》。`;
  const maxLength = 140;
  const remain = maxLength - prefix.length;
  let overview = movieData.overview || "";
  if (overview.length > remain) {
    overview = overview.slice(0, Math.max(0, remain - 3)) + "...";
  }
  const desc = prefix + overview;

  let descEl = document.querySelector('meta[name="description"]');
  if (!descEl) {
    descEl = document.createElement("meta");
    descEl.name = "description";
    document.head.appendChild(descEl);
  }
  descEl.content = desc;

  let linkEl = document.querySelector('link[rel="canonical"]');
  if (!linkEl) {
    linkEl = document.createElement("link");
    linkEl.rel = "canonical";
    document.head.appendChild(linkEl);
  }
  linkEl.href = window.location.href;
};

export const resetSeo = () => {
  removeStructuredData();
  document.title =
    "Kim's Video — AI Movie Recommender / 智能影视推荐";

  const desc =
    "输入你喜欢的电影，AI 帮你发现冷门佳作、口碑争议片。基于 DeepSeek 与 TMDB 的智能影视推荐引擎。";
  let descEl = document.querySelector('meta[name="description"]');
  if (!descEl) {
    descEl = document.createElement("meta");
    descEl.name = "description";
    document.head.appendChild(descEl);
  }
  descEl.content = desc;

  let linkEl = document.querySelector('link[rel="canonical"]');
  if (!linkEl) {
    linkEl = document.createElement("link");
    linkEl.rel = "canonical";
    document.head.appendChild(linkEl);
  }
  linkEl.href = "https://bloodyrex.xyz/";
};

const generateStructuredData = (movie) => {
  if (!movie) return null;
  const data = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: movie.originalTitle || movie.title,
    datePublished: movie.year || "",
    director: movie.director
      ? { "@type": "Person", name: movie.director }
      : undefined,
    image: movie.poster || undefined,
  };
  return JSON.stringify(data, null, 2);
};

export const injectStructuredData = (movie) => {
  let script = document.getElementById("movie-schema");
  if (!script) {
    script = document.createElement("script");
    script.id = "movie-schema";
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  const data = generateStructuredData(movie);
  script.textContent = data || "";
};

export const removeStructuredData = () => {
  const script = document.getElementById("movie-schema");
  if (script) script.remove();
};

export const updateStructuredData = (
  sourceMovies,
  detailData,
  matchedTags = []
) => {
  if (!sourceMovies?.length || !detailData) return;

  const href = window.location.href;
  const movieId = href + "#movie";
  const webpageId = href + "#webpage";

  const sourceText =
    sourceMovies.length === 1
      ? `《${sourceMovies[0].title}》`
      : sourceMovies.map((m) => `《${m.title}》`).join(" 和 ");

  let aggregateRating = null;
  if (detailData.vote_average) {
    aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: detailData.vote_average,
      bestRating: 10,
      worstRating: 0,
    };
  }

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Movie",
        "@id": movieId,
        name: detailData.title,
        alternateName: detailData.originalTitle || undefined,
        datePublished: detailData.year || undefined,
        description: detailData.overview || undefined,
        image: detailData.poster || undefined,
        director: detailData.director
          ? { "@type": "Person", name: detailData.director }
          : undefined,
        genre: detailData.genres || undefined,
        duration: detailData.runtime
          ? "PT" + detailData.runtime + "M"
          : undefined,
        aggregateRating: aggregateRating,
        sameAs: [
          "https://www.themoviedb.org/movie/" + (detailData.tmdbId || ""),
        ],
      },
      {
        "@type": "WebPage",
        "@id": webpageId,
        url: href,
        name: `喜欢${sourceText}？《${detailData.title}》可能是你的下一部电影`,
        description:
          matchedTags.length > 0
            ? `如果你喜欢${sourceText}，AI 基于"${matchedTags.join("、")}"等关键词推荐《${detailData.title}》。`
            : `如果你喜欢${sourceText}，AI 推荐你观看《${detailData.title}》。`,
        about: { "@id": movieId },
        isPartOf: {
          "@type": "WebSite",
          name: "Kim's Video",
          url: "https://bloodyrex.xyz/",
        },
      },
    ],
  };

  const cleanData = JSON.parse(
    JSON.stringify(schema, (key, value) => (value === null ? undefined : value))
  );

  let script = document.getElementById("movie-schema");
  if (!script) {
    script = document.createElement("script");
    script.id = "movie-schema";
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(cleanData, null, 2);
};
