const apiBaseUrl = "https://api.bloodyrex.xyz";

export async function publishToDiscover(data) {
  const response = await fetch(`${apiBaseUrl}/discover/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`API Error ${response.status}`);
  return response.json();
}

export async function uploadDiscoverThumbnail({ id, image }) {
  const response = await fetch(`${apiBaseUrl}/discover/results/${encodeURIComponent(id)}/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  if (!response.ok) throw new Error(`Upload Error ${response.status}`);
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