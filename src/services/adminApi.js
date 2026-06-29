const apiBaseUrl = "https://api.bloodyrex.xyz";

export async function adminLogin(password) {
  const r = await fetch(`${apiBaseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return r.json();
}

export async function adminFetchResults(token) {
  const r = await fetch(`${apiBaseUrl}/admin/results`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.json();
}

export async function adminDeleteResult(token, id) {
  const r = await fetch(`${apiBaseUrl}/admin/results/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.json();
}

export async function adminPatchResult(token, id, genre) {
  const r = await fetch(`${apiBaseUrl}/admin/results/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ genre }),
  });
  return r.json();
}