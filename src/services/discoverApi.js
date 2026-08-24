const apiBaseUrl = "https://api.bloodyrex.xyz";

// Timeout helper — every discover API call must bail instead of hanging forever
// (the publish button shows "..." while awaiting; without a timeout a stalled
// request reads as a frozen UI).
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function publishToDiscover(data) {
  const response = await fetchWithTimeout(`${apiBaseUrl}/discover/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }, 30000);
  if (!response.ok) throw new Error(`API Error ${response.status}`);
  return response.json();
}

export async function uploadDiscoverThumbnail({ id, image }) {
  // 90s: payload is a full-res PNG data URL; slow mobile uploads need headroom
  const response = await fetchWithTimeout(`${apiBaseUrl}/discover/results/${encodeURIComponent(id)}/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  }, 90000);
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