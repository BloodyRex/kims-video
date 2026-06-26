const apiBaseUrl = "https://api.bloodyrex.xyz";

export async function publishToDiscover({
  sourceMovies,
  recommendations,
  genre,
  contributorName,
}) {
  const response = await fetch(`${apiBaseUrl}/discover/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceMovies, recommendations, genre, contributorName }),
  });
  if (!response.ok) throw new Error(`API Error ${response.status}`);
  return response.json();
}

export async function fetchDiscoverResults({
  genre = "",
  sort = "newest",
  limit = 20,
  cursor = "",
} = {}) {
  const params = new URLSearchParams();
  if (genre) params.set("genre", genre);
  if (sort) params.set("sort", sort);
  if (limit) params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`${apiBaseUrl}/discover/results?${params.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`API Error ${response.status}`);
  return response.json();
}

export async function likeDiscoverResult(id) {
  const response = await fetch(`${apiBaseUrl}/discover/results/${encodeURIComponent(id)}/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`API Error ${response.status}`);
  return response.json();
}